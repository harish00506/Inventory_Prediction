from fastapi import APIRouter
from app.ml.retrain import retrain_pipeline

router = APIRouter()


@router.post("/retrain")
def retrain():
    """Trigger model retraining pipeline."""
    try:
        metrics = retrain_pipeline()
        return {"status": "success", "metrics": metrics}
    except Exception as e:
        return {"status": "error", "message": str(e)}
