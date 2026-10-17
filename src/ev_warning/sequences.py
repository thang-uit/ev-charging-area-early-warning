"""Tạo chuỗi thời gian và chia dữ liệu theo thời gian."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


@dataclass
class SequenceSplit:
    """Một tập dữ liệu chuỗi cùng phần mô tả để kiểm tra kết quả."""

    x: np.ndarray
    y: np.ndarray
    meta: pd.DataFrame


def select_active_zones(
    frame: pd.DataFrame,
    threshold: float,
    max_zones: int | None = 60,
    min_positive_events: int = 10,
) -> list[str]:
    """Chọn các khu vực có đủ sự kiện gần đầy để đánh giá có ý nghĩa.

    Nếu max_zones là None, hàm giữ toàn bộ khu vực đạt điều kiện.
    """

    counts = (
        frame.assign(is_positive=frame["target_rate_next_hour"] >= threshold)
        .groupby("zone_id")["is_positive"]
        .sum()
        .sort_values(ascending=False)
    )
    active = counts[counts >= min_positive_events].index.astype(str).tolist()
    if max_zones is not None:
        active = active[:max_zones]
    return active


def make_sequences(
    frame: pd.DataFrame,
    feature_columns: list[str],
    sequence_length: int = 24,
    zones: list[str] | None = None,
    stride: int = 1,
) -> tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    """Tạo mẫu dạng (số mẫu, số giờ nhìn lại, số đặc trưng).

    stride cho phép lấy một cửa sổ sau mỗi vài giờ để giảm bộ nhớ khi chạy
    trên laptop. Chiều dài cửa sổ vẫn giữ nguyên.
    """

    if stride < 1:
        raise ValueError("stride phải lớn hơn hoặc bằng 1")

    source = frame if zones is None else frame[frame["zone_id"].isin(zones)]
    source = source.sort_values(["zone_id", "time"])

    sequences: list[np.ndarray] = []
    labels: list[int] = []
    metadata: list[dict[str, object]] = []

    for zone_id, zone_frame in source.groupby("zone_id", sort=False):
        values = zone_frame[feature_columns].to_numpy(dtype=np.float32)
        targets = zone_frame["target_near_full"].to_numpy(dtype=np.int64)
        target_rates = zone_frame["target_rate_next_hour"].to_numpy(dtype=np.float32)
        current_rates = zone_frame["occupancy_rate"].to_numpy(dtype=np.float32)
        times = zone_frame["time"].to_numpy()

        # Mỗi cửa sổ kết thúc tại thời điểm quan sát hiện tại.
        for end in range(sequence_length - 1, len(zone_frame), stride):
            start = end - sequence_length + 1
            sequences.append(values[start : end + 1])
            labels.append(int(targets[end]))
            metadata.append(
                {
                    "zone_id": str(zone_id),
                    "observation_time": times[end],
                    "target_time": times[end] + np.timedelta64(1, "h"),
                    "current_rate": float(current_rates[end]),
                    "target_rate_next_hour": float(target_rates[end]),
                }
            )

    return (
        np.stack(sequences).astype(np.float32),
        np.asarray(labels, dtype=np.int64),
        pd.DataFrame(metadata),
    )


def split_by_time(
    x: np.ndarray,
    y: np.ndarray,
    meta: pd.DataFrame,
    train_end: str,
    validation_end: str,
) -> dict[str, SequenceSplit]:
    """Chia theo thời gian, không trộn ngẫu nhiên các mốc tương lai vào train."""

    target_time = pd.to_datetime(meta["target_time"])
    train_mask = target_time < pd.Timestamp(train_end)
    validation_mask = (target_time >= pd.Timestamp(train_end)) & (
        target_time < pd.Timestamp(validation_end)
    )
    test_mask = target_time >= pd.Timestamp(validation_end)

    return {
        "train": SequenceSplit(x[train_mask], y[train_mask], meta.loc[train_mask].reset_index(drop=True)),
        "validation": SequenceSplit(
            x[validation_mask], y[validation_mask], meta.loc[validation_mask].reset_index(drop=True)
        ),
        "test": SequenceSplit(x[test_mask], y[test_mask], meta.loc[test_mask].reset_index(drop=True)),
    }


def fit_sequence_scaler(x_train: np.ndarray) -> StandardScaler:
    """Fit scaler chỉ trên train để tránh rò rỉ thống kê từ validation/test."""

    scaler = StandardScaler()
    scaler.fit(x_train.reshape(-1, x_train.shape[-1]))
    return scaler


def transform_sequences(x: np.ndarray, scaler: StandardScaler) -> np.ndarray:
    """Chuẩn hóa từng đặc trưng rồi giữ lại hình dạng chuỗi ban đầu."""

    shape = x.shape
    transformed = scaler.transform(x.reshape(-1, shape[-1]))
    return transformed.reshape(shape).astype(np.float32)


def flatten_last_state(x: np.ndarray) -> np.ndarray:
    """Tạo baseline dạng bảng từ toàn bộ 24 giờ nhìn lại."""

    return x.reshape(x.shape[0], -1)
