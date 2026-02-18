import Joi from "joi";

export const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required().messages({
    "any.required": "name is required",
    "string.empty": "name is required",
  }),
  description: Joi.string().trim().min(1).required().messages({
    "any.required": "description is required",
    "string.empty": "description is required",
  }),
});
