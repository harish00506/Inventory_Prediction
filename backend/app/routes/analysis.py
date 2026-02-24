from fastapi import APIRouter
from sqlalchemy import text
from app.database import SessionLocal
from datetime import datetime

router = APIRouter()


@router.get("/abc-analysis")
def abc_analysis():
    """ABC analysis based on revenue contribution."""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT p.product_id, p.product_name,
                   COALESCE(SUM(ds.revenue), 0) as total_revenue
            FROM products p
            LEFT JOIN daily_sales ds ON p.product_id = ds.product_id
            GROUP BY p.product_id, p.product_name
            ORDER BY total_revenue DESC
        """))
        rows = result.fetchall()

        if not rows:
            return {"items": []}

        grand_total = sum(r[2] for r in rows)
        items = []
        cumulative = 0

        for row in rows:
            cumulative += row[2]
            pct = (cumulative / grand_total * 100) if grand_total > 0 else 0

            if pct <= 70:
                abc_class = "A"
            elif pct <= 90:
                abc_class = "B"
            else:
                abc_class = "C"

            items.append({
                "product_id": row[0],
                "product_name": row[1],
                "total_revenue": round(row[2], 2),
                "cumulative_pct": round(pct, 2),
                "abc_class": abc_class,
            })

        summary = {
            "A_count": sum(1 for i in items if i["abc_class"] == "A"),
            "B_count": sum(1 for i in items if i["abc_class"] == "B"),
            "C_count": sum(1 for i in items if i["abc_class"] == "C"),
            "total_products": len(items),
        }

        return {"items": items, "summary": summary}
    finally:
        db.close()


@router.get("/top-products")
def top_products():
    """Top 10 products by revenue."""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT p.product_id, p.product_name,
                   COALESCE(SUM(ds.revenue), 0) as total_revenue,
                   COALESCE(SUM(ds.quantity), 0) as total_quantity
            FROM products p
            LEFT JOIN daily_sales ds ON p.product_id = ds.product_id
            GROUP BY p.product_id, p.product_name
            ORDER BY total_revenue DESC
            LIMIT 10
        """))
        rows = result.fetchall()
        items = [{
            "product_id": r[0],
            "product_name": r[1],
            "total_revenue": round(r[2], 2),
            "total_quantity": round(r[3], 2),
        } for r in rows]
        return {"items": items}
    finally:
        db.close()


@router.get("/stores")
def get_stores():
    """Get all stores."""
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT store_id, store_name, region FROM stores ORDER BY store_id"))
        rows = result.fetchall()
        return {"stores": [{"store_id": r[0], "store_name": r[1], "region": r[2]} for r in rows]}
    finally:
        db.close()


