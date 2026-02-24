import argparse
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate deterministic omni-channel dummy sales data compatible with backend/ingest.py"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../Data/omnichannel_dummy.csv",
        help="Output CSV path (default: ../Data/omnichannel_dummy.csv when run from backend/)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=120,
        help="Number of days to generate (default: 120)",
    )
    parser.add_argument(
        "--start-date",
        type=str,
        default="2025-01-01",
        help="Start date in YYYY-MM-DD format (default: 2025-01-01)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Deterministic random seed (default: 42)",
    )
    parser.add_argument(
        "--source-csv",
        type=str,
        default="",
        help="Optional source CSV path (e.g., Data/data.csv) to derive omnichannel_dummy.csv from existing data",
    )
    return parser.parse_args()


def build_from_source(args):
    source_path = Path(args.source_csv)
    if not source_path.is_absolute():
        source_path = source_path.resolve()

    if not source_path.exists():
        raise FileNotFoundError(f"Source CSV not found: {source_path}")

    required_cols = [
        "Store ID",
        "Store Name",
        "Region",
        "Customer Phone",
        "Order ID",
        "Product ID",
        "Order Date",
        "Product",
        "Category",
        "Sub Category",
        "Brand",
        "Unit",
        "Quantity Ordered",
        "Base Price ",
        "Taxes ",
        "Gross Sale ",
    ]

    df = pd.read_csv(source_path, low_memory=False)
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        raise ValueError(f"Source CSV is missing required columns: {missing}")

    rng = np.random.default_rng(args.seed)
    channels = np.array(["Offline", "E-Commerce", "Quick-Commerce"])
    probs = np.array([0.42, 0.34, 0.24])
    df["Channel"] = rng.choice(channels, size=len(df), p=probs)

    df["Store ID"] = pd.to_numeric(df["Store ID"], errors="coerce").fillna(0).astype(int)
    df["Product ID"] = pd.to_numeric(df["Product ID"], errors="coerce").fillna(0).astype(int)
    df["Quantity Ordered"] = pd.to_numeric(df["Quantity Ordered"], errors="coerce").fillna(0)
    df["Base Price "] = pd.to_numeric(df["Base Price "].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df["Taxes "] = pd.to_numeric(df["Taxes "].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df["Gross Sale "] = pd.to_numeric(df["Gross Sale "].astype(str).str.replace(",", ""), errors="coerce").fillna(0)

    parsed_dates = pd.to_datetime(df["Order Date"], format="%d-%b-%y", errors="coerce", dayfirst=True)
    if parsed_dates.isna().any():
        alt = pd.to_datetime(df["Order Date"], errors="coerce", dayfirst=True)
        parsed_dates = parsed_dates.fillna(alt)
    if parsed_dates.notna().any():
        df.loc[parsed_dates.notna(), "Order Date"] = parsed_dates[parsed_dates.notna()].dt.strftime("%d-%b-%y")

    ordered_cols = required_cols + ["Channel"]
    return df[ordered_cols]


def build_master_data():
    stores = [
        {"store_id": 101, "store_name": "Downtown Hub", "region": "North"},
        {"store_id": 102, "store_name": "City Mall", "region": "North"},
        {"store_id": 201, "store_name": "Lakeview Outlet", "region": "West"},
        {"store_id": 202, "store_name": "Harbor Point", "region": "West"},
        {"store_id": 301, "store_name": "Central Plaza", "region": "South"},
        {"store_id": 302, "store_name": "Metro Corner", "region": "East"},
    ]

    products = [
        {"product_id": 1001, "product": "Basmati Rice 5kg", "category": "Grocery", "sub_category": "Staples", "brand": "DailyHarvest", "unit": "Piece", "base_price": 620},
        {"product_id": 1002, "product": "Whole Wheat Flour 5kg", "category": "Grocery", "sub_category": "Staples", "brand": "GrainGold", "unit": "Piece", "base_price": 280},
        {"product_id": 1003, "product": "Sunflower Oil 1L", "category": "Grocery", "sub_category": "Cooking Oils", "brand": "SunPure", "unit": "Piece", "base_price": 155},
        {"product_id": 1004, "product": "Toor Dal 1kg", "category": "Grocery", "sub_category": "Pulses", "brand": "FarmBasics", "unit": "Piece", "base_price": 140},
        {"product_id": 1005, "product": "Sugar 1kg", "category": "Grocery", "sub_category": "Sweeteners", "brand": "SweetCane", "unit": "Piece", "base_price": 48},
        {"product_id": 2001, "product": "Banana", "category": "Fruits & Veg", "sub_category": "Fruits", "brand": "FreshPick", "unit": "Kilogram", "base_price": 52},
        {"product_id": 2002, "product": "Tomato", "category": "Fruits & Veg", "sub_category": "Vegetables", "brand": "FreshPick", "unit": "Kilogram", "base_price": 36},
        {"product_id": 2003, "product": "Onion", "category": "Fruits & Veg", "sub_category": "Vegetables", "brand": "FarmRoot", "unit": "Kilogram", "base_price": 34},
        {"product_id": 3001, "product": "Milk 1L", "category": "Dairy", "sub_category": "Milk", "brand": "DairyDay", "unit": "Piece", "base_price": 62},
        {"product_id": 3002, "product": "Curd 400g", "category": "Dairy", "sub_category": "Curd", "brand": "DairyDay", "unit": "Piece", "base_price": 38},
        {"product_id": 4001, "product": "Potato Chips 52g", "category": "Snacks", "sub_category": "Chips", "brand": "Crunchy", "unit": "Piece", "base_price": 18},
        {"product_id": 4002, "product": "Biscuits 100g", "category": "Snacks", "sub_category": "Biscuits", "brand": "TeaTime", "unit": "Piece", "base_price": 24},
    ]

    channels = ["Offline", "E-Commerce", "Quick-Commerce"]

    return stores, products, channels


def simulate(args):
    rng = np.random.default_rng(args.seed)
    start = datetime.strptime(args.start_date, "%Y-%m-%d").date()
    stores, products, channels = build_master_data()

    rows = []
    order_seq = 1

    channel_multiplier = {
        "Offline": 1.00,
        "E-Commerce": 0.85,
        "Quick-Commerce": 0.65,
    }

    weekend_boost = {5: 1.18, 6: 1.28}
    month_boost = {11: 1.12, 12: 1.18}

    for day_idx in range(args.days):
        current_date = start + timedelta(days=day_idx)
        dow = current_date.weekday()

        for store in stores:
            region_factor = 1.0 + (store["store_id"] % 3) * 0.03

            for product in products:
                base_units = max(1.5, product["base_price"] / 80.0)
                demand_core = (12.0 / np.sqrt(base_units)) * region_factor

                day_factor = weekend_boost.get(dow, 1.0)
                seasonal_factor = month_boost.get(current_date.month, 1.0)

                for channel in channels:
                    ch_factor = channel_multiplier[channel]
                    mean_qty = demand_core * day_factor * seasonal_factor * ch_factor

                    promo = 1.0
                    if day_idx % 14 in (5, 6):
                        promo = 1.15 if channel != "Offline" else 1.08

                    expected = max(0.6, mean_qty * promo)

                    txn_count = int(rng.poisson(lam=max(1.0, expected / 2.2)))
                    txn_count = max(1, txn_count)

                    for _ in range(txn_count):
                        qty = max(0.05, rng.gamma(shape=2.0, scale=expected / (2.0 * txn_count)))
                        qty = round(qty, 3 if product["unit"] == "Kilogram" else 0)
                        if qty <= 0:
                            qty = 1 if product["unit"] == "Piece" else 0.1

                        price_noise = rng.normal(loc=1.0, scale=0.04)
                        unit_price = max(1.0, round(product["base_price"] * price_noise, 2))
                        gross_sale = round(float(qty) * unit_price, 2)

                        customer_phone = f"9{rng.integers(100000000, 999999999)}"
                        order_id = f"ORD-{current_date.strftime('%Y%m%d')}-{order_seq:07d}"
                        order_seq += 1

                        rows.append(
                            {
                                "Store ID": store["store_id"],
                                "Store Name": store["store_name"],
                                "Region": store["region"],
                                "Customer Phone": customer_phone,
                                "Order ID": order_id,
                                "Product ID": product["product_id"],
                                "Order Date": current_date.strftime("%d-%b-%y"),
                                "Product": product["product"],
                                "Category": product["category"],
                                "Sub Category": product["sub_category"],
                                "Brand": product["brand"],
                                "Unit": product["unit"],
                                "Quantity Ordered": qty,
                                "Base Price ": unit_price,
                                "Taxes ": round(gross_sale * 0.18, 2),
                                "Gross Sale ": gross_sale,
                                "Channel": channel,
                            }
                        )

    df = pd.DataFrame(rows)

    df["Store ID"] = df["Store ID"].astype(int)
    df["Product ID"] = df["Product ID"].astype(int)
    df["Quantity Ordered"] = pd.to_numeric(df["Quantity Ordered"], errors="coerce").fillna(0)
    df["Base Price "] = pd.to_numeric(df["Base Price "], errors="coerce").fillna(0)
    df["Gross Sale "] = pd.to_numeric(df["Gross Sale "], errors="coerce").fillna(0)

    ordered_cols = [
        "Store ID",
        "Store Name",
        "Region",
        "Customer Phone",
        "Order ID",
        "Product ID",
        "Order Date",
        "Product",
        "Category",
        "Sub Category",
        "Brand",
        "Unit",
        "Quantity Ordered",
        "Base Price ",
        "Taxes ",
        "Gross Sale ",
        "Channel",
    ]
    df = df[ordered_cols]

    out_path = Path(args.output)
    if not out_path.is_absolute():
        out_path = out_path.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(out_path, index=False)
    print(f"Generated {len(df):,} rows at: {out_path}")
    print(
        f"Date range: {start.strftime('%d-%b-%y')} to "
        f"{(start + timedelta(days=args.days - 1)).strftime('%d-%b-%y')}"
    )
    print("Channels:", ", ".join(sorted(df["Channel"].unique())))


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.days < 1:
        raise ValueError("--days must be >= 1")
    if arguments.source_csv:
        generated_df = build_from_source(arguments)
        out_path = Path(arguments.output)
        if not out_path.is_absolute():
            out_path = out_path.resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        generated_df.to_csv(out_path, index=False)
        print(f"Generated {len(generated_df):,} rows from source at: {out_path}")
        print("Channels:", ", ".join(sorted(generated_df["Channel"].unique())))
    else:
        simulate(arguments)
