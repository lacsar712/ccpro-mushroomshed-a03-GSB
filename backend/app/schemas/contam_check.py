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
