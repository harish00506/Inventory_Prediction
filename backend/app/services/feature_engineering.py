"""Feature engineering for the forecasting model."""
import pandas as pd
import numpy as np


def add_time_features(df):
    """Add time-based features from the date column."""
    df = df.copy()
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_month"] = df["date"].dt.day
    df["month"] = df["date"].dt.month
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["quarter"] = df["date"].dt.quarter
    df["is_weekend"] = (df["date"].dt.dayofweek >= 5).astype(int)
    df["is_month_start"] = df["date"].dt.is_month_start.astype(int)
    df["is_month_end"] = df["date"].dt.is_month_end.astype(int)
    return df


def add_lag_features(df, group_cols=None, target="quantity", lags=None):
    """Add lag features grouped by store_id and product_id."""
    if group_cols is None:
        group_cols = ["store_id", "product_id"]
    if lags is None:
        lags = [1, 2, 3, 7, 14, 28]

    df = df.copy()
    df = df.sort_values(["store_id", "product_id", "date"])

    for lag in lags:
        df[f"lag_{lag}"] = df.groupby(group_cols)[target].shift(lag)

    return df


def add_rolling_features(df, group_cols=None, target="quantity"):
    """Add rolling window features."""
    if group_cols is None:
        group_cols = ["store_id", "product_id"]

    df = df.copy()
    df = df.sort_values(["store_id", "product_id", "date"])

    for window in [3, 7, 14, 30]:
        df[f"rolling_mean_{window}"] = (
            df.groupby(group_cols)[target]
            .transform(lambda x: x.shift(1).rolling(window, min_periods=1).mean())
        )

    df["rolling_std_7"] = (
        df.groupby(group_cols)[target]
        .transform(lambda x: x.shift(1).rolling(7, min_periods=1).std())
    )

    df["rolling_std_30"] = (
        df.groupby(group_cols)[target]
        .transform(lambda x: x.shift(1).rolling(30, min_periods=1).std())
    )

    df["rolling_min_7"] = (
        df.groupby(group_cols)[target]
        .transform(lambda x: x.shift(1).rolling(7, min_periods=1).min())
    )

    df["rolling_max_7"] = (
        df.groupby(group_cols)[target]
        .transform(lambda x: x.shift(1).rolling(7, min_periods=1).max())
    )

    return df


def add_aggregate_features(df):
    """Add product-level and store-level aggregate features."""
    df = df.copy()

    df["product_avg_qty"] = df.groupby("product_id")["quantity"].transform("mean")
    df["store_avg_qty"] = df.groupby("store_id")["quantity"].transform("mean")
    df["product_std_qty"] = df.groupby("product_id")["quantity"].transform("std").fillna(0)

    return df


def prepare_features(df):
    """Full feature engineering pipeline."""
    df = add_time_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)
    df = add_aggregate_features(df)
    return df


def get_feature_columns():
    """Return the list of feature column names used by the model."""
    return [
        "store_id_encoded",
        "product_id_encoded",
        "is_kg",
        "day_of_week",
        "day_of_month",
        "month",
        "week_of_year",
        "quarter",
        "is_weekend",
        "is_month_start",
        "is_month_end",
        "lag_1",
        "lag_2",
        "lag_3",
        "lag_7",
        "lag_14",
        "lag_28",
        "rolling_mean_3",
        "rolling_mean_7",
        "rolling_mean_14",
        "rolling_mean_30",
        "rolling_std_7",
        "rolling_std_30",
        "rolling_min_7",
        "rolling_max_7",
        "product_avg_qty",
        "store_avg_qty",
        "product_std_qty",
    ]
