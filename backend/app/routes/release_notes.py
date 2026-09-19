from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app.database import SessionLocal
from app.models.release_note import ReleaseNote
from app.models.room import Room
from app.schemas.release_note import ReleaseNoteCreateSchema, ReleaseNoteOutSchema
from app.utils import validation_error_response

bp = Blueprint("release_notes", __name__, url_prefix="/api/release-notes")

create_schema = ReleaseNoteCreateSchema()
out_schema = ReleaseNoteOutSchema()
out_many = ReleaseNoteOutSchema(many=True)


@bp.get("")
@jwt_required()
def list_release_notes():
    db = SessionLocal()
    try:
        q = db.query(ReleaseNote)
        room_id = request.args.get("roomId", type=int)
        if room_id is not None:
            q = q.filter(ReleaseNote.room_id == room_id)
        rows = q.order_by(ReleaseNote.released_at.desc()).all()
        return jsonify(out_many.dump(rows))
    finally:
        db.close()


@bp.post("")
@jwt_required()
def create_release_note():
    db = SessionLocal()
    try:
        try:
            data = create_schema.load(request.get_json(silent=True) or {})
        except ValidationError as err:
            return validation_error_response(err)
        room = db.query(Room).filter(Room.id == data["room_id"]).first()
        if not room:
            return jsonify({"detail": "出菇室不存在"}), 400
        if room.status != "sanitize":
            return jsonify({"detail": "仅处于 sanitize 的出菇室可登记消毒解除"}), 409

        item = ReleaseNote(
            room_id=room.id,
            reason=data["reason"],
            released_at=data["released_at"],
        )
        db.add(item)
        room.status = "fruiting"
        db.commit()
        db.refresh(item)
        return jsonify(out_schema.dump(item)), 201
    finally:
        db.close()
