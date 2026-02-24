from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Index, Text
from sqlalchemy.sql import func
from app.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, unique=True, nullable=False)
    store_name = Column(String(255))
    region = Column(String(255))


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, unique=True, nullable=False)
    product_name = Column(String(500))
    category = Column(String(255))
    sub_category = Column(String(255))
    brand = Column(String(255))
    unit = Column(String(50), default="Piece")  # "Kilogram" or "Piece"
    lead_time = Column(Integer, default=7)  # days


class DailySales(Base):
    __tablename__ = "daily_sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    store_id = Column(Integer, nullable=False)
    product_id = Column(Integer, nullable=False)
    quantity = Column(Float, default=0)
    revenue = Column(Float, default=0)

    __table_args__ = (
        Index("idx_daily_sales_date", "date"),
        Index("idx_daily_sales_store", "store_id"),
        Index("idx_daily_sales_product", "product_id"),
        Index("idx_daily_sales_date_store_product", "date", "store_id", "product_id", unique=True),
    )


class ModelMetadata(Base):
    __tablename__ = "model_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_version = Column(String(100))
    trained_at = Column(DateTime, server_default=func.now())
    mape = Column(Float)
    mae = Column(Float)
    rmse = Column(Float)
    r2 = Column(Float)
    accuracy = Column(Float)
    notes = Column(Text)


class ForecastLog(Base):
    __tablename__ = "forecast_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    requested_at = Column(DateTime, server_default=func.now())
    start_date = Column(Date)
    end_date = Column(Date)
    store_id = Column(Integer, nullable=True)
    product_id = Column(Integer, nullable=True)
    total_quantity = Column(Float)
    total_revenue = Column(Float)


class CustomerOrder(Base):
    __tablename__ = "customer_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    store_id = Column(Integer, nullable=False)
    product_id = Column(Integer, nullable=False)
    customer_phone = Column(String(50), nullable=False)
    order_id = Column(String(100), nullable=False)
    quantity = Column(Float, default=0)
    revenue = Column(Float, default=0)

    __table_args__ = (
        Index("idx_customer_orders_date", "date"),
        Index("idx_customer_orders_phone", "customer_phone"),
    )
