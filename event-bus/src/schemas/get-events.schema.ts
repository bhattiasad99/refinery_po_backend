import Joi from "joi";

export const eventFiltersSchema = Joi.object({
    name: Joi.string().trim().empty("").optional(),
    source: Joi.string().trim().empty("").optional(),
    from: Joi.date().iso().optional().default(() => new Date(0)),
    to: Joi.date().iso().optional().default(() => new Date()),
    order: Joi.string().trim().uppercase().valid("ASC", "DESC").optional().default("DESC"),
    limit: Joi.number().integer().min(1).max(500).optional().default(100),
}).unknown(true);
