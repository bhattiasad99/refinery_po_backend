const errorSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
} as const;

const publicUserSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    departmentId: { type: "string", format: "uuid" },
    createdBy: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "email", "departmentId", "createdBy", "createdAt", "updatedAt"],
} as const;

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Users Service API",
    version: "1.0.0",
    description: "Users service endpoints for user management, auth sessions, and event ingestion.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health" },
    { name: "Users" },
    { name: "Auth Sessions" },
    { name: "Backfill" },
    { name: "Events" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
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
            description: "Service is alive",
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
        tags: ["Users"],
        summary: "List users or lookup a single user",
        description: "When `id` or `email` query is provided, returns a single user. Otherwise returns a list.",
        parameters: [
          { in: "query", name: "id", schema: { type: "string", format: "uuid" } },
          { in: "query", name: "email", schema: { type: "string", format: "email" } },
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 200 } },
        ],
        responses: {
          "200": {
            description: "User lookup or list response",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/PublicUser" },
                    {
                      type: "array",
                      items: { $ref: "#/components/schemas/PublicUser" },
                    },
                  ],
                },
              },
            },
          },
          "400": {
            description: "Invalid query",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": {
            description: "User not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateUserInput" },
              examples: {
                default: {
                  value: {
                    email: "jane.doe@example.com",
                    password: "verysecure123",
                    department: "Procurement",
                    createdBy: null,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicUser" } } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "409": {
            description: "User email already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  emailConflict: {
                    value: { message: "User email already exists" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/single-user": {
      get: {
        tags: ["Users"],
        summary: "Get a single user by id or email",
        parameters: [
          { in: "query", name: "id", schema: { type: "string", format: "uuid" } },
          { in: "query", name: "email", schema: { type: "string", format: "email" } },
        ],
        responses: {
          "200": {
            description: "User found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicUser" } } },
          },
          "400": {
            description: "Invalid query",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": {
            description: "User not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/verify-credentials": {
      post: {
        tags: ["Users"],
        summary: "Verify credentials",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyCredentialsInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Credentials valid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authenticated: { type: "boolean", example: true },
                    user: { $ref: "#/components/schemas/PublicUser" },
                  },
                  required: ["authenticated", "user"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "401": {
            description: "Invalid credentials",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/auth/sessions": {
      post: {
        tags: ["Auth Sessions"],
        summary: "Create refresh session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string", format: "uuid" },
                  tokenHash: { type: "string" },
                  expiresAt: { type: "string", format: "date-time" },
                },
                required: ["userId", "tokenHash", "expiresAt"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Session created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { sessionId: { type: "string", format: "uuid" } },
                  required: ["sessionId"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": {
            description: "User not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/auth/sessions/rotate": {
      post: {
        tags: ["Auth Sessions"],
        summary: "Rotate refresh session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tokenHash: { type: "string" },
                  newTokenHash: { type: "string" },
                  expiresAt: { type: "string", format: "date-time" },
                },
                required: ["tokenHash", "newTokenHash", "expiresAt"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session rotated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/PublicUser" },
                    sessionId: { type: "string", format: "uuid" },
                  },
                  required: ["user", "sessionId"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "404": {
            description: "Session not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "409": {
            description: "Session conflict",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/auth/sessions/revoke": {
      post: {
        tags: ["Auth Sessions"],
        summary: "Revoke refresh session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tokenHash: { type: "string" },
                },
                required: ["tokenHash"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Revocation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { revoked: { type: "boolean" } },
                  required: ["revoked"],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
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
          "400": {
            description: "Invalid event payload",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/back-fill/create_users": {
      post: {
        tags: ["Backfill"],
        summary: "Backfill and publish create_user events",
        responses: {
          "200": {
            description: "Backfill summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          "403": {
            description: "Forbidden resource access",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          "500": {
            description: "Backfill failed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["Health"],
        summary: "OpenAPI specification",
        responses: {
          "200": {
            description: "OpenAPI JSON document",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: errorSchema,
      PublicUser: publicUserSchema,
      CreateUserInput: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          department: { type: "string" },
          createdBy: { type: "string", nullable: true },
        },
        required: ["email", "password", "department"],
      },
      VerifyCredentialsInput: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
        required: ["email", "password"],
      },
    },
    securitySchemes: {
      InternalServiceKey: {
        type: "apiKey",
        in: "header",
        name: "x-internal-key",
      },
    },
  },
} as const;