@router.get("/products")
def get_products():
    """Get top products by quantity (only products the model was trained on)."""
    from app.config import TOP_N_PRODUCTS
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT p.product_id, p.product_name, p.category, p.unit,
                   COALESCE(SUM(ds.quantity), 0) as total_qty
            FROM products p
            LEFT JOIN daily_sales ds ON p.product_id = ds.product_id
            GROUP BY p.product_id, p.product_name, p.category, p.unit
            ORDER BY total_qty DESC
            LIMIT :limit
        """), {"limit": TOP_N_PRODUCTS})
        rows = result.fetchall()
        return {"products": [{
            "product_id": r[0],
            "product_name": r[1],
            "category": r[2],
            "unit": r[3] or "Piece",
        } for r in rows]}
    finally:
        db.close()


@router.get("/forecast-logs")
def get_forecast_logs():
    """Get recent forecast logs."""
    db = SessionLocal()
    try:
        result = db.execute(text(
            "SELECT id, requested_at, start_date, end_date, store_id, product_id, total_quantity, total_revenue "
            "FROM forecast_logs ORDER BY requested_at DESC LIMIT 50"
        ))
        rows = result.fetchall()
        return {"logs": [{
            "id": r[0], "requested_at": str(r[1]), "start_date": str(r[2]),
            "end_date": str(r[3]), "store_id": r[4], "product_id": r[5],
            "total_quantity": r[6], "total_revenue": r[7],
        } for r in rows]}
    finally:
        db.close()


@router.post("/actual-sales")
def get_actual_sales(body: dict):
    """Get actual daily sales for a date range (for comparison with forecast)."""
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    store_id = body.get("store_id")
    product_id = body.get("product_id")

    if not start_date or not end_date:
        return {"daily": []}

    db = SessionLocal()
    try:
        query = """
            SELECT date, SUM(quantity) as total_qty, SUM(revenue) as total_rev
            FROM daily_sales
            WHERE date >= :start AND date <= :end
        """
        params = {"start": start_date, "end": end_date}

        if store_id:
            query += " AND store_id = :sid"
            params["sid"] = store_id
        if product_id:
            query += " AND product_id = :pid"
            params["pid"] = product_id

        query += " GROUP BY date ORDER BY date"

        result = db.execute(text(query), params)
        rows = result.fetchall()
        return {"daily": [
            {"date": str(r[0]), "actual_quantity": round(float(r[1]), 4), "actual_revenue": round(float(r[2]), 2)}
            for r in rows
        ]}
    finally:
        db.close()


@router.post("/actual-sales-prev-years")
def get_actual_sales_prev_years(body: dict):
    """Get previous-years actual sales aligned to requested dates (same month/day, latest previous year value)."""
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    store_id = body.get("store_id")
    product_id = body.get("product_id")

    if not start_date or not end_date:
        return {"daily": []}

    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        return {"daily": []}

    if end_dt < start_dt:
        return {"daily": []}

    db = SessionLocal()
    try:
        query = """
            SELECT date, SUM(quantity) as total_qty
            FROM daily_sales
            WHERE date <= :end
        """
        params = {"end": end_date}

        if store_id:
            query += " AND store_id = :sid"
            params["sid"] = store_id
        if product_id:
            query += " AND product_id = :pid"
            params["pid"] = product_id

        query += " GROUP BY date ORDER BY date"

        result = db.execute(text(query), params)
        rows = result.fetchall()

        history_by_md = {}
        for row in rows:
            row_date = row[0]
            qty = float(row[1] or 0)

            if not row_date:
                continue

            if isinstance(row_date, str):
                try:
                    row_date = datetime.strptime(row_date[:10], "%Y-%m-%d").date()
                except ValueError:
                    continue
            else:
                row_date = row_date

            md_key = (row_date.month, row_date.day)
            if md_key not in history_by_md:
                history_by_md[md_key] = {}
            history_by_md[md_key][row_date.year] = qty

        aligned = []
        current = start_dt
        while current <= end_dt:
            md_key = (current.month, current.day)
            yearly_values = history_by_md.get(md_key, {})

            chosen_qty = None
            chosen_year = None
            for year in range(current.year - 1, 1999, -1):
                if year in yearly_values:
                    chosen_qty = yearly_values[year]
                    chosen_year = year
                    break

            aligned.append({
                "date": str(current),
                "actual_quantity_prev_years": round(chosen_qty, 4) if chosen_qty is not None else None,
                "source_year": chosen_year,
            })
            current = current.fromordinal(current.toordinal() + 1)

        return {"daily": aligned}
    finally:
        db.close()


@router.get("/top-products-by-date")
def top_products_by_date(start_date: str = "", end_date: str = "", limit: int = 10):
    """Top performing products by revenue in a date range."""
    if not start_date or not end_date:
        return {"items": []}

    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT p.product_id, p.product_name,
                   COALESCE(SUM(ds.revenue), 0) as total_revenue,
                   COALESCE(SUM(ds.quantity), 0) as total_quantity
            FROM products p
            JOIN daily_sales ds ON p.product_id = ds.product_id
            WHERE ds.date >= :start AND ds.date <= :end
            GROUP BY p.product_id, p.product_name
            ORDER BY total_revenue DESC
            LIMIT :limit
        """), {"start": start_date, "end": end_date, "limit": limit})
        rows = result.fetchall()
        items = [{
            "rank": i + 1,
            "product_id": r[0],
            "product_name": r[1],
            "total_revenue": round(float(r[2]), 2),
            "total_quantity": round(float(r[3]), 2),
        } for i, r in enumerate(rows)]
        return {"items": items}
    finally:
        db.close()


