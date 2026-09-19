from marshmallow import Schema, fields, validate

CONTAM_RESULTS = ("clear", "suspect", "positive")


class ContamCheckCreateSchema(Schema):
    climate_log_id = fields.Int(required=True, data_key="climateLogId")
    result = fields.Str(required=True, validate=validate.OneOf(CONTAM_RESULTS))
    checked_at = fields.DateTime(required=True, data_key="checkedAt")
    message = fields.Str(allow_none=True)


class ContamCheckOutSchema(Schema):
    id = fields.Int(dump_only=True)
    climate_log_id = fields.Int(data_key="climateLogId")
    result = fields.Str()
    checked_at = fields.DateTime(data_key="checkedAt")
    message = fields.Str(allow_none=True)
    room_id = fields.Method("get_room_id", data_key="roomId")
    room_status = fields.Method("get_room_status", data_key="roomStatus")

    def get_room_id(self, obj):
        return obj.climate_log.room_id

    def get_room_status(self, obj):
        return obj.climate_log.room.status
