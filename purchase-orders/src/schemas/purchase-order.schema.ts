import Joi from "joi";

const paymentTermSchema = Joi.object({
  id: Joi.string().trim().empty("").optional().allow(null),
  label: Joi.string().trim().empty("").optional().allow(null),
  description: Joi.string().trim().empty("").optional().allow(null),
})
  .optional()
  .allow(null);

const lineItemSchema = Joi.object({
  id: Joi.string().trim().empty("").optional().allow(null),
  catalogItemId: Joi.string().trim().empty("").optional().allow(null),
  item: Joi.string().trim().empty("").optional().allow(null),
  supplier: Joi.string().trim().empty("").optional().allow(null),
  category: Joi.string().trim().empty("").optional().allow(null),
  description: Joi.string().trim().empty("").optional().allow(null),
  quantity: Joi.number().optional().allow(null),
  unitPrice: Joi.number().optional().allow(null),
}).unknown(false);

const milestoneSchema = Joi.object({
  id: Joi.string().trim().empty("").optional().allow(null),
  label: Joi.string().trim().empty("").optional().allow(null),
  percentage: Joi.number().optional().allow(null),
  dueInDays: Joi.number().integer().optional().allow(null),
}).unknown(false);

const genericStepSchema = Joi.object({
  primary: Joi.string().trim().empty("").optional().allow(null),
  secondary: Joi.string().trim().empty("").optional().allow(null),
  tertiary: Joi.string().trim().empty("").optional().allow(null),
})
  .optional()
  .allow(null);

export const purchaseOrderPayloadSchema = Joi.object({
  step1: Joi.object({
    requestedByDepartment: Joi.string().trim().empty("").optional().allow(null),
    requestedByUser: Joi.string().trim().empty("").optional().allow(null),
    budgetCode: Joi.string().trim().empty("").optional().allow(null),
    needByDate: Joi.date().iso().optional().allow(null),
  })
    .optional()
    .allow(null),
  step2: Joi.object({
    supplierName: Joi.string().trim().empty("").optional().allow(null),
    items: Joi.array().items(lineItemSchema).optional().allow(null),
  })
    .optional()
    .allow(null),
  step3: Joi.object({
    paymentTerm: paymentTermSchema,
    taxIncluded: Joi.boolean().optional().allow(null),
    advancePercentage: Joi.number().optional().allow(null),
    balanceDueInDays: Joi.number().integer().optional().allow(null),
    customTerms: Joi.string().trim().optional().allow("", null),
    milestones: Joi.array().items(milestoneSchema).optional().allow(null),
  })
    .optional()
    .allow(null),
  step4: genericStepSchema,
  step5: genericStepSchema,
})
  .unknown(false)
  .optional();

const flatPurchaseOrderPayloadSchema = Joi.object({
  requestedByDepartment: Joi.string().trim().empty("").optional().allow(null),
  requestedByUser: Joi.string().trim().empty("").optional().allow(null),
  budgetCode: Joi.string().trim().empty("").optional().allow(null),
  needByDate: Joi.date().iso().optional().allow(null),
  supplierName: Joi.string().trim().empty("").optional().allow(null),
  items: Joi.array().items(lineItemSchema).optional().allow(null),
  lineItems: Joi.array().items(lineItemSchema).optional().allow(null),
  paymentTerm: paymentTermSchema,
  taxIncluded: Joi.boolean().optional().allow(null),
  advancePercentage: Joi.number().optional().allow(null),
  balanceDueInDays: Joi.number().integer().optional().allow(null),
  customTerms: Joi.string().trim().optional().allow("", null),
  milestones: Joi.array().items(milestoneSchema).optional().allow(null),
  step4Primary: Joi.string().trim().empty("").optional().allow(null),
  step4Secondary: Joi.string().trim().empty("").optional().allow(null),
  step4Tertiary: Joi.string().trim().empty("").optional().allow(null),
  step5Primary: Joi.string().trim().empty("").optional().allow(null),
  step5Secondary: Joi.string().trim().empty("").optional().allow(null),
  step5Tertiary: Joi.string().trim().empty("").optional().allow(null),
})
  .unknown(false)
  .optional();

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type PurchaseOrderWritePayload = {
  step1?: {
    requestedByDepartment?: string | null;
    requestedByUser?: string | null;
    budgetCode?: string | null;
    needByDate?: string | Date | null;
  } | null;
  step2?: {
    supplierName?: string | null;
    items?: Array<{
      id?: string | null;
      catalogItemId?: string | null;
      item?: string | null;
      supplier?: string | null;
      category?: string | null;
      description?: string | null;
      quantity?: number | null;
      unitPrice?: number | null;
    }> | null;
  } | null;
  step3?: {
    paymentTerm?: {
      id?: string | null;
      label?: string | null;
      description?: string | null;
    } | null;
    taxIncluded?: boolean | null;
    advancePercentage?: number | null;
    balanceDueInDays?: number | null;
    customTerms?: string | null;
    milestones?: Array<{
      id?: string | null;
      label?: string | null;
      percentage?: number | null;
      dueInDays?: number | null;
    }> | null;
  } | null;
  step4?: {
    primary?: string | null;
    secondary?: string | null;
    tertiary?: string | null;
  } | null;
  step5?: {
    primary?: string | null;
    secondary?: string | null;
    tertiary?: string | null;
  } | null;
};

