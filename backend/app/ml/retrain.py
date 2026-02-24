"""Retrain the model."""
from app.ml.train import train_model
from app.ml.model_loader import reload_model
import logging

logger = logging.getLogger(__name__)


def retrain_pipeline():
    """Run retraining and reload model."""
    logger.info("Starting retraining pipeline...")
    metrics = train_model()
    logger.info("Reloading model...")
    reload_model()
    logger.info("Retraining complete.")
    return metrics
