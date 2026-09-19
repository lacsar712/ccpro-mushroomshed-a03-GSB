"""杂菌快检 / 消毒解除的领域规则（路由与 seed 共用，避免规则只落在前端）。"""

from sqlalchemy.orm import Session

from app.models.release_note import ReleaseNote
from app.models.room import Room


class DomainError(Exception):
    def __init__(self, detail: str, status_code: int = 409):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def apply_contam_result(db: Session, room: Room, result: str) -> None:
    """按快检结果调整房态：positive → sanitize；suspect/clear 不动室。"""
    if result != "positive":
        return
    if room.status == "idle":
        raise DomainError("空闲（idle）出菇室禁止因快检结果进入 sanitize")
    room.status = "sanitize"


def ensure_can_leave_sanitize(db: Session, room: Room, new_status: str) -> None:
    """室离开 sanitize 必须已有 ReleaseNote，否则拒绝（409）。"""
    if room.status == "sanitize" and new_status != "sanitize":
        has_release = (
            db.query(ReleaseNote.id).filter(ReleaseNote.room_id == room.id).first()
        )
        if not has_release:
            raise DomainError("该室处于 sanitize，须先登记消毒解除记录才能改回其他状态")
