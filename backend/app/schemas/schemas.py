from pydantic import BaseModel
from typing import Optional, List
from datetime import date


# --- Request Schemas ---

class ForecastRequest(BaseModel):
    start_date: date
    end_date: date
    store_id: Optional[int] = None
    product_id: Optional[int] = None
    channel: Optional[str] = None


class InventoryRequest(BaseModel):
    start_date: date
    end_date: date
    store_id: Optional[int] = None
    product_id: Optional[int] = None
    channel: Optional[str] = None


# --- Response Schemas ---

class DailyForecast(BaseModel):
    date: str
    store_id: int
    product_id: int
    predicted_quantity: float
    lower_bound: float
    upper_bound: float
    predicted_revenue: float
    unit: str


class ForecastResponse(BaseModel):
    daily_forecasts: List[DailyForecast]
    summary: dict


class InventoryItem(BaseModel):
    store_id: int
    product_id: int
    product_name: str
    predicted_demand: float
    safety_stock: float
    required_inventory: float
    lead_time: int
    unit: str
    abc_class: str
    service_level_target: float
    reorder_point: float
    base_lead_time: int
    dynamic_lead_time: int
    review_period_days: int
    suggested_order_qty: float
    stockout_risk: str
    recommended_action: str


class InventoryResponse(BaseModel):
    items: List[InventoryItem]
    summary: dict


class EvaluationResponse(BaseModel):
    mape: float
    accuracy: float
    mae: float
    rmse: float
    r2: float
    model_version: str
    trained_at: str


class ABCItem(BaseModel):
    product_id: int
    product_name: str
    total_revenue: float
    cumulative_pct: float
    abc_class: str


class TopProductItem(BaseModel):
    product_id: int
    product_name: str
    total_revenue: float
    total_quantity: float


class StoreItem(BaseModel):
    store_id: int
    store_name: str
    region: str


class ProductItem(BaseModel):
    product_id: int
    product_name: str
    category: str
    unit: str
