"""Evaluation metrics."""
import numpy as np


def compute_metrics(y_true, y_pred):
    """Compute WMAPE, MAE, RMSE, R², Accuracy.

    Uses Weighted MAPE (WMAPE) = sum(|errors|) / sum(|actuals|)
    instead of standard MAPE, because standard MAPE is unreliable
    when actual values are small (most products sell ~1 unit/day).
    """
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)

    # MAE
    mae = np.mean(np.abs(y_true - y_pred))

    # RMSE
    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))

    # Weighted MAPE (much more stable for low-volume data)
    total_actual = np.sum(np.abs(y_true))
    if total_actual > 0:
        wmape = (np.sum(np.abs(y_true - y_pred)) / total_actual) * 100
    else:
        wmape = 0.0

    # R²
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = 1 - (ss_res / max(ss_tot, 1e-10))

    # Accuracy = 100 - WMAPE (clamped to 0)
    accuracy = max(100 - wmape, 0)

    return {
        "mape": round(float(wmape), 2),
        "mae": round(float(mae), 4),
        "rmse": round(float(rmse), 4),
        "r2": round(float(r2), 4),
        "accuracy": round(float(accuracy), 2),
    }
