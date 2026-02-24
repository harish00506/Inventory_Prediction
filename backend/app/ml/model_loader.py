"""Load and cache 3 quantile models + encoders in memory."""
import os
import lightgbm as lgb
import joblib
import pandas as pd
from app.config import MODEL_DIR
import logging

logger = logging.getLogger(__name__)

# Global cache
_models = {}  # {"lower": ..., "median": ..., "upper": ...}
_le_store = None
_le_product = None
_avg_price = None
_top_product_ids = None
_product_units = None


def load_model():
    """Load all 3 quantile models and encoders from disk."""
    global _models, _le_store, _le_product, _avg_price, _top_product_ids, _product_units

    # Check for new 3-model format first, fallback to old single model
    median_path = os.path.join(MODEL_DIR, "lgb_median.txt")
    old_path = os.path.join(MODEL_DIR, "lightgbm_model.txt")

    if os.path.exists(median_path):
        logger.info("Loading 3 quantile models...")
        for name in ["lower", "median", "upper"]:
            path = os.path.join(MODEL_DIR, f"lgb_{name}.txt")
            _models[name] = lgb.Booster(model_file=path)
    elif os.path.exists(old_path):
        logger.info("Loading legacy single model...")
        single = lgb.Booster(model_file=old_path)
        _models = {"lower": single, "median": single, "upper": single}
    else:
        logger.warning("No model files found. Train the model first.")
        return False

    _le_store = joblib.load(os.path.join(MODEL_DIR, "le_store.pkl"))
    _le_product = joblib.load(os.path.join(MODEL_DIR, "le_product.pkl"))
    _avg_price = pd.read_pickle(os.path.join(MODEL_DIR, "avg_price.pkl"))

    top_ids_path = os.path.join(MODEL_DIR, "top_product_ids.pkl")
    if os.path.exists(top_ids_path):
        _top_product_ids = joblib.load(top_ids_path)

    units_path = os.path.join(MODEL_DIR, "product_units.pkl")
    if os.path.exists(units_path):
        _product_units = joblib.load(units_path)

    logger.info("Models loaded successfully.")
    return True


def get_model(name="median"):
    """Get a specific quantile model by name."""
    if not _models:
        load_model()
    return _models.get(name)


def get_models():
    """Get all 3 quantile models."""
    if not _models:
        load_model()
    return _models


def get_le_store():
    global _le_store
    if _le_store is None:
        load_model()
    return _le_store


def get_le_product():
    global _le_product
    if _le_product is None:
        load_model()
    return _le_product


def get_avg_price():
    global _avg_price
    if _avg_price is None:
        load_model()
    return _avg_price


def get_top_product_ids():
    global _top_product_ids
    if _top_product_ids is None:
        load_model()
    return _top_product_ids


def get_product_units():
    global _product_units
    if _product_units is None:
        load_model()
    return _product_units


def reload_model():
    """Force reload all models (after retraining)."""
    global _models, _le_store, _le_product, _avg_price, _top_product_ids, _product_units
    _models = {}
    _le_store = None
    _le_product = None
    _avg_price = None
    _top_product_ids = None
    _product_units = None
    return load_model()