@router.get("/bottom-products-by-date")
def bottom_products_by_date(start_date: str = "", end_date: str = "", limit: int = 10):
    """Bottom performing products by revenue in a date range (only products with sales > 0)."""
    if not start_date or not end_date:
        return {"items": []}

    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT p.product_id, p.product_name,
                   COALESCE(SUM(ds.revenue), 0) as total_revenue,
                   COALESCE(SUM(ds.quantity), 0) as total_quantity
            FROM products p
            JOIN daily_sales ds ON p.product_id = ds.product_id
            WHERE ds.date >= :start AND ds.date <= :end
            GROUP BY p.product_id, p.product_name
            HAVING SUM(ds.revenue) > 0
            ORDER BY total_revenue ASC
            LIMIT :limit
        """), {"start": start_date, "end": end_date, "limit": limit})
        rows = result.fetchall()
        items = [{
            "rank": i + 1,
            "product_id": r[0],
            "product_name": r[1],
            "total_revenue": round(float(r[2]), 2),
            "total_quantity": round(float(r[3]), 2),
        } for i, r in enumerate(rows)]
        return {"items": items}
    finally:
        db.close()


@router.get("/customer-portfolio")
def customer_portfolio(start_date: str = "", end_date: str = ""):
    """Customer portfolio: summary, top customers, and lost customers."""
    if not start_date or not end_date:
        return {"summary": {}, "top_customers": [], "lost_customers": []}

    db = SessionLocal()
    try:
        # Summary stats for the date range
        summary_result = db.execute(text("""
            SELECT
                COUNT(DISTINCT customer_phone) as total_customers,
                COUNT(DISTINCT order_id) as total_orders,
                COALESCE(SUM(revenue), 0) as total_revenue
            FROM customer_orders
            WHERE date >= :start AND date <= :end
        """), {"start": start_date, "end": end_date})
        s = summary_result.fetchone()
        summary = {
            "total_customers": s[0] if s else 0,
            "total_orders": s[1] if s else 0,
            "total_revenue": round(float(s[2]), 2) if s else 0,
        }

        # Top 10 customers by revenue in date range
        top_result = db.execute(text("""
            SELECT customer_phone,
                   COUNT(DISTINCT order_id) as order_count,
                   COALESCE(SUM(revenue), 0) as total_revenue,
                   COALESCE(SUM(quantity), 0) as total_quantity
            FROM customer_orders
            WHERE date >= :start AND date <= :end
            GROUP BY customer_phone
            ORDER BY total_revenue DESC
            LIMIT 10
        """), {"start": start_date, "end": end_date})
        top_rows = top_result.fetchall()
        top_customers = [{
            "rank": i + 1,
            "customer_phone": str(r[0]),
            "order_count": r[1],
            "total_revenue": round(float(r[2]), 2),
            "total_quantity": round(float(r[3]), 2),
        } for i, r in enumerate(top_rows)]

        # Lost customers: ordered BEFORE start_date but NOT during this date range
        lost_result = db.execute(text("""
            SELECT customer_phone,
                   MAX(date) as last_order_date,
                   COUNT(DISTINCT order_id) as past_orders,
                   COALESCE(SUM(revenue), 0) as past_revenue
            FROM customer_orders
            WHERE date < :start
              AND customer_phone NOT IN (
                  SELECT DISTINCT customer_phone
                  FROM customer_orders
                  WHERE date >= :start AND date <= :end
              )
            GROUP BY customer_phone
            ORDER BY past_revenue DESC
            LIMIT 20
        """), {"start": start_date, "end": end_date})
        lost_rows = lost_result.fetchall()
        lost_customers = [{
            "customer_phone": str(r[0]),
            "last_order_date": str(r[1]),
            "past_orders": r[2],
            "past_revenue": round(float(r[3]), 2),
        } for r in lost_rows]

        return {
            "summary": summary,
            "top_customers": top_customers,
            "lost_customers": lost_customers,
        }
    finally:
        db.close()

