"""Các chỉ số đánh giá cho đầu ra xác suất."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)


def evaluate_probabilities(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    threshold: float = 0.5,
) -> dict[str, float]:
    """Tính metric cho bài toán phân loại mất cân bằng."""

    y_true = np.asarray(y_true).astype(int)
    probabilities = np.asarray(probabilities).clip(1e-7, 1 - 1e-7)
    predictions = (probabilities >= threshold).astype(int)

    result = {
        "log_loss": float(log_loss(y_true, probabilities, labels=[0, 1])),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "pr_auc": float(average_precision_score(y_true, probabilities)),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall": float(recall_score(y_true, predictions, zero_division=0)),
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
    }

    # ROC-AUC không xác định nếu tập đánh giá chỉ có một lớp.
    result["roc_auc"] = (
        float(roc_auc_score(y_true, probabilities))
        if len(np.unique(y_true)) == 2
        else float("nan")
    )
    return result
