import Joi from "joi";

export const failedEventFiltersSchema = Joi.object({
    targetService: Joi.string().trim().required().messages({
        "any.required": "targetService is required",
        "string.base": "targetService is required",
        "string.empty": "targetService is required",
    }),
    name: Joi.string().trim().empty("").optional(),
    source: Joi.string().trim().empty("").optional(),
    from: Joi.date().iso().optional().default(() => new Date(0)),
    to: Joi.date().iso().optional().default(() => new Date()),
    limit: Joi.number().integer().min(1).max(500).optional().default(100),
}).unknown(true);