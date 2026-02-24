import os
from typing import Optional

import pandas as pd

from app.config import DATA_PATH


def resolve_omnichannel_path(explicit_path: Optional[str] = None) -> str:
    if explicit_path:
        return explicit_path

    env_path = os.getenv("OMNICHANNEL_DATA_PATH")
    if env_path:
        return env_path

    data_dir = os.path.dirname(DATA_PATH)
    candidate = os.path.join(data_dir, "omnichannel_dummy.csv")
    if os.path.exists(candidate):
        return candidate

    return DATA_PATH


def get_omnichannel_overview(start_date: Optional[str] = None, end_date: Optional[str] = None, file_path: Optional[str] = None):
    path = resolve_omnichannel_path(file_path)

    usecols = [
        "Order Date",
        "Channel",
        "Region",
        "Store ID",
        "Product",
        "Quantity Ordered",
        "Taxes ",
        "Gross Sale ",
    ]

    df = pd.read_csv(path, usecols=usecols, low_memory=False)
    if "Channel" not in df.columns:
        raise ValueError("Channel column not found. Generate omnichannel_dummy.csv first.")

    df["Order Date"] = pd.to_datetime(df["Order Date"], format="%d-%b-%y", errors="coerce", dayfirst=True)
    df["Quantity Ordered"] = pd.to_numeric(df["Quantity Ordered"], errors="coerce").fillna(0)
    df["Taxes "] = pd.to_numeric(df["Taxes "].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df["Gross Sale "] = pd.to_numeric(df["Gross Sale "].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df = df.dropna(subset=["Order Date"])

    if start_date:
        start_ts = pd.Timestamp(start_date)
        df = df[df["Order Date"] >= start_ts]
    if end_date:
        end_ts = pd.Timestamp(end_date)
        df = df[df["Order Date"] <= end_ts]

    if df.empty:
        return {
            "summary": {"orders": 0, "quantity": 0, "revenue": 0, "channels": 0, "regions": 0, "stores": 0},
            "channel_summary": [],
            "region_channel_revenue": [],
            "top_products_by_channel": [],
            "channel_mix": [],
            "logistics_actions": [],
        }

    channel_group = (
        df.groupby("Channel", as_index=False)
        .agg(
            orders=("Channel", "count"),
            quantity=("Quantity Ordered", "sum"),
            revenue=("Gross Sale ", "sum"),
        )
        .sort_values("revenue", ascending=False)
    )
    channel_group["avg_order_value"] = channel_group["revenue"] / channel_group["orders"].clip(lower=1)

    total_orders = int(len(df))
    total_qty = float(df["Quantity Ordered"].sum())
    total_tax = float(df["Taxes "].sum())
    total_revenue = float(df["Gross Sale "].sum())

    region_channel = (
        df.groupby(["Region", "Channel"], as_index=False)["Gross Sale "]
        .sum()
        .rename(columns={"Gross Sale ": "revenue"})
        .sort_values(["Region", "revenue"], ascending=[True, False])
    )

    top_products = (
        df.groupby(["Channel", "Product"], as_index=False)
        .agg(revenue=("Gross Sale ", "sum"), quantity=("Quantity Ordered", "sum"))
        .sort_values(["Channel", "revenue"], ascending=[True, False])
    )
    top_products = top_products.groupby("Channel").head(5)

    channel_mix = channel_group.copy()
    channel_mix["order_share_pct"] = (channel_mix["orders"] / max(1, total_orders) * 100).round(2)

    logistics_actions = []
    for _, row in channel_group.iterrows():
        channel = row["Channel"]
        share_pct = (row["orders"] / max(1, total_orders)) * 100

        if channel == "Quick-Commerce":
            action = "Keep micro-fulfillment buffer high and trigger 2-3 replenishment runs per day."
        elif channel == "E-Commerce":
            action = "Consolidate line-haul batches and maintain next-day dispatch reserve."
        else:
            action = "Balance shelf availability with weekly safety stock rebalancing."

        logistics_actions.append({
            "channel": channel,
            "order_share_pct": round(share_pct, 2),
            "recommended_action": action,
        })

    return {
        "summary": {
            "orders": total_orders,
            "quantity": round(total_qty, 2),
            "revenue": round(total_revenue, 2),
            "tax_total": round(total_tax, 2),
            "channels": int(df["Channel"].nunique()),
            "regions": int(df["Region"].nunique()),
            "stores": int(df["Store ID"].nunique()),
        },
        "channel_summary": [
            {
                "channel": r["Channel"],
                "orders": int(r["orders"]),
                "quantity": round(float(r["quantity"]), 2),
                "revenue": round(float(r["revenue"]), 2),
                "avg_order_value": round(float(r["avg_order_value"]), 2),
            }
            for _, r in channel_group.iterrows()
        ],
        "region_channel_revenue": [
            {
                "region": r["Region"],
                "channel": r["Channel"],
                "revenue": round(float(r["revenue"]), 2),
            }
            for _, r in region_channel.iterrows()
        ],
        "top_products_by_channel": [
            {
                "channel": r["Channel"],
                "product": r["Product"],
                "revenue": round(float(r["revenue"]), 2),
                "quantity": round(float(r["quantity"]), 2),
            }
            for _, r in top_products.iterrows()
        ],
        "channel_mix": [
            {
                "channel": r["Channel"],
                "orders": int(r["orders"]),
                "order_share_pct": float(r["order_share_pct"]),
            }
            for _, r in channel_mix.iterrows()
        ],
        "logistics_actions": logistics_actions,
    }


def get_channel_quantity_share(channel: Optional[str], start_date: Optional[str] = None, end_date: Optional[str] = None, file_path: Optional[str] = None) -> float:
    if not channel:
        return 1.0

    valid = {"Offline", "E-Commerce", "Quick-Commerce"}
    if channel not in valid:
        raise ValueError(f"Invalid channel '{channel}'. Valid values: {sorted(valid)}")

    path = resolve_omnichannel_path(file_path)
    df = pd.read_csv(path, usecols=["Order Date", "Channel", "Quantity Ordered"], low_memory=False)
    if "Channel" not in df.columns:
        raise ValueError("Channel column not found. Generate omnichannel_dummy.csv first.")

    df["Order Date"] = pd.to_datetime(df["Order Date"], format="%d-%b-%y", errors="coerce", dayfirst=True)
    df["Quantity Ordered"] = pd.to_numeric(df["Quantity Ordered"], errors="coerce").fillna(0)
    df = df.dropna(subset=["Order Date"])

    if start_date:
        df = df[df["Order Date"] >= pd.Timestamp(start_date)]
    if end_date:
        df = df[df["Order Date"] <= pd.Timestamp(end_date)]

    if df.empty:
        return 0.0

    total_qty = float(df["Quantity Ordered"].sum())
    if total_qty <= 0:
        return 0.0

    channel_qty = float(df[df["Channel"] == channel]["Quantity Ordered"].sum())
    return max(0.0, min(1.0, channel_qty / total_qty))
