"""
Data ingestion script: reads data.csv, aggregates, and loads into PostgreSQL.
Run this once after database is created.
Usage: python -m ingest
"""
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.config import DATA_PATH, DATABASE_URL
from app.database import engine, Base, SessionLocal
from app.models.models import Store, Product, DailySales, CustomerOrder
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_ingestion():
    logger.info("Creating tables...")
    Base.metadata.create_all(bind=engine)

    logger.info(f"Reading CSV from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH, low_memory=False)
    logger.info(f"Raw rows: {len(df)}")

    # Parse date
    df["Order Date"] = pd.to_datetime(df["Order Date"], format="%d-%b-%y", dayfirst=True)

    # Clean numeric columns
    df["Quantity Ordered"] = pd.to_numeric(df["Quantity Ordered"], errors="coerce").fillna(0)
    df["Gross Sale "] = pd.to_numeric(
        df["Gross Sale "].astype(str).str.replace(",", ""), errors="coerce"
    ).fillna(0)

    # Rename for convenience
    df = df.rename(columns={
        "Store ID": "store_id",
        "Store Name": "store_name",
        "Region": "region",
        "Product ID": "product_id",
        "Order Date": "date",
        "Product": "product_name",
        "Category": "category",
        "Sub Category": "sub_category",
        "Brand": "brand",
        "Unit": "unit",
        "Quantity Ordered": "quantity",
        "Gross Sale ": "revenue",
        "Base Price ": "base_price",
        "Customer Phone": "customer_phone",
        "Order ID": "order_id",
    })

    # --- Insert Stores ---
    logger.info("Inserting stores...")
    stores_df = df[["store_id", "store_name", "region"]].drop_duplicates(subset=["store_id"])
    db = SessionLocal()
    try:
        for _, row in stores_df.iterrows():
            existing = db.query(Store).filter(Store.store_id == int(row["store_id"])).first()
            if not existing:
                db.add(Store(
                    store_id=int(row["store_id"]),
                    store_name=str(row["store_name"]),
                    region=str(row["region"]),
                ))
        db.commit()
        logger.info(f"Stores inserted: {stores_df.shape[0]}")

        # --- Insert Products ---
        logger.info("Inserting products...")
        # Get the most common unit per product (Kilogram or Piece)
        product_units = df.groupby("product_id")["unit"].agg(lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else "Piece")
        products_df = df[["product_id", "product_name", "category", "sub_category", "brand"]].drop_duplicates(subset=["product_id"])
        np.random.seed(42)
        for _, row in products_df.iterrows():
            pid = int(row["product_id"])
            existing = db.query(Product).filter(Product.product_id == pid).first()
            if not existing:
                unit_val = product_units.get(pid, "Piece")
                db.add(Product(
                    product_id=pid,
                    product_name=str(row["product_name"]),
                    category=str(row["category"]),
                    sub_category=str(row["sub_category"]),
                    brand=str(row["brand"]),
                    unit=str(unit_val),
                    lead_time=int(np.random.randint(3, 15)),
                ))
        db.commit()
        logger.info(f"Products inserted: {products_df.shape[0]}")

        # --- Aggregate Daily Sales ---
        logger.info("Aggregating daily sales...")
        daily = df.groupby(["date", "store_id", "product_id"]).agg(
            quantity=("quantity", "sum"),
            revenue=("revenue", "sum"),
        ).reset_index()

        logger.info(f"Daily aggregated rows: {len(daily)}")

        # Insert in batches
        batch_size = 5000
        total = len(daily)
        for i in range(0, total, batch_size):
            batch = daily.iloc[i:i + batch_size]
            records = []
            for _, row in batch.iterrows():
                records.append(DailySales(
                    date=row["date"].date(),
                    store_id=int(row["store_id"]),
                    product_id=int(row["product_id"]),
                    quantity=float(row["quantity"]),
                    revenue=float(row["revenue"]),
                ))
            db.bulk_save_objects(records)
            db.commit()
            logger.info(f"  Inserted {min(i + batch_size, total)}/{total} rows")

        # --- Insert Customer Orders ---
        logger.info("Inserting customer orders...")
        cust_df = df[["date", "store_id", "product_id", "customer_phone", "order_id", "quantity", "revenue"]].copy()
        cust_df = cust_df.dropna(subset=["customer_phone"])
        cust_df["customer_phone"] = cust_df["customer_phone"].astype(str).str.strip()
        cust_df["order_id"] = cust_df["order_id"].astype(str).str.strip()

        total_cust = len(cust_df)
        for i in range(0, total_cust, batch_size):
            batch = cust_df.iloc[i:i + batch_size]
            records = []
            for _, row in batch.iterrows():
                records.append(CustomerOrder(
                    date=row["date"].date(),
                    store_id=int(row["store_id"]),
                    product_id=int(row["product_id"]),
                    customer_phone=str(row["customer_phone"]),
                    order_id=str(row["order_id"]),
                    quantity=float(row["quantity"]),
                    revenue=float(row["revenue"]),
                ))
            db.bulk_save_objects(records)
            db.commit()
            logger.info(f"  Customer orders: {min(i + batch_size, total_cust)}/{total_cust} rows")

        logger.info("Data ingestion complete!")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during ingestion: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_ingestion()

