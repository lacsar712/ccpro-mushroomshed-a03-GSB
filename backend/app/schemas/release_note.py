from marshmallow import Schema, fields, validate


class ReleaseNoteCreateSchema(Schema):
    room_id = fields.Int(required=True, data_key="roomId")
    reason = fields.Str(required=True, validate=validate.Length(min=1, max=2000))
    released_at = fields.DateTime(required=True, data_key="releasedAt")


class ReleaseNoteOutSchema(Schema):
    id = fields.Int(dump_only=True)
    room_id = fields.Int(data_key="roomId")
    reason = fields.Str()
    released_at = fields.DateTime(data_key="releasedAt")
    room_status = fields.Method("get_room_status", data_key="roomStatus")

    def get_room_status(self, obj):
        return obj.room.status
