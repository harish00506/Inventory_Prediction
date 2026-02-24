from fastapi import APIRouter
from sqlalchemy import text
from app.database import SessionLocal

router = APIRouter()


@router.get("/evaluation")
def evaluation():
    """Return latest model evaluation metrics."""
    db = SessionLocal()
    try:
        result = db.execute(text(
            "SELECT model_version, mape, mae, rmse, r2, accuracy, trained_at "
            "FROM model_metadata ORDER BY trained_at DESC LIMIT 1"
        ))
        row = result.fetchone()
        if not row:
            return {"error": "No model trained yet. Run POST /retrain first."}
        return {
            "model_version": row[0],
            "mape": row[1],
            "mae": row[2],
            "rmse": row[3],
            "r2": row[4],
            "accuracy": row[5],
            "trained_at": str(row[6]),
        }
    finally:
        db.close()
