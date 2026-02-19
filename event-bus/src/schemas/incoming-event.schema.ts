import Joi from "joi";

export const incomingEventSchema = Joi.object({
    name: Joi.string().trim().required().messages({
        "any.required": "name is required",
        "string.base": "name is required",
        "string.empty": "name is required",
    }),
    body: Joi.object().required().messages({
        "any.required": "body is required and must be a JSON object",
        "object.base": "body is required and must be a JSON object",
    }),
    source: Joi.string().trim().required().messages({
        "any.required": "source is required",
        "string.base": "source is required",
        "string.empty": "source is required",
    }),
    url: Joi.string().trim().required().messages({
        "any.required": "url is required",
        "string.base": "url is required",
        "string.empty": "url is required",
    }),
}).unknown(true);
