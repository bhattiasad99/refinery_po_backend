export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Departments Service API",
    version: "1.0.0",
    description: "Departments service endpoints and event ingress.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Health" }, { name: "Departments" }, { name: "Events" }],
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
        tags: ["Departments"],
        summary: "List departments",
        responses: {
          "200": {
            description: "Departments list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Department" },
                },
              },
            },
          },
          "403": {
            description: "Forbidden resource access",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Departments"],
        summary: "Create department",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDepartmentInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Department created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Department" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden resource access",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Department name conflict",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  duplicate: {
                    value: { message: "Department name already exists" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
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
                required: ["name", "body"],
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
            description: "Forbidden resource access",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
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
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
      CreateDepartmentInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          description: { type: "string", minLength: 1 },
        },
        required: ["name", "description"],
      },
      Department: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "description", "createdAt", "updatedAt"],
      },
    },
  },
} as const;
