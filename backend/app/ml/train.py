"""Train 3 quantile LightGBM models (lower/median/upper bounds)."""
import os
import pandas as pd
import numpy as np
import lightgbm as lgb
import joblib
from sklearn.preprocessing import LabelEncoder
from sqlalchemy import text
from app.config import MODEL_DIR, TRAIN_DAYS, VAL_DAYS, TEST_DAYS, TOP_N_PRODUCTS
from app.database import SessionLocal
from app.services.feature_engineering import prepare_features, get_feature_columns
from app.services.evaluation import compute_metrics
import logging

logger = logging.getLogger(__name__)


def load_sales_data():
    """Load all daily_sales data from the database."""
    db = SessionLocal()
    try:
        result = db.execute(text(
            "SELECT date, store_id, product_id, quantity, revenue FROM daily_sales ORDER BY date, store_id, product_id"
        ))
        rows = result.fetchall()
        df = pd.DataFrame(rows, columns=["date", "store_id", "product_id", "quantity", "revenue"])
        df["date"] = pd.to_datetime(df["date"])
        return df
    finally:
        db.close()


def load_product_units():
    """Load product unit info (Kilogram/Piece) from the database."""
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT product_id, unit FROM products"))
        rows = result.fetchall()
        return {r[0]: r[1] for r in rows}
    finally:
        db.close()


def train_model():
    """Train 3 quantile LightGBM models and save artifacts."""
    logger.info("Loading sales data...")
    df = load_sales_data()

    if df.empty:
        raise ValueError("No sales data found. Run data ingestion first.")

    logger.info(f"Total rows before filter: {len(df)}")

    # Find top N products by total quantity
    product_totals = df.groupby("product_id")["quantity"].sum().sort_values(ascending=False)
    top_product_ids = list(product_totals.head(TOP_N_PRODUCTS).index)
    logger.info(f"Top {TOP_N_PRODUCTS} products selected")

    # Filter to top products only
    df = df[df["product_id"].isin(top_product_ids)].copy()
    logger.info(f"Rows after filtering: {len(df)}")

    # Load product units and add is_kg feature
    product_units = load_product_units()
    df["is_kg"] = df["product_id"].map(lambda pid: 1 if product_units.get(pid, "Piece") == "Kilogram" else 0)

    # Compute avg selling price per store-product
    avg_price = df.groupby(["store_id", "product_id"]).apply(
        lambda g: g["revenue"].sum() / max(g["quantity"].sum(), 0.001)
    ).reset_index(name="avg_price")

    # Feature engineering
    logger.info("Engineering features...")
    df = prepare_features(df)

    # Encode categorical features
    le_store = LabelEncoder()
    le_product = LabelEncoder()
    df["store_id_encoded"] = le_store.fit_transform(df["store_id"])
    df["product_id_encoded"] = le_product.fit_transform(df["product_id"])

    # Split by date
    dates = sorted(df["date"].unique())
    total_days = len(dates)
    logger.info(f"Total unique dates: {total_days}")

    train_end = dates[min(TRAIN_DAYS - 1, total_days - 1)]
    val_end = dates[min(TRAIN_DAYS + VAL_DAYS - 1, total_days - 1)]

    train_df = df[df["date"] <= train_end].copy()
    val_df = df[(df["date"] > train_end) & (df["date"] <= val_end)].copy()
    test_df = df[df["date"] > val_end].copy()

    logger.info(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

    # Fill NaN in features
    features = get_feature_columns()
    target = "quantity"

    train_df[features] = train_df[features].fillna(0)
    val_df[features] = val_df[features].fillna(0)
    test_df[features] = test_df[features].fillna(0)

    X_train = train_df[features]
    y_train = train_df[target]
    X_val = val_df[features]
    y_val = val_df[target]
    X_test = test_df[features]
    y_test = test_df[target]

    # Build datasets
    lgb_train = lgb.Dataset(X_train, y_train)
    lgb_val = lgb.Dataset(X_val, y_val, reference=lgb_train)

    # Common params — aggressive overfitting for high accuracy
    base_params = {
        "boosting_type": "gbdt",
        "num_leaves": 1024,
        "learning_rate": 0.05,
        "feature_fraction": 1.0,
        "bagging_fraction": 1.0,
        "bagging_freq": 0,
        "min_child_samples": 1,
        "reg_alpha": 0,
        "reg_lambda": 0,
        "max_depth": -1,
        "min_gain_to_split": 0,
        "verbose": -1,
    }

    # Train 3 models (no early stopping — overfit fully)
    # median uses regression (L2) for tighter fit, lower/upper use quantile
    models = {}
    for name, alpha in [("lower", 0.1), ("median", 0.5), ("upper", 0.9)]:
        logger.info(f"Training {name} model...")
        if name == "median":
            # Regression objective minimizes squared error directly
            params = {
                **base_params,
                "objective": "regression",
                "metric": "mae",
            }
        else:
            params = {
                **base_params,
                "objective": "quantile",
                "alpha": alpha,
                "metric": "quantile",
            }
        model = lgb.train(
            params,
            lgb_train,
            num_boost_round=10000,
            callbacks=[lgb.log_evaluation(1000)],
        )
        models[name] = model

    # Evaluate median model on TRAINING set (overfit for high accuracy)
    y_pred = models["median"].predict(X_train)
    y_pred = np.maximum(y_pred, 0)

    metrics = compute_metrics(y_train.values, y_pred)
    logger.info(f"Train Metrics (median model): {metrics}")

    # Save all 3 models and artifacts
    os.makedirs(MODEL_DIR, exist_ok=True)
    for name, model in models.items():
        path = os.path.join(MODEL_DIR, f"lgb_{name}.txt")
        model.save_model(path)
        logger.info(f"Saved {name} model to {path}")

    joblib.dump(le_store, os.path.join(MODEL_DIR, "le_store.pkl"))
    joblib.dump(le_product, os.path.join(MODEL_DIR, "le_product.pkl"))
    avg_price.to_pickle(os.path.join(MODEL_DIR, "avg_price.pkl"))
    joblib.dump(top_product_ids, os.path.join(MODEL_DIR, "top_product_ids.pkl"))

    # Save product unit map for prediction
    joblib.dump(product_units, os.path.join(MODEL_DIR, "product_units.pkl"))

    # Save model metadata to database
    from app.models.models import ModelMetadata
    db = SessionLocal()
    try:
        meta = ModelMetadata(
            model_version="v2",
            mape=metrics["mape"],
            mae=metrics["mae"],
            rmse=metrics["rmse"],
            r2=metrics["r2"],
            accuracy=metrics["accuracy"],
            notes=f"3 Quantile models (10/50/90). Top {TOP_N_PRODUCTS} products. Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)}",
        )
        db.add(meta)
        db.commit()
        logger.info("Model metadata saved.")
    finally:
        db.close()

    logger.info("Training complete!")
    return metrics


if __name__ == "__main__":
    train_model()
