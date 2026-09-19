from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.domain import DomainError, apply_contam_result
from app.models.climate_log import ClimateLog
from app.models.contam_check import ContamCheck
from app.schemas.contam_check import ContamCheckCreateSchema, ContamCheckOutSchema
from app.utils import validation_error_response

bp = Blueprint("contam_checks", __name__, url_prefix="/api/contam-checks")

create_schema = ContamCheckCreateSchema()
out_schema = ContamCheckOutSchema()
out_many = ContamCheckOutSchema(many=True)

DUPLICATE_DETAIL = "该环境记录已存在杂菌快检，每条环境记录最多一条快检"


@bp.get("")
@jwt_required()
def list_contam_checks():
    db = SessionLocal()
    try:
        q = db.query(ContamCheck)
        climate_log_id = request.args.get("climateLogId", type=int)
        room_id = request.args.get("roomId", type=int)
        if climate_log_id is not None:
            q = q.filter(ContamCheck.climate_log_id == climate_log_id)
        if room_id is not None:
            q = q.join(ClimateLog).filter(ClimateLog.room_id == room_id)
        rows = q.order_by(ContamCheck.checked_at.desc()).all()
        return jsonify(out_many.dump(rows))
    finally:
        db.close()


@bp.post("")
@jwt_required()
def create_contam_check():
    db = SessionLocal()
    try:
        try:
            data = create_schema.load(request.get_json(silent=True) or {})
        except ValidationError as err:
            return validation_error_response(err)
        log = (
            db.query(ClimateLog).filter(ClimateLog.id == data["climate_log_id"]).first()
        )
        if not log:
            return jsonify({"detail": "环境记录不存在"}), 400
        if (
            db.query(ContamCheck.id)
            .filter(ContamCheck.climate_log_id == log.id)
            .first()
        ):
            return jsonify({"detail": DUPLICATE_DETAIL}), 409

        item = ContamCheck(
            climate_log_id=log.id,
            result=data["result"],
            checked_at=data["checked_at"],
            message=data.get("message"),
        )
        db.add(item)
        try:
            # positive：所属 Room 联动进入 sanitize；idle 室拒绝；suspect/clear 不动室
            apply_contam_result(db, log.room, data["result"])
        except DomainError as e:
            db.rollback()
            return jsonify({"detail": e.detail}), e.status_code
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return jsonify({"detail": DUPLICATE_DETAIL}), 409
        db.refresh(item)
        return jsonify(out_schema.dump(item)), 201
    finally:
        db.close()
