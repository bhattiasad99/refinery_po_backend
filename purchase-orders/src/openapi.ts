const errorSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
} as const;

const lineItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    catalogItemId: { type: "string", nullable: true },
    item: { type: "string", nullable: true },
    supplier: { type: "string" },
    category: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
    quantity: { type: "number", nullable: true },
    unitPrice: { type: "number", nullable: true },
    sortOrder: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id"],
} as const;

const milestoneSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string", nullable: true },
    percentage: { type: "number", nullable: true },
    dueInDays: { type: "integer", nullable: true },
    sortOrder: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id"],
} as const;

const purchaseOrderSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    status: {
      type: "string",
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "FULFILLED"],
    },
    poNumber: { type: "string", nullable: true },
    submittedAt: { type: "string", format: "date-time", nullable: true },
    submittedBy: { type: "string", nullable: true },
    approvedAt: { type: "string", format: "date-time", nullable: true },
    approvedBy: { type: "string", nullable: true },
    rejectedAt: { type: "string", format: "date-time", nullable: true },
    rejectedBy: { type: "string", nullable: true },
    fulfilledAt: { type: "string", format: "date-time", nullable: true },
    fulfilledBy: { type: "string", nullable: true },
    requestedByDepartment: { type: "string", nullable: true },
    requestedByUser: { type: "string", nullable: true },
    budgetCode: { type: "string", nullable: true },
    needByDate: { type: "string", format: "date", nullable: true },
    supplierName: { type: "string", nullable: true },
    paymentTermId: { type: "string", nullable: true },
    paymentTermLabel: { type: "string", nullable: true },
    paymentTermDescription: { type: "string", nullable: true },
    taxIncluded: { type: "boolean", nullable: true },
    advancePercentage: { type: "number", nullable: true },
    balanceDueInDays: { type: "integer", nullable: true },
    customTerms: { type: "string", nullable: true },
    step4Primary: { type: "string", nullable: true },
    step4Secondary: { type: "string", nullable: true },
    step4Tertiary: { type: "string", nullable: true },
    step5Primary: { type: "string", nullable: true },
    step5Secondary: { type: "string", nullable: true },
    step5Tertiary: { type: "string", nullable: true },
    lineItems: {
      type: "array",
      items: lineItemSchema,
    },
    milestones: {
      type: "array",
      items: milestoneSchema,
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "status", "lineItems", "milestones", "createdAt", "updatedAt"],
} as const;

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Purchase Orders Service API",
    version: "1.0.0",
    description: "Purchase order read/write lifecycle and projection event ingestion.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Health" }, { name: "Purchase Orders" }, { name: "Events" }],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean", example: true } },
                  required: ["ok"],
                },
              },
            },
          },
        },
      },
    },
    "/": {
      get: {
        tags: ["Purchase Orders"],
        summary: "List purchase orders",
        responses: {
          "200": {
            description: "Purchase orders list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: purchaseOrderSchema,
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to list purchase orders",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
      post: {
        tags: ["Purchase Orders"],
        summary: "Create draft purchase order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PurchaseOrderWritePayload" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": {
            description: "Invalid payload",
            content: { "application/json": { schema: errorSchema } },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "409": {
            description: "Conflict - supplier mismatch",
            content: {
              "application/json": {
                schema: errorSchema,
                examples: {
                  supplierMismatch: {
                    value: { message: "All items in a PO must come from the same supplier" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Failed to create purchase order",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/{purchaseOrderId}": {
      parameters: [
        {
          in: "path",
          name: "purchaseOrderId",
          required: true,
          schema: { type: "string" },
        },
      ],
      get: {
        tags: ["Purchase Orders"],
        summary: "Get purchase order by id",
        responses: {
          "200": {
            description: "Purchase order",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": {
            description: "Invalid id",
            content: { "application/json": { schema: errorSchema } },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to fetch purchase order",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
      put: {
        tags: ["Purchase Orders"],
        summary: "Update draft purchase order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PurchaseOrderWritePayload" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": {
            description: "Invalid input",
            content: { "application/json": { schema: errorSchema } },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: errorSchema } },
          },
          "409": {
            description: "Conflict - non-draft edit attempt",
            content: {
              "application/json": {
                schema: errorSchema,
                examples: {
                  draftOnly: {
                    value: { message: "Only draft purchase orders can be edited" },
                  },
                  supplierMismatch: {
                    value: { message: "All items in a PO must come from the same supplier" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Failed to update purchase order",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/{purchaseOrderId}/submit": {
      post: {
        tags: ["Purchase Orders"],
        summary: "Submit purchase order",
        parameters: [
          {
            in: "path",
            name: "purchaseOrderId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Submitted",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": {
            description: "Invalid id or submission preconditions failed",
            content: { "application/json": { schema: errorSchema } },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: errorSchema } },
          },
          "409": {
            description: "Invalid status transition",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to submit purchase order",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/{purchaseOrderId}/approve": {
      post: {
        tags: ["Purchase Orders"],
        summary: "Approve purchase order",
        parameters: [
          {
            in: "path",
            name: "purchaseOrderId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Approved",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": { description: "Invalid id", content: { "application/json": { schema: errorSchema } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: errorSchema } } },
          "404": { description: "Not found", content: { "application/json": { schema: errorSchema } } },
          "409": { description: "Invalid status transition", content: { "application/json": { schema: errorSchema } } },
          "500": { description: "Failed to approve purchase order", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/{purchaseOrderId}/reject": {
      post: {
        tags: ["Purchase Orders"],
        summary: "Reject purchase order",
        parameters: [
          {
            in: "path",
            name: "purchaseOrderId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Rejected",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": { description: "Invalid id", content: { "application/json": { schema: errorSchema } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: errorSchema } } },
          "404": { description: "Not found", content: { "application/json": { schema: errorSchema } } },
          "409": { description: "Invalid status transition", content: { "application/json": { schema: errorSchema } } },
          "500": { description: "Failed to reject purchase order", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/{purchaseOrderId}/fulfill": {
      post: {
        tags: ["Purchase Orders"],
        summary: "Fulfill purchase order",
        parameters: [
          {
            in: "path",
            name: "purchaseOrderId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Fulfilled",
            content: { "application/json": { schema: purchaseOrderSchema } },
          },
          "400": { description: "Invalid id", content: { "application/json": { schema: errorSchema } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: errorSchema } } },
          "404": { description: "Not found", content: { "application/json": { schema: errorSchema } } },
          "409": { description: "Invalid status transition", content: { "application/json": { schema: errorSchema } } },
          "500": { description: "Failed to fulfill purchase order", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/events": {
      post: {
        tags: ["Events"],
        summary: "Consume incoming projection event",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  body: { type: "object", additionalProperties: true },
                  source: { type: "string" },
                  url: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                },
                required: ["name", "body", "source", "url"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Event accepted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accepted: { type: "boolean", example: true },
                    eventName: { type: "string" },
                  },
                  required: ["accepted", "eventName"],
                },
              },
            },
          },
          "400": { description: "Invalid payload", content: { "application/json": { schema: errorSchema } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: errorSchema } } },
          "500": { description: "Failed to process event", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["Health"],
        summary: "OpenAPI specification",
        responses: { "200": { description: "OpenAPI JSON document" } },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: errorSchema,
      PurchaseOrder: purchaseOrderSchema,
      PurchaseOrderWritePayload: {
        type: "object",
        properties: {
          step1: {
            type: "object",
            nullable: true,
            properties: {
              requestedByDepartment: { type: "string", nullable: true },
              requestedByUser: { type: "string", nullable: true },
              budgetCode: { type: "string", nullable: true },
              needByDate: { type: "string", format: "date", nullable: true },
            },
          },
          step2: {
            type: "object",
            nullable: true,
            properties: {
              supplierName: { type: "string", nullable: true },
              items: {
                type: "array",
                nullable: true,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", nullable: true },
                    catalogItemId: { type: "string", nullable: true },
                    item: { type: "string", nullable: true },
                    supplier: { type: "string", nullable: true },
                    category: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                    quantity: { type: "number", nullable: true },
                    unitPrice: { type: "number", nullable: true },
                  },
                },
              },
            },
          },
          step3: {
            type: "object",
            nullable: true,
            properties: {
              paymentTerm: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string", nullable: true },
                  label: { type: "string", nullable: true },
                  description: { type: "string", nullable: true },
                },
              },
              taxIncluded: { type: "boolean", nullable: true },
              advancePercentage: { type: "number", nullable: true },
              balanceDueInDays: { type: "integer", nullable: true },
              customTerms: { type: "string", nullable: true },
              milestones: {
                type: "array",
                nullable: true,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", nullable: true },
                    label: { type: "string", nullable: true },
                    percentage: { type: "number", nullable: true },
                    dueInDays: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          step4: {
            type: "object",
            nullable: true,
            properties: {
              primary: { type: "string", nullable: true },
              secondary: { type: "string", nullable: true },
              tertiary: { type: "string", nullable: true },
            },
          },
          step5: {
            type: "object",
            nullable: true,
            properties: {
              primary: { type: "string", nullable: true },
              secondary: { type: "string", nullable: true },
              tertiary: { type: "string", nullable: true },
            },
          },
        },
      },
    },
  },
} as const;
