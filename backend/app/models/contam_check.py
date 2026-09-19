from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ContamCheck(Base):
    __tablename__ = "contam_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    climate_log_id: Mapped[int] = mapped_column(
        ForeignKey("climate_logs.id"), nullable=False, unique=True
    )
    result: Mapped[str] = mapped_column(String(16), nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    climate_log: Mapped["ClimateLog"] = relationship(
        "ClimateLog", back_populates="contam_check"
    )
