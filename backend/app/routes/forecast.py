from fastapi import APIRouter, HTTPException
from app.schemas.schemas import ForecastRequest
from app.services.forecasting import run_forecast

router = APIRouter()


@router.post("/forecast")
def forecast(req: ForecastRequest):
    """Forecast daily sales (quantity & revenue) for a date range."""
    if req.end_date < req.start_date:
        raise HTTPException(status_code=422, detail="end_date must be the same as or after start_date")

    try:
        result = run_forecast(
            start_date=req.start_date,
            end_date=req.end_date,
            store_id=req.store_id,
            product_id=req.product_id,
            channel=req.channel,
        )
        return result
    except ValueError as exc:
        message = str(exc)
        status = 503 if "Models not loaded" in message else 422
        raise HTTPException(status_code=status, detail=message)
