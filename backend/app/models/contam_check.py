from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ContamCheck(Base):
    """杂菌快检：每条 ClimateLog 最多一条，positive 联动出菇室进入 sanitize。"""

    __tablename__ = "contam_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    climate_log_id: Mapped[int] = mapped_column(
        ForeignKey("climate_logs.id"), nullable=False, unique=True, index=True
    )
    result: Mapped[str] = mapped_column(String(8), nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    climate_log: Mapped["ClimateLog"] = relationship(back_populates="contam_check")
