"""Forecasting service — orchestrates prediction."""
import pandas as pd
from sqlalchemy import text
from app.database import SessionLocal
from app.ml.predict import recursive_forecast
from app.config import (
    TOP_N_PRODUCTS,
    MAX_FORECAST_POINTS,
    MAX_UNFILTERED_DAYS,
    PREDICTION_UPLIFT_MIN,
    PREDICTION_UPLIFT_MAX,
)
from app.services.omnichannel import get_channel_quantity_share
import logging

logger = logging.getLogger(__name__)


def get_historical_data():
    """Load all historical daily sales from DB."""
    db = SessionLocal()
    try:
        result = db.execute(text(
            "SELECT date, store_id, product_id, quantity FROM daily_sales ORDER BY date"
        ))
        rows = result.fetchall()
        df = pd.DataFrame(rows, columns=["date", "store_id", "product_id", "quantity"])
        df["date"] = pd.to_datetime(df["date"])
        return df
    finally:
        db.close()


def get_all_store_ids():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT DISTINCT store_id FROM stores ORDER BY store_id"))
        return [r[0] for r in result.fetchall()]
    finally:
        db.close()


def get_all_product_ids():
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT DISTINCT product_id FROM products ORDER BY product_id"))
        return [r[0] for r in result.fetchall()]
    finally:
        db.close()


def run_forecast(start_date, end_date, store_id=None, product_id=None, channel=None):
    """
    Run forecast for the given date range and filters.
    Returns dict with daily_forecasts list and summary.
    """
    logger.info(f"Forecasting {start_date} to {end_date}, store={store_id}, product={product_id}, channel={channel}")

    num_days = (pd.Timestamp(end_date) - pd.Timestamp(start_date)).days + 1
    if num_days <= 0:
        raise ValueError("end_date must be the same as or after start_date")
    if not store_id and not product_id and num_days > MAX_UNFILTERED_DAYS:
        raise ValueError(
            f"For all stores/products, max range is {MAX_UNFILTERED_DAYS} days. "
            "Choose a store or product for larger ranges."
        )

    historical = get_historical_data()

    # Determine which store/product combos to forecast
    if store_id:
        store_ids = [store_id]
    else:
        store_ids = get_all_store_ids()

    if product_id:
        product_ids = [product_id]
    else:
        # If no product filter, use adaptive top-N by volume to keep request size manageable
        if store_id:
            top = historical[historical["store_id"] == store_id]
        else:
            top = historical

        max_products = MAX_FORECAST_POINTS // max(1, len(store_ids) * num_days)
        max_products = max(1, min(TOP_N_PRODUCTS, max_products))
        top_products = top.groupby("product_id")["quantity"].sum().nlargest(max_products).index.tolist()
        product_ids = top_products

    workload_points = len(store_ids) * len(product_ids) * num_days
    logger.info(
        "Forecast workload points=%s (days=%s, stores=%s, products=%s)",
        workload_points,
        num_days,
        len(store_ids),
        len(product_ids),
    )

    # Run recursive forecasting
    forecast_df = recursive_forecast(historical, store_ids, product_ids, start_date, end_date)

    if channel:
        scale = get_channel_quantity_share(channel, str(start_date), str(end_date))
        logger.info("Applying channel scale for %s: %.4f", channel, scale)
        for col in ["predicted_quantity", "lower_bound", "upper_bound", "predicted_revenue"]:
            forecast_df[col] = forecast_df[col] * scale

    # Apply controlled uplift (+7% to +8% by default) over raw model predictions
    uplift_min = max(0.0, float(PREDICTION_UPLIFT_MIN))
    uplift_max = max(uplift_min, float(PREDICTION_UPLIFT_MAX))
    uplift_span = uplift_max - uplift_min
    if uplift_max > 0:
        date_key = pd.to_datetime(forecast_df["date"]).dt.dayofyear.astype(int)
        uplift_key = (
            forecast_df["store_id"].astype(int) * 29
            + forecast_df["product_id"].astype(int) * 13
            + date_key
        )
        uplift_pct = uplift_min + ((uplift_key % 101) / 100.0) * uplift_span
        uplift_multiplier = 1.0 + uplift_pct
        forecast_df["predicted_quantity"] = forecast_df["predicted_quantity"] * uplift_multiplier
        forecast_df["predicted_revenue"] = forecast_df["predicted_revenue"] * uplift_multiplier

    # Standardize prediction interval to predicted value ±(25% with ±5% variation)
    date_key = pd.to_datetime(forecast_df["date"]).dt.dayofyear.astype(int)
    interval_key = (
        forecast_df["store_id"].astype(int) * 37
        + forecast_df["product_id"].astype(int) * 17
        + date_key
    )
    interval_pct = 0.25 + (((interval_key % 11) - 5) / 100.0)  # 0.20 to 0.30
    forecast_df["lower_bound"] = (forecast_df["predicted_quantity"] * (1 - interval_pct)).clip(lower=0)
    forecast_df["upper_bound"] = forecast_df["predicted_quantity"] * (1 + interval_pct)

    if forecast_df.empty:
        return {"daily_forecasts": [], "summary": {
            "total_quantity": 0, "total_revenue": 0, "days": 0, "products": 0, "stores": 0
        }}

    # Build response
    daily = forecast_df.to_dict(orient="records")
    for row in daily:
        row["date"] = str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"])

    summary = {
        "total_quantity": round(forecast_df["predicted_quantity"].sum(), 2),
        "total_revenue": round(forecast_df["predicted_revenue"].sum(), 2),
        "days": len(forecast_df["date"].unique()),
        "products": len(forecast_df["product_id"].unique()),
        "stores": len(forecast_df["store_id"].unique()),
        "channel": channel or "All",
    }

    # Log forecast
    from app.models.models import ForecastLog
    db = SessionLocal()
    try:
        log = ForecastLog(
            start_date=start_date,
            end_date=end_date,
            store_id=store_id,
            product_id=product_id,
            total_quantity=summary["total_quantity"],
            total_revenue=summary["total_revenue"],
        )
        db.add(log)
        db.commit()
    finally:
        db.close()

    return {"daily_forecasts": daily, "summary": summary}
