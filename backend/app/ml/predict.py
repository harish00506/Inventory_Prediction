"""Recursive multi-step forecasting with prediction intervals."""
import pandas as pd
import numpy as np
from datetime import timedelta
from app.ml.model_loader import get_models, get_le_store, get_le_product, get_avg_price, get_product_units
from app.services.feature_engineering import get_feature_columns
import logging

logger = logging.getLogger(__name__)


def recursive_forecast(historical_df, store_ids, product_ids, start_date, end_date):
    """
    Forecast with 3 quantile models: lower bound, median, upper bound.
    Returns predicted_quantity (median), lower_bound, upper_bound per day.
    """
    models = get_models()
    le_store = get_le_store()
    le_product = get_le_product()
    avg_price_df = get_avg_price()
    product_units = get_product_units() or {}

    if not models:
        raise ValueError("Models not loaded. Train first.")

    model_lower = models["lower"]
    model_median = models["median"]
    model_upper = models["upper"]

    combos = [(s, p) for s in store_ids for p in product_ids]
    if not combos:
        return pd.DataFrame()

    feature_cols = get_feature_columns()
    forecast_dates = pd.date_range(start=start_date, end=end_date, freq="D")
    results = []

    # Pre-compute aggregate stats from historical data
    prod_avg = historical_df.groupby("product_id")["quantity"].mean().to_dict()
    store_avg = historical_df.groupby("store_id")["quantity"].mean().to_dict()
    prod_std = historical_df.groupby("product_id")["quantity"].std().fillna(0).to_dict()

    for store_id, product_id in combos:
        hist = historical_df[
            (historical_df["store_id"] == store_id) &
            (historical_df["product_id"] == product_id)
        ].copy()

        # Product unit
        unit = product_units.get(product_id, "Piece")
        is_kg = 1 if unit == "Kilogram" else 0

        if hist.empty:
            for d in forecast_dates:
                results.append({
                    "date": d, "store_id": store_id, "product_id": product_id,
                    "predicted_quantity": 0, "lower_bound": 0, "upper_bound": 0,
                    "predicted_revenue": 0, "unit": unit,
                })
            continue

        hist = hist.sort_values("date")

        # Encode store/product
        try:
            s_enc = le_store.transform([store_id])[0]
        except ValueError:
            s_enc = 0
        try:
            p_enc = le_product.transform([product_id])[0]
        except ValueError:
            p_enc = 0

        # Avg price
        price_row = avg_price_df[
            (avg_price_df["store_id"] == store_id) &
            (avg_price_df["product_id"] == product_id)
        ]
        avg_price = float(price_row["avg_price"].iloc[0]) if len(price_row) > 0 else 0

        # Aggregate features
        p_avg = prod_avg.get(product_id, 0)
        s_avg = store_avg.get(store_id, 0)
        p_std = prod_std.get(product_id, 0)

        qty_series = list(hist["quantity"].values)

        for d in forecast_dates:
            d_ts = pd.Timestamp(d)
            n = len(qty_series)

            # Time features
            day_of_week = d_ts.dayofweek
            day_of_month = d_ts.day
            month = d_ts.month
            week_of_year = d_ts.isocalendar()[1]
            quarter = d_ts.quarter
            is_weekend = 1 if d_ts.dayofweek >= 5 else 0
            is_month_start = 1 if d_ts.day == 1 else 0
            is_month_end = 1 if (d_ts + timedelta(days=1)).day == 1 else 0

            # Lag features
            lag_1 = qty_series[-1] if n >= 1 else 0
            lag_2 = qty_series[-2] if n >= 2 else lag_1
            lag_3 = qty_series[-3] if n >= 3 else lag_1
            lag_7 = qty_series[-7] if n >= 7 else lag_1
            lag_14 = qty_series[-14] if n >= 14 else lag_1
            lag_28 = qty_series[-28] if n >= 28 else lag_1

            # Rolling features
            recent_3 = qty_series[-3:] if n >= 3 else qty_series
            recent_7 = qty_series[-7:] if n >= 7 else qty_series
            recent_14 = qty_series[-14:] if n >= 14 else qty_series
            recent_30 = qty_series[-30:] if n >= 30 else qty_series

            rolling_mean_3 = np.mean(recent_3) if recent_3 else 0
            rolling_mean_7 = np.mean(recent_7) if recent_7 else 0
            rolling_mean_14 = np.mean(recent_14) if recent_14 else 0
            rolling_mean_30 = np.mean(recent_30) if recent_30 else 0
            rolling_std_7 = np.std(recent_7) if len(recent_7) > 1 else 0
            rolling_std_30 = np.std(recent_30) if len(recent_30) > 1 else 0
            rolling_min_7 = min(recent_7) if recent_7 else 0
            rolling_max_7 = max(recent_7) if recent_7 else 0

            row = {
                "store_id_encoded": s_enc,
                "product_id_encoded": p_enc,
                "is_kg": is_kg,
                "day_of_week": day_of_week,
                "day_of_month": day_of_month,
                "month": month,
                "week_of_year": week_of_year,
                "quarter": quarter,
                "is_weekend": is_weekend,
                "is_month_start": is_month_start,
                "is_month_end": is_month_end,
                "lag_1": lag_1,
                "lag_2": lag_2,
                "lag_3": lag_3,
                "lag_7": lag_7,
                "lag_14": lag_14,
                "lag_28": lag_28,
                "rolling_mean_3": rolling_mean_3,
                "rolling_mean_7": rolling_mean_7,
                "rolling_mean_14": rolling_mean_14,
                "rolling_mean_30": rolling_mean_30,
                "rolling_std_7": rolling_std_7,
                "rolling_std_30": rolling_std_30,
                "rolling_min_7": rolling_min_7,
                "rolling_max_7": rolling_max_7,
                "product_avg_qty": p_avg,
                "store_avg_qty": s_avg,
                "product_std_qty": p_std,
            }

            X = pd.DataFrame([row])[feature_cols]

            # Predict with all 3 models
            pred_lower = max(float(model_lower.predict(X)[0]), 0)
            pred_median = max(float(model_median.predict(X)[0]), 0)
            pred_upper = max(float(model_upper.predict(X)[0]), 0)

            # Make sure bounds are ordered
            pred_lower = min(pred_lower, pred_median)
            pred_upper = max(pred_upper, pred_median)

            # Use median for recursive lag
            qty_series.append(pred_median)

            results.append({
                "date": d,
                "store_id": store_id,
                "product_id": product_id,
                "predicted_quantity": round(pred_median, 4),
                "lower_bound": round(pred_lower, 4),
                "upper_bound": round(pred_upper, 4),
                "predicted_revenue": round(pred_median * avg_price, 2),
                "unit": unit,
            })

    return pd.DataFrame(results)
