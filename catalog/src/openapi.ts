const errorSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
} as const;

const catalogItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    categoryName: { type: "string" },
    supplierName: { type: "string" },
    createdBy: { type: "string" },
    manufacturer: { type: "string", nullable: true },
    model: { type: "string" },
    description: { type: "string", nullable: true },
    leadTimeDays: { type: "integer" },
    priceUsd: { type: "number" },
    inStock: { type: "boolean" },
    compatibleWith: {
      type: "array",
      nullable: true,
      items: { type: "string" },
    },
    standard: { type: "string", nullable: true },
    specsSupplier: { type: "string", nullable: true },
    nominalSize: { type: "string", nullable: true },
    pressureClass: { type: "string", nullable: true },
    face: { type: "string", nullable: true },
    windingMaterial: { type: "string", nullable: true },
    fillerMaterial: { type: "string", nullable: true },
    innerRing: { type: "string", nullable: true },
    outerRing: { type: "string", nullable: true },
    ringNumber: { type: "string", nullable: true },
    profile: { type: "string", nullable: true },
    material: { type: "string", nullable: true },
    thickness: { type: "string", nullable: true },
    sheetSize: { type: "string", nullable: true },
    maxTemperature: { type: "string", nullable: true },
    coreMaterial: { type: "string", nullable: true },
    facingMaterial: { type: "string", nullable: true },
    bodyMaterial: { type: "string", nullable: true },
    endConnection: { type: "string", nullable: true },
    trimOrSeat: { type: "string", nullable: true },
    nace: { type: "string", nullable: true },
    fireSafe: { type: "string", nullable: true },
    hydraulicSize: { type: "string", nullable: true },
    configuration: { type: "string", nullable: true },
    casingMaterial: { type: "string", nullable: true },
    ratedFlow: { type: "string", nullable: true },
    ratedHead: { type: "string", nullable: true },
    sealPlan: { type: "string", nullable: true },
    driver: { type: "string", nullable: true },
    measurementType: { type: "string", nullable: true },
    range: { type: "string", nullable: true },
    communication: { type: "string", nullable: true },
    accuracy: { type: "string", nullable: true },
    hazardousArea: { type: "string", nullable: true },
    processConnection: { type: "string", nullable: true },
    trim: { type: "string", nullable: true },
    actuation: { type: "string", nullable: true },
    positioner: { type: "string", nullable: true },
    designCode: { type: "string", nullable: true },
    temaOrType: { type: "string", nullable: true },
    surfaceArea: { type: "string", nullable: true },
    shellMaterial: { type: "string", nullable: true },
    tubeOrPlateMaterial: { type: "string", nullable: true },
    designPressure: { type: "string", nullable: true },
    designTemperature: { type: "string", nullable: true },
    toolType: { type: "string", nullable: true },
    voltage: { type: "string", nullable: true },
    chuck: { type: "string", nullable: true },
    maxTorque: { type: "string", nullable: true },
    speed: { type: "string", nullable: true },
    warranty: { type: "string", nullable: true },
    current: { type: "string", nullable: true },
    headWeight: { type: "string", nullable: true },
    handle: { type: "string", nullable: true },
    overallLength: { type: "string", nullable: true },
    tips: { type: "string", nullable: true },
    count: { type: "string", nullable: true },
    magnetic: { type: "string", nullable: true },
    tip: { type: "string", nullable: true },
    shaftLength: { type: "string", nullable: true },
    length: { type: "string", nullable: true },
    jawCapacity: { type: "string", nullable: true },
    finish: { type: "string", nullable: true },
    cuttingEdge: { type: "string", nullable: true },
    bladeType: { type: "string", nullable: true },
    body: { type: "string", nullable: true },
    quickChange: { type: "string", nullable: true },
  },
  required: [
    "id",
    "name",
    "categoryName",
    "supplierName",
    "createdBy",
    "model",
    "leadTimeDays",
    "priceUsd",
    "inStock",
  ],
} as const;

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Catalog Service API",
    version: "1.0.0",
    description: "Catalog browsing, supplier browsing, filters, bulk upsert, and event ingestion.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health" },
    { name: "Catalog" },
    { name: "Suppliers" },
    { name: "Events" },
  ],
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
    "/healthz": {
      get: {
        tags: ["Health"],
        summary: "Liveness check",
        responses: {
          "200": {
            description: "Service alive",
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
        tags: ["Catalog"],
        summary: "List catalog items",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" } },
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "category", schema: { type: "string" } },
          { in: "query", name: "inStock", schema: { type: "boolean" } },
          { in: "query", name: "page", schema: { type: "integer", minimum: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 200 } },
          { in: "query", name: "offset", schema: { type: "integer", minimum: 0 } },
          {
            in: "query",
            name: "sort",
            schema: {
              type: "string",
              enum: ["price_asc", "price_desc", "lead_time_asc", "lead_time_desc", "supplier_asc"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Catalog list response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: catalogItemSchema },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    averageLeadTime: { type: "number" },
                    averagePrice: { type: "number" },
                    inStockCount: { type: "integer" },
                  },
                  required: [
                    "data",
                    "total",
                    "page",
                    "limit",
                    "averageLeadTime",
                    "averagePrice",
                    "inStockCount",
                  ],
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to fetch catalog items",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/filters": {
      get: {
        tags: ["Catalog"],
        summary: "Fetch distinct category and supplier filter options",
        responses: {
          "200": {
            description: "Filter options",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    categories: {
                      type: "array",
                      items: { type: "string" },
                    },
                    suppliers: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["categories", "suppliers"],
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to fetch catalog filter options",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/suppliers": {
      get: {
        tags: ["Suppliers"],
        summary: "List suppliers with grouped catalog items",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" } },
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "page", schema: { type: "integer", minimum: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { in: "query", name: "offset", schema: { type: "integer", minimum: 0 } },
        ],
        responses: {
          "200": {
            description: "Supplier groups",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          supplier: { type: "string" },
                          items: { type: "array", items: catalogItemSchema },
                        },
                        required: ["supplier", "items"],
                      },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                  },
                  required: ["data", "total", "page", "limit"],
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to fetch suppliers with catalog items",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/{id}": {
      get: {
        tags: ["Catalog"],
        summary: "Get catalog item by id",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Catalog item",
            content: {
              "application/json": {
                schema: catalogItemSchema,
              },
            },
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
            description: "Catalog item not found",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to fetch catalog item",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/bulk": {
      post: {
        tags: ["Catalog"],
        summary: "Bulk create/update catalog items",
        description: "Requires `x-user-id` header for the authenticated user.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/BulkCatalogItemInput" },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Bulk upsert completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    createdCount: { type: "integer" },
                    updatedCount: { type: "integer" },
                    duplicateIdsInPayload: { type: "integer" },
                    emittedEventNames: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "createdCount",
                    "updatedCount",
                    "duplicateIdsInPayload",
                    "emittedEventNames",
                  ],
                },
              },
            },
          },
          "400": {
            description: "Invalid payload",
            content: { "application/json": { schema: errorSchema } },
          },
          "401": {
            description: "Missing authenticated user id header",
            content: { "application/json": { schema: errorSchema } },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description: "Failed to bulk create catalog items",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    },
    "/events": {
      post: {
        tags: ["Events"],
        summary: "Consume incoming event",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  body: { type: "object", additionalProperties: true },
                },
                required: ["name"],
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
                    eventName: { type: "string", nullable: true },
                  },
                  required: ["accepted", "eventName"],
                },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: errorSchema } },
          },
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
      CatalogItem: catalogItemSchema,
      BulkCatalogItemInput: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          supplier: { type: "string" },
          manufacturer: { type: "string", nullable: true },
          model: { type: "string" },
          description: { type: "string", nullable: true },
          leadTimeDays: { type: "number" },
          priceUsd: { type: "number" },
          inStock: { type: "boolean" },
          specs: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
          compatibleWith: {
            oneOf: [
              { type: "array", items: { type: "string" } },
              { type: "null", nullable: true },
            ],
          },
        },
        required: [
          "id",
          "name",
          "category",
          "supplier",
          "model",
          "leadTimeDays",
          "priceUsd",
          "inStock",
        ],
      },
    },
  },
} as const;
