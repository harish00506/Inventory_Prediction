"""Inventory prediction service."""
import numpy as np
from sqlalchemy import text
from app.database import SessionLocal
from app.config import Z_SCORE
from app.services.forecasting import run_forecast
import logging
import pandas as pd

logger = logging.getLogger(__name__)

SERVICE_LEVEL_BY_ABC = {
    "A": 0.98,
    "B": 0.95,
    "C": 0.90,
}

Z_BY_ABC = {
    "A": 2.05,
    "B": 1.65,
    "C": 1.28,
}


def get_product_info():
    """Get product names, lead times, and units."""
    db = SessionLocal()
    try:
        result = db.execute(text(
            "SELECT product_id, product_name, lead_time, COALESCE(unit, 'Piece') FROM products"
        ))
        rows = result.fetchall()
        return {r[0]: {"name": r[1], "lead_time": r[2], "unit": r[3]} for r in rows}
    finally:
        db.close()


def get_historical_std(store_id=None, product_id=None):
    """Get avg and std dev of daily quantity for dynamic lead-time and safety stock calculation."""
    db = SessionLocal()
    try:
        query = (
            "SELECT store_id, product_id, "
            "COALESCE(AVG(quantity), 0) as avg_qty, "
            "COALESCE(STDDEV(quantity), 0) as std_qty "
            "FROM daily_sales"
        )
        conditions = []
        if store_id:
            conditions.append(f"store_id = {store_id}")
        if product_id:
            conditions.append(f"product_id = {product_id}")
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " GROUP BY store_id, product_id"

        result = db.execute(text(query))
        rows = result.fetchall()
        return {
            (r[0], r[1]): {
                "avg_qty": float(r[2]),
                "std_qty": float(r[3]),
            }
            for r in rows
        }
    finally:
        db.close()


def get_product_abc_map(product_ids=None):
    """Classify products into ABC classes by historical revenue contribution."""
    db = SessionLocal()
    try:
        query = """
            SELECT product_id, COALESCE(SUM(revenue), 0) as total_revenue
            FROM daily_sales
            GROUP BY product_id
            ORDER BY total_revenue DESC
        """
        rows = db.execute(text(query)).fetchall()
        if not rows:
            return {}

        grand_total = sum(float(r[1]) for r in rows)
        cumulative = 0.0
        abc_map = {}

        for row in rows:
            product_id_row = int(row[0])
            revenue = float(row[1])
            cumulative += revenue
            pct = (cumulative / grand_total * 100) if grand_total > 0 else 100

            if pct <= 70:
                abc_map[product_id_row] = "A"
            elif pct <= 90:
                abc_map[product_id_row] = "B"
            else:
                abc_map[product_id_row] = "C"

        if not product_ids:
            return abc_map
        return {pid: abc_map.get(pid, "C") for pid in product_ids}
    finally:
        db.close()


