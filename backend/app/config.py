import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/forecast_db"
)

# Model storage path
MODEL_DIR = os.getenv("MODEL_DIR", os.path.join(os.path.dirname(__file__), "..", "saved_models"))

# Data path
DATA_PATH = os.getenv("DATA_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "Data", "data.csv"))

# Train/Val/Test split (days from start)
TRAIN_DAYS = 320
VAL_DAYS = 10
TEST_DAYS = 4

# Safety stock Z-score (95% service level)
Z_SCORE = 1.65

# Only train/forecast top N products by total quantity
TOP_N_PRODUCTS = 50

# Guardrails to avoid extremely long synchronous forecast calls
MAX_UNFILTERED_DAYS = int(os.getenv("MAX_UNFILTERED_DAYS", "31"))
MAX_FORECAST_POINTS = int(os.getenv("MAX_FORECAST_POINTS", "12000"))

# Post-model uplift applied to predictions (default: +7% to +8%)
PREDICTION_UPLIFT_MIN = float(os.getenv("PREDICTION_UPLIFT_MIN", "0.07"))
PREDICTION_UPLIFT_MAX = float(os.getenv("PREDICTION_UPLIFT_MAX", "0.08"))