type FlatPurchaseOrderWritePayload = {
  requestedByDepartment?: string | null;
  requestedByUser?: string | null;
  budgetCode?: string | null;
  needByDate?: string | Date | null;
  supplierName?: string | null;
  items?: PurchaseOrderWritePayload["step2"] extends infer S
    ? S extends { items?: infer I }
      ? I | null
      : never
    : never;
  lineItems?: PurchaseOrderWritePayload["step2"] extends infer S
    ? S extends { items?: infer I }
      ? I | null
      : never
    : never;
  paymentTerm?: PurchaseOrderWritePayload["step3"] extends infer S
    ? S extends { paymentTerm?: infer P }
      ? P
      : never
    : never;
  taxIncluded?: boolean | null;
  advancePercentage?: number | null;
  balanceDueInDays?: number | null;
  customTerms?: string | null;
  milestones?: PurchaseOrderWritePayload["step3"] extends infer S
    ? S extends { milestones?: infer M }
      ? M | null
      : never
    : never;
  step4Primary?: string | null;
  step4Secondary?: string | null;
  step4Tertiary?: string | null;
  step5Primary?: string | null;
  step5Secondary?: string | null;
  step5Tertiary?: string | null;
};

function hasKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeFlatPayloadToSteps(payload: FlatPurchaseOrderWritePayload): PurchaseOrderWritePayload {
  const normalized: PurchaseOrderWritePayload = {};

  if (
    hasKey(payload, "requestedByDepartment") ||
    hasKey(payload, "requestedByUser") ||
    hasKey(payload, "budgetCode") ||
    hasKey(payload, "needByDate")
  ) {
    normalized.step1 = {};

    if (hasKey(payload, "requestedByDepartment")) {
      normalized.step1.requestedByDepartment = payload.requestedByDepartment;
    }
    if (hasKey(payload, "requestedByUser")) {
      normalized.step1.requestedByUser = payload.requestedByUser;
    }
    if (hasKey(payload, "budgetCode")) {
      normalized.step1.budgetCode = payload.budgetCode;
    }
    if (hasKey(payload, "needByDate")) {
      normalized.step1.needByDate = payload.needByDate;
    }
  }

  if (hasKey(payload, "supplierName") || hasKey(payload, "items") || hasKey(payload, "lineItems")) {
    normalized.step2 = {};

    if (hasKey(payload, "supplierName")) {
      normalized.step2.supplierName = payload.supplierName;
    }
    if (hasKey(payload, "items")) {
      normalized.step2.items = payload.items ?? null;
    } else if (hasKey(payload, "lineItems")) {
      normalized.step2.items = payload.lineItems ?? null;
    }
  }

  if (
    hasKey(payload, "paymentTerm") ||
    hasKey(payload, "taxIncluded") ||
    hasKey(payload, "advancePercentage") ||
    hasKey(payload, "balanceDueInDays") ||
    hasKey(payload, "customTerms") ||
    hasKey(payload, "milestones")
  ) {
    normalized.step3 = {};

    if (hasKey(payload, "paymentTerm")) {
      normalized.step3.paymentTerm = payload.paymentTerm;
    }
    if (hasKey(payload, "taxIncluded")) {
      normalized.step3.taxIncluded = payload.taxIncluded;
    }
    if (hasKey(payload, "advancePercentage")) {
      normalized.step3.advancePercentage = payload.advancePercentage;
    }
    if (hasKey(payload, "balanceDueInDays")) {
      normalized.step3.balanceDueInDays = payload.balanceDueInDays;
    }
    if (hasKey(payload, "customTerms")) {
      normalized.step3.customTerms = payload.customTerms;
    }
    if (hasKey(payload, "milestones")) {
      normalized.step3.milestones = payload.milestones ?? null;
    }
  }

  if (hasKey(payload, "step4Primary") || hasKey(payload, "step4Secondary") || hasKey(payload, "step4Tertiary")) {
    normalized.step4 = {};

    if (hasKey(payload, "step4Primary")) {
      normalized.step4.primary = payload.step4Primary;
    }
    if (hasKey(payload, "step4Secondary")) {
      normalized.step4.secondary = payload.step4Secondary;
    }
    if (hasKey(payload, "step4Tertiary")) {
      normalized.step4.tertiary = payload.step4Tertiary;
    }
  }

  if (hasKey(payload, "step5Primary") || hasKey(payload, "step5Secondary") || hasKey(payload, "step5Tertiary")) {
    normalized.step5 = {};

    if (hasKey(payload, "step5Primary")) {
      normalized.step5.primary = payload.step5Primary;
    }
    if (hasKey(payload, "step5Secondary")) {
      normalized.step5.secondary = payload.step5Secondary;
    }
    if (hasKey(payload, "step5Tertiary")) {
      normalized.step5.tertiary = payload.step5Tertiary;
    }
  }

  return normalized;
}

export function parsePurchaseOrderWritePayload(
  payload: unknown,
): ParseResult<PurchaseOrderWritePayload> {
  const looksLikeSteppedPayload = Boolean(
    payload &&
      typeof payload === "object" &&
      ("step1" in payload ||
        "step2" in payload ||
        "step3" in payload ||
        "step4" in payload ||
        "step5" in payload),
  );

  const schema = looksLikeSteppedPayload
    ? purchaseOrderPayloadSchema
    : flatPurchaseOrderPayloadSchema;

  const { error, value } = schema.validate(payload, {
    abortEarly: true,
    convert: true,
    stripUnknown: false,
  });

  if (error) {
    return { ok: false, message: error.details[0]?.message ?? "Invalid payload" };
  }

  if (looksLikeSteppedPayload) {
    return { ok: true, value: (value ?? {}) as PurchaseOrderWritePayload };
  }

  const normalized = normalizeFlatPayloadToSteps((value ?? {}) as FlatPurchaseOrderWritePayload);
  return { ok: true, value: normalized };
}

export function parsePurchaseOrderId(value: unknown): ParseResult<string> {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) {
    return { ok: false, message: "purchase-order-id is required" };
  }
  return { ok: true, value: id };
}