def compute_inventory(start_date, end_date, store_id=None, product_id=None, channel=None):
    """
    Compute inventory requirements.
    Required Inventory = Predicted Demand + Safety Stock
    Safety Stock = Z × std_dev × sqrt(lead_time)
    """
    logger.info(f"Computing inventory {start_date} to {end_date}, channel={channel}")

    # Get forecast
    forecast = run_forecast(start_date, end_date, store_id, product_id, channel=channel)
    daily_forecasts = forecast["daily_forecasts"]

    if not daily_forecasts:
        return {"items": [], "summary": {"total_demand": 0, "total_safety_stock": 0, "total_required": 0}}

    # Aggregate demand per store-product
    df = pd.DataFrame(daily_forecasts)
    demand = df.groupby(["store_id", "product_id"]).agg(
        predicted_demand=("predicted_quantity", "sum"),
        upper_demand=("upper_bound", "sum"),
    ).reset_index()

    num_days = max(1, (pd.Timestamp(end_date) - pd.Timestamp(start_date)).days + 1)

    # Get product info and historical std
    product_info = get_product_info()
    stats_map = get_historical_std(store_id, product_id)
    abc_map = get_product_abc_map(demand["product_id"].astype(int).unique().tolist())

    items = []
    for _, row in demand.iterrows():
        sid = int(row["store_id"])
        pid = int(row["product_id"])
        pred_demand = float(row["predicted_demand"])
        upper_demand = float(row["upper_demand"])

        info = product_info.get(pid, {"name": f"Product {pid}", "lead_time": 7, "unit": "Piece"})
        base_lead_time = int(info["lead_time"] or 7)
        stats = stats_map.get((sid, pid), {"avg_qty": 0.0, "std_qty": 0.0})
        std_qty = float(stats["std_qty"])
        avg_hist_qty = float(stats["avg_qty"])
        abc_class = abc_map.get(pid, "C")
        service_level = SERVICE_LEVEL_BY_ABC.get(abc_class, 0.95)
        z_value = Z_BY_ABC.get(abc_class, Z_SCORE)

        avg_daily_demand = pred_demand / num_days
        demand_signal = avg_daily_demand if avg_daily_demand > 0 else avg_hist_qty
        uncertainty_ratio = max(0.0, (upper_demand - pred_demand) / pred_demand) if pred_demand > 0 else 0.0
        demand_cv = (std_qty / demand_signal) if demand_signal > 0 else 0.0

        lead_multiplier = 1 + min(0.60, (0.40 * uncertainty_ratio) + (0.30 * demand_cv))
        dynamic_lead_time = max(1, int(round(base_lead_time * lead_multiplier)))

        safety_stock = z_value * std_qty * np.sqrt(dynamic_lead_time)
        required = pred_demand + safety_stock
        reorder_point = (avg_daily_demand * dynamic_lead_time) + safety_stock
        review_period_days = max(3, min(14, dynamic_lead_time))
        suggested_order_qty = (avg_daily_demand * review_period_days) + (0.5 * safety_stock)
        safety_coverage_days = (safety_stock / avg_daily_demand) if avg_daily_demand > 0 else 0.0

        if uncertainty_ratio >= 0.35 or safety_coverage_days < max(1, dynamic_lead_time * 0.30):
            action = "Order Now"
            stockout_risk = "High"
        elif uncertainty_ratio >= 0.20 or safety_coverage_days < max(1, dynamic_lead_time * 0.60):
            action = "Monitor Closely"
            stockout_risk = "Medium"
        else:
            action = "Stable"
            stockout_risk = "Low"

        items.append({
            "store_id": sid,
            "product_id": pid,
            "product_name": info["name"],
            "predicted_demand": round(pred_demand, 2),
            "safety_stock": round(safety_stock, 2),
            "required_inventory": round(required, 2),
            "lead_time": dynamic_lead_time,
            "unit": info["unit"],
            "abc_class": abc_class,
            "service_level_target": round(service_level * 100, 1),
            "reorder_point": round(reorder_point, 2),
            "base_lead_time": base_lead_time,
            "dynamic_lead_time": dynamic_lead_time,
            "review_period_days": review_period_days,
            "suggested_order_qty": round(suggested_order_qty, 2),
            "stockout_risk": stockout_risk,
            "recommended_action": action,
        })

    # Sort by required inventory descending
    items.sort(key=lambda x: x["required_inventory"], reverse=True)

    summary = {
        "total_demand": round(sum(i["predicted_demand"] for i in items), 2),
        "total_safety_stock": round(sum(i["safety_stock"] for i in items), 2),
        "total_required": round(sum(i["required_inventory"] for i in items), 2),
        "product_count": len(items),
        "order_now_count": sum(1 for i in items if i["recommended_action"] == "Order Now"),
        "monitor_count": sum(1 for i in items if i["recommended_action"] == "Monitor Closely"),
        "stable_count": sum(1 for i in items if i["recommended_action"] == "Stable"),
        "total_suggested_order_qty": round(sum(i["suggested_order_qty"] for i in items), 2),
    }

    return {"items": items, "summary": summary}
