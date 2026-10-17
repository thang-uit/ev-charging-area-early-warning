"""Mô hình học sâu chính của đồ án."""

from __future__ import annotations

import torch
from torch import nn


class LSTMClassifier(nn.Module):
    """Mạng LSTM cho bài toán cảnh báo nhị phân theo chuỗi thời gian.

    `sequence` có dạng ``(batch_size, sequence_length, input_size)``.
    LSTM đọc lần lượt từng giờ, sau đó lớp tuyến tính biến trạng thái
    cuối cùng thành một logit. Logit chưa phải xác suất, vì notebook dùng
    sigmoid khi suy luận và BCEWithLogitsLoss khi huấn luyện.
    """

    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()

        # LSTM tự học cách giữ hoặc bỏ thông tin qua các cổng bên trong.
        # `batch_first=True` giúp thứ tự kích thước dễ đọc là:
        # số mẫu, số bước thời gian, số đặc trưng.
        self.recurrent = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )

        # LayerNorm giúp trạng thái cuối ổn định hơn trước khi phân loại.
        # Linear(..., 1) trả về một số cho mỗi chuỗi đầu vào.
        self.classifier = nn.Sequential(
            nn.LayerNorm(hidden_size),
            nn.Linear(hidden_size, 1),
        )

    def forward(self, sequence: torch.Tensor) -> torch.Tensor:
        # `output[:, t, :]` là trạng thái LSTM sau khi đọc đến giờ t.
        output, _ = self.recurrent(sequence)

        # Trạng thái cuối là bản tóm tắt 24 giờ được đưa vào lớp phân loại.
        last_state = output[:, -1, :]
        return self.classifier(last_state).squeeze(-1)
