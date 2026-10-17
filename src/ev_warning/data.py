"""Đọc và chuẩn hóa dữ liệu UrbanEV theo khu vực và theo giờ."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DEFAULT_THRESHOLD = 0.80
DEFAULT_SEQUENCE_LENGTH = 24

# Các biến đầu vào chỉ sử dụng thông tin đã biết ở thời điểm dự đoán.
FEATURE_COLUMNS = [
    "occupancy_rate",
    "volume_kwh",
    "duration_hours",
    "electricity_price",
    "service_price",
    "hour_sin",
    "hour_cos",
    "weekday_sin",
    "weekday_cos",
    "is_weekend",
    "capacity_log",
]


def _read_wide_table(path: Path, value_name: str) -> pd.DataFrame:
    """Đọc một bảng dạng rộng rồi đưa về dạng dài dễ ghép hơn."""

    # Cột đầu tiên là thời gian, các cột còn lại là mã khu vực.
    wide = pd.read_csv(path, parse_dates=["time"])

    # Mỗi hàng sau khi melt biểu diễn một khu vực tại một thời điểm.
    long = wide.melt(
        id_vars="time",
        var_name="zone_id",
        value_name=value_name,
    )

    # Giữ mã khu vực ở dạng chuỗi để tránh mất số 0 nếu dataset khác có mã đặc biệt.
    long["zone_id"] = long["zone_id"].astype(str)
    return long


def _add_time_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Tạo đặc trưng tuần hoàn cho giờ và ngày trong tuần."""

    result = frame.copy()
    hour = result["time"].dt.hour
    weekday = result["time"].dt.weekday

    # Sin/cos giúp 23 giờ và 0 giờ được xem là hai thời điểm gần nhau.
    result["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    result["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    result["weekday_sin"] = np.sin(2 * np.pi * weekday / 7)
    result["weekday_cos"] = np.cos(2 * np.pi * weekday / 7)
    result["is_weekend"] = (weekday >= 5).astype(float)

    # Log giúp giảm chênh lệch giữa khu vực ít và nhiều trụ sạc.
    result["capacity_log"] = np.log1p(result["charge_count"])
    return result


def load_panel_data(
    data_dir: str | Path,
    threshold: float = DEFAULT_THRESHOLD,
) -> pd.DataFrame:
    """Đọc dữ liệu theo giờ, tính tỷ lệ lấp đầy và tạo nhãn giờ kế tiếp.

    Nhãn của một dòng tại thời điểm t được lấy từ tỷ lệ lấp đầy tại t + 1.
    Như vậy khi mô hình dự đoán, nó không được nhìn thấy giá trị tương lai.
    """

    root = Path(data_dir)
    hourly = root / "charge_1hour"

    tables = [
        _read_wide_table(hourly / "occupancy.csv", "occupied_piles"),
        _read_wide_table(hourly / "duration.csv", "duration_hours"),
        _read_wide_table(hourly / "volume.csv", "volume_kwh"),
        _read_wide_table(hourly / "e_price.csv", "electricity_price"),
        _read_wide_table(hourly / "s_price.csv", "service_price"),
    ]

    panel = tables[0]
    for table in tables[1:]:
        panel = panel.merge(table, on=["time", "zone_id"], how="inner")

    # Thông tin tĩnh cho biết một khu vực có bao nhiêu trụ sạc.
    zone_info = pd.read_csv(root / "zone-information.csv")
    zone_info["TAZID"] = zone_info["TAZID"].astype(str)
    zone_info = zone_info.rename(columns={"TAZID": "zone_id"})
    panel = panel.merge(zone_info, on="zone_id", how="left", validate="many_to_one")

    # Không chia cho 0. Dataset hiện tại không có khu vực có sức chứa bằng 0.
    panel["occupancy_rate"] = (
        panel["occupied_piles"] / panel["charge_count"].clip(lower=1)
    ).clip(0, 1)

    panel = _add_time_features(panel)
    panel = panel.sort_values(["zone_id", "time"]).reset_index(drop=True)

    # shift(-1) lấy giá trị của giờ sau trong cùng khu vực.
    next_rate = panel.groupby("zone_id")["occupancy_rate"].shift(-1)
    panel["target_rate_next_hour"] = next_rate
    panel["target_near_full"] = (next_rate >= threshold).astype("float32")

    # Dòng cuối của từng khu vực không có giờ kế tiếp nên không có nhãn hợp lệ.
    panel = panel.dropna(subset=["target_rate_next_hour"]).reset_index(drop=True)
    panel["target_near_full"] = panel["target_near_full"].astype(int)
    return panel


def validate_panel_data(frame: pd.DataFrame) -> dict[str, object]:
    """Trả về các kiểm tra dữ liệu để notebook in ra và đưa vào báo cáo."""

    required = {
        "time",
        "zone_id",
        "occupied_piles",
        "charge_count",
        "occupancy_rate",
        "target_near_full",
        *FEATURE_COLUMNS,
    }
    missing_columns = sorted(required.difference(frame.columns))
    gaps = (
        frame.sort_values(["zone_id", "time"])
        .groupby("zone_id")["time"]
        .diff()
        .dropna()
        .dt.total_seconds()
        .div(3600)
    )

    return {
        "rows": int(len(frame)),
        "zones": int(frame["zone_id"].nunique()),
        "start": str(frame["time"].min()),
        "end": str(frame["time"].max()),
        "missing_values": int(frame.isna().sum().sum()),
        "missing_columns": missing_columns,
        "max_time_gap_hours": float(gaps.max()) if not gaps.empty else 0.0,
        "positive_rate": float(frame["target_near_full"].mean()),
        "occupancy_rate_min": float(frame["occupancy_rate"].min()),
        "occupancy_rate_max": float(frame["occupancy_rate"].max()),
    }
