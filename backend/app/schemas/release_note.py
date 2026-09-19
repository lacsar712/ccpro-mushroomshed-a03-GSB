from marshmallow import Schema, fields, validate


class ReleaseNoteCreateSchema(Schema):
    reason = fields.Str(required=True, validate=validate.Length(min=1, max=500))
    released_at = fields.DateTime(allow_none=True, data_key="releasedAt")


class ReleaseNoteOutSchema(Schema):
    id = fields.Int(dump_only=True)
    room_id = fields.Int(data_key="roomId")
    reason = fields.Str()
    released_at = fields.DateTime(data_key="releasedAt")
