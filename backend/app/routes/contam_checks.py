from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models.climate_log import ClimateLog
from app.models.contam_check import ContamCheck
from app.schemas.contam_check import ContamCheckCreateSchema, ContamCheckOutSchema
from app.utils import validation_error_response

bp = Blueprint("contam_checks", __name__, url_prefix="/api/contam-checks")

create_schema = ContamCheckCreateSchema()
out_schema = ContamCheckOutSchema()
out_many = ContamCheckOutSchema(many=True)


@bp.get("")
@jwt_required()
def list_contam_checks():
    db = SessionLocal()
    try:
        climate_log_id = request.args.get("climateLogId", type=int)
        room_id = request.args.get("roomId", type=int)
        q = db.query(ContamCheck)
        if climate_log_id is not None:
            q = q.filter(ContamCheck.climate_log_id == climate_log_id)
        if room_id is not None:
            q = q.join(ClimateLog, ContamCheck.climate_log_id == ClimateLog.id).filter(
                ClimateLog.room_id == room_id
            )
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
        log = db.query(ClimateLog).filter(ClimateLog.id == data["climate_log_id"]).first()
        if not log:
            return jsonify({"detail": "环境记录不存在"}), 400
        existing = (
            db.query(ContamCheck)
            .filter(ContamCheck.climate_log_id == log.id)
            .first()
        )
        if existing:
            return jsonify({"detail": "该环境记录已有快检结果"}), 409
        room = log.room
        if data["result"] == "positive":
            if room.status == "idle":
                return jsonify({"detail": "idle 出菇室禁止因快检进入 sanitize"}), 409
            room.status = "sanitize"
        item = ContamCheck(
            climate_log_id=log.id,
            result=data["result"],
            checked_at=data["checked_at"],
            message=data.get("message"),
        )
        db.add(item)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return jsonify({"detail": "该环境记录已有快检结果"}), 409
        db.refresh(item)
        return jsonify(out_schema.dump(item)), 201
    finally:
        db.close()
