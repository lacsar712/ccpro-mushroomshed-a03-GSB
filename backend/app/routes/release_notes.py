from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.database import SessionLocal
from app.models.release_note import ReleaseNote
from app.schemas.release_note import ReleaseNoteOutSchema

bp = Blueprint("release_notes", __name__, url_prefix="/api/release-notes")

out_many = ReleaseNoteOutSchema(many=True)


@bp.get("")
@jwt_required()
def list_release_notes():
    db = SessionLocal()
    try:
        room_id = request.args.get("roomId", type=int)
        q = db.query(ReleaseNote)
        if room_id is not None:
            q = q.filter(ReleaseNote.room_id == room_id)
        rows = q.order_by(ReleaseNote.released_at.desc()).all()
        return jsonify(out_many.dump(rows))
    finally:
        db.close()
