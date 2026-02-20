# Refinery PO - API Specifications

Comprehensive guide to the API Gateway endpoints for the Refinery Purchase Order system. The gateway is a NestJS application that handles authentication, wraps responses in a standard envelope, and proxies requests to downstream microservices (catalog, purchase-orders, departments, users, event-bus).

---

## 🚀 Overview

- **Gateway Base URL**: `http://localhost:8000` for local (or deployed gateway URL)
- **Response Format**: All successful responses are wrapped in a standard envelope by the `ResponseInterceptor`:

```json
{
  "AppName": "Refinery",
  "Version": "1.0.0",
  "status": 200,
  "error": false,
  "body": { ... },
  "message": "Success"
}
```

- **Authentication**: JWT Bearer token via `Authorization` header. The frontend BFF layer manages cookie-based sessions and attaches the token automatically.

---

## 🛠️ Common Headers

| Header             | Type   | Required | Description                                                                     |
| ------------------ | ------ | -------- | ------------------------------------------------------------------------------- |
| `Content-Type`     | String | Yes      | Must be `application/json` for POST/PUT requests.                               |
| `Authorization`    | String | Yes\*    | `Bearer <accessToken>` — required for all authenticated endpoints.              |
| `Idempotency-Key`  | String | Optional | Unique key to prevent duplicate operations on PO create/update.                 |

\* Not required for public endpoints (see Authentication section).

---

## 🔐 Authentication

The gateway applies a global `GatewayAuthGuard`. All endpoints require a valid JWT unless explicitly public.

**Public endpoints** (no auth required):
`/health`, `/warm-up`, `/warm-up/status/:id`, `/warm-up/stream/:id`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/docs`, `/openapi.json`, `/api-specifications`, and per-service `/docs` and `/openapi.json` paths.

### **Login**

- **Endpoint**: `POST /auth/login`
- **Body**:

| Field      | Type   | Required | Validation        |
| ---------- | ------ | -------- | ----------------- |
| `email`    | String | Yes      | Must be valid email |
| `password` | String | Yes      | Min 8 characters  |

- Extra fields are rejected (`forbidNonWhitelisted`).
- **Response**: Sets an `HttpOnly` refresh token cookie and returns:

```json
{
  "accessToken": "jwt-string",
  "user": { "id": "...", "email": "...", "departmentId": "...", "createdBy": "...", "createdAt": "...", "updatedAt": "..." }
}
```

### **Refresh Token**

- **Endpoint**: `POST /auth/refresh`
- Reads the refresh token from the cookie set during login.
- **Response**: New access token + rotated refresh cookie. Same shape as login.

### **Logout**

- **Endpoint**: `POST /auth/logout`
- Reads and clears the refresh cookie.
- **Response**: `{ "loggedOut": true }`

---

## 📚 Endpoints

### 📦 Catalog

Managed catalog items available for purchase. Proxied to the catalog microservice.

#### **List Catalog Items**

Retrieve a paginated list of catalog items with optional filtering.

- **Endpoint**: `GET /catalog`
- **Query Parameters**:

| Parameter         | Type    | Default | Description                                                          |
| ----------------- | ------- | ------- | -------------------------------------------------------------------- |
| `page`            | Integer | `1`     | Page number (positive integer).                                      |
| `limit`           | Integer | `50`    | Items per page (max 200).                                            |
| `offset`          | Integer | auto    | Alternative to page-based pagination.                                |
| `search`          | String  | -       | Search by id, name, supplier name, manufacturer, or model (ILIKE).   |
| `q`               | String  | -       | Alias for `search`.                                                  |
| `category`        | String  | -       | Exact category name filter.                                          |
| `inStock`         | String  | -       | `"true"` or `"false"` to filter by stock availability.               |
| `sort`            | String  | -       | Sort field: `price_asc`, `price_desc`, `lead_time_asc`, `lead_time_desc`, `supplier_asc`. Default: name ASC. |
| `simulateDelayMs` | Integer | `0`     | Artificial delay for testing loading states (max 3000ms).            |

- **Response**:

```json
{
  "data": [ ... ],
  "total": 50,
  "page": 1,
  "limit": 50,
  "averageLeadTime": 14.5,
  "averagePrice": 125.00,
  "inStockCount": 42
}
```

#### **Get Catalog Filters**

Retrieve available filter options for the catalog (categories and suppliers).

- **Endpoint**: `GET /catalog/filters`
- **Response**:

```json
{
  "categories": ["Flanges", "Gaskets", "Valves"],
  "suppliers": ["Acme Corp", "Gulf Industrial"]
}
```

#### **Get Catalog Item**

Retrieve a single catalog item by ID.

- **Endpoint**: `GET /catalog/:id`
- **Path Parameters**: `id` (string, required)
- **Response**: Full catalog item entity or `404`.

#### **List Suppliers**

Retrieve a paginated list of suppliers grouped with their catalog items.

- **Endpoint**: `GET /catalog/suppliers`
- **Query Parameters**:

| Parameter | Type    | Default | Description                                |
| --------- | ------- | ------- | ------------------------------------------ |
| `page`    | Integer | `1`     | Page number.                               |
| `limit`   | Integer | `10`    | Suppliers per page (max 100).              |
| `offset`  | Integer | auto    | Alternative to page-based pagination.      |
| `search`  | String  | -       | Search by supplier name (ILIKE).           |
| `q`       | String  | -       | Alias for `search`.                        |

- **Response**:

```json
{
  "data": [
    { "supplier": "Acme Corp", "items": [ ... ] }
  ],
  "total": 5,
  "page": 1,
  "limit": 10
}
```

#### **Bulk Create/Update Catalog Items**

- **Endpoint**: `POST /catalog/bulk`
- **Required Header**: `x-user-id` (injected by gateway from JWT — returns `401` if missing)
- **Body**: JSON array of catalog item objects:

| Field            | Type    | Required | Description                                     |
| ---------------- | ------- | -------- | ----------------------------------------------- |
| `id`             | String  | Yes      | Unique item ID.                                 |
| `name`           | String  | Yes      | Item name.                                      |
| `category`       | String  | Yes      | Category name.                                  |
| `supplier`       | String  | Yes      | Supplier name.                                  |
| `model`          | String  | Yes      | Model identifier.                               |
| `inStock`        | Boolean | Yes      | Stock availability.                             |
| `leadTimeDays`   | Number  | Yes      | Lead time in days.                              |
| `priceUsd`       | Number  | Yes      | Price in USD.                                   |
| `manufacturer`   | String  | No       | Manufacturer name.                              |
| `description`    | String  | No       | Item description.                               |
| `specs`          | Object  | No       | Dynamic specification fields.                   |
| `compatibleWith` | Array   | No       | Compatible item IDs.                            |

- **Response** (`201`):

```json
{
  "createdCount": 10,
  "updatedCount": 5,
  "duplicateIdsInPayload": 0,
  "emittedEventNames": ["create_catalog_item", "edit_catalog_item"]
}
```

---

### 🛒 Purchase Orders

Manage purchase orders, including drafting, submission, approval workflows, and retrieval. Proxied to the purchase-orders microservice.

#### **List Purchase Orders**

Retrieve up to 100 most recent purchase orders with line items, milestones, and status history.

- **Endpoint**: `GET /purchase-orders`
- Ordered by `createdAt DESC`.

#### **Get Dashboard Stats**

Retrieve aggregated purchase order statistics.

- **Endpoint**: `GET /purchase-orders/dashboard`
- **Response**:

```json
{
  "totalPurchases": 50000,
  "totalPurchaseOrders": 25,
  "totalItemsPurchased": 100,
  "purchaseOrdersThisMonth": 5,
  "purchaseOrdersPerDay": [ ... ]
}
```

#### **Get Purchase Order**

Retrieve a specific purchase order by ID, including line items, milestones, and status history.

- **Endpoint**: `GET /purchase-orders/:purchaseOrderId`
- **Path Parameters**: `purchaseOrderId` (string, required)

#### **Create Purchase Order**

Create a new purchase order. Auto-generates a `PO-YYYYMMDD-NNNN` format ID.

- **Endpoint**: `POST /purchase-orders`
- **Headers**: `Idempotency-Key` (recommended)
- **Body**: Accepts two formats (auto-detected):

**Stepped format** (if `step1`–`step5` keys are present):

```json
{
  "step1": {
    "requestedByDepartment": "Engineering",
    "requestedByUser": "user-uuid",
    "budgetCode": "ENG-2024-Q1",
    "needByDate": "2026-03-15"
  },
  "step2": {
    "supplierName": "Acme Corp",
    "items": [
      {
        "catalogItemId": "cat-item-uuid",
        "item": "Spiral Wound Gasket",
        "supplier": "Acme Corp",
        "category": "Gaskets",
        "description": "6 inch gasket",
        "quantity": 10,
        "unitPrice": 45.50
      }
    ]
  },
  "step3": {
    "paymentTerm": { "id": "net30", "label": "NET 30", "description": "..." },
    "taxIncluded": false,
    "advancePercentage": 20,
    "balanceDueInDays": 30,
    "customTerms": "Special terms text",
    "milestones": [
      { "id": "m1", "label": "Advance", "percentage": 20, "dueInDays": 0 }
    ]
  },
  "step4": { "primary": "...", "secondary": "...", "tertiary": "..." },
  "step5": { "primary": "...", "secondary": "...", "tertiary": "..." }
}
```

**Flat format** (auto-normalized internally):

```json
{
  "requestedByDepartment": "Engineering",
  "requestedByUser": "user-uuid",
  "budgetCode": "ENG-2024-Q1",
  "needByDate": "2026-03-15",
  "supplierName": "Acme Corp",
  "items": [ ... ],
  "paymentTerm": { ... },
  "taxIncluded": false,
  "advancePercentage": 20,
  "balanceDueInDays": 30,
  "customTerms": "...",
  "milestones": [ ... ]
}
```

- **Validation**: `supplierName` must match the `supplier` field on all line items (`409` if mismatched).
- **Response** (`201`): Full PO entity.

#### **Update Purchase Order**

Update an existing draft purchase order.

- **Endpoint**: `PUT /purchase-orders/:purchaseOrderId`
- **Headers**: `Idempotency-Key` (recommended)
- **Body**: Same formats as create.
- Returns `409` if PO status is not `DRAFT`.

#### **Submit Purchase Order**

Submit a draft PO for approval.

- **Endpoint**: `POST /purchase-orders/:purchaseOrderId/submit`
- **Headers**: `Idempotency-Key` (optional)
- **Status transition**: `DRAFT` → `SUBMITTED`
- **Validation** (returns `400` if any fail):
  - `requestedByDepartment`, `requestedByUser`, `budgetCode`, `supplierName` are required.
  - At least 1 line item with valid `item` (name), `quantity > 0`, and `unitPrice >= 0`.

#### **Approve Purchase Order**

- **Endpoint**: `POST /purchase-orders/:purchaseOrderId/approve`
- **Status transition**: `SUBMITTED` → `APPROVED`
- Actor resolved from `x-user-email` or `x-user-id` header (injected by gateway).

#### **Reject Purchase Order**

- **Endpoint**: `POST /purchase-orders/:purchaseOrderId/reject`
- **Status transition**: `SUBMITTED` → `REJECTED` (terminal state)

#### **Fulfill Purchase Order**

- **Endpoint**: `POST /purchase-orders/:purchaseOrderId/fulfill`
- **Status transition**: `APPROVED` → `FULFILLED`

#### **Status State Machine**

```
DRAFT → SUBMITTED → APPROVED → FULFILLED
                  ↘ REJECTED (terminal)
```

Any invalid status transition returns `409`.

#### **Idempotency**

When `Idempotency-Key` is provided on POST/PUT requests:

- **First request**: Executes the handler and stores the result keyed by `(key, actorId, method, path, requestHash)`.
- **Duplicate request** (same key + same payload hash): Returns the stored response (replay).
- **Same key, different payload**: Returns `409` (`IdempotencyPayloadMismatchError`).
- **Same key while original is still processing**: Returns `409` (`IdempotencyRequestInProgressError`).

---

### 👥 Users

#### **List Users**

Retrieve active users. Can also look up a single user by `id` or `email` via query params.

- **Endpoint**: `GET /users`
- **Query Parameters**:

| Parameter | Type    | Default | Description                                               |
| --------- | ------- | ------- | --------------------------------------------------------- |
| `limit`   | Integer | `200`   | Max users to return (max 500). Used when listing all.     |
| `id`      | String  | -       | Lookup a single user by ID. Cannot combine with `email`.  |
| `email`   | String  | -       | Lookup a single user by email. Cannot combine with `id`.  |

- If `id` or `email` is provided, returns a single user object or `404`.
- If neither is provided, returns an array of users.

#### **Get Single User**

- **Endpoint**: `GET /users/single-user`
- **Query Parameters**:

| Parameter | Type   | Required      | Description                                       |
| --------- | ------ | ------------- | ------------------------------------------------- |
| `id`      | String | Either id or email | User UUID.                                   |
| `email`   | String | Either id or email | User email (lowercased, must contain `@`).   |

- Returns single user or `404`.

#### **Create User**

- **Endpoint**: `POST /users`
- **Body**:

| Field       | Type   | Required | Validation                  |
| ----------- | ------ | -------- | --------------------------- |
| `email`     | String | Yes      | Trimmed, lowercased, must contain `@` |
| `password`  | String | Yes      | Min 8 characters            |
| `department`| String | Yes      | Trimmed, non-empty          |

- **Response** (`201`):

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "departmentId": "dept-uuid",
  "createdBy": null,
  "createdAt": "2026-02-20T...",
  "updatedAt": "2026-02-20T..."
}
```

---

### 🏢 Departments

#### **List Departments**

Retrieve all departments, ordered by `createdAt DESC`.

- **Endpoint**: `GET /departments`

#### **Create Department**

- **Endpoint**: `POST /departments`
- **Body**:

| Field         | Type   | Required | Validation              |
| ------------- | ------ | -------- | ----------------------- |
| `name`        | String | Yes      | Min 1, max 120 chars, trimmed |
| `description` | String | Yes      | Min 1 char, trimmed     |

- Returns `409` if a department with the same name (case-insensitive) already exists.
- **Response** (`201`): Created department entity.

---

### 📡 Event Bus

Internal event routing service. Receives events and fans them out to registered downstream services.

#### **Get Service Info**

- **Endpoint**: `GET /event-bus`
- **Response**: `{ "service": "event-bus", "routes": ["/events", "/events/failed", "/sync"] }`

#### **Get Registered Services**

- **Endpoint**: `GET /event-bus/sync`
- **Response**: Array of `{ "name": "...", "url": "..." }` for each registered service.

#### **Publish Event**

- **Endpoint**: `POST /event-bus/events`
- **Body**:

| Field    | Type   | Required | Description            |
| -------- | ------ | -------- | ---------------------- |
| `name`   | String | Yes      | Event name (trimmed).  |
| `body`   | Object | Yes      | Event payload.         |
| `source` | String | Yes      | Event source (trimmed).|
| `url`    | String | Yes      | Originating URL.       |

- Unknown fields are allowed.
- **Response** (`202`): `{ "message": "Event accepted for async processing", "accepted": true }`

#### **List Events**

- **Endpoint**: `GET /event-bus/events`
- **Query Parameters**:

| Parameter | Type     | Default      | Description                        |
| --------- | -------- | ------------ | ---------------------------------- |
| `name`    | String   | -            | Filter by event name.              |
| `source`  | String   | -            | Filter by source.                  |
| `from`    | ISO Date | `1970-01-01` | Start of date range.               |
| `to`      | ISO Date | now          | End of date range.                 |
| `order`   | String   | `DESC`       | `ASC` or `DESC`.                   |
| `limit`   | Integer  | `100`        | Max results (1–500).               |

#### **List Failed Event Deliveries**

- **Endpoint**: `GET /event-bus/events/failed`
- **Query Parameters**:

| Parameter       | Type     | Default      | Description                    |
| --------------- | -------- | ------------ | ------------------------------ |
| `targetService` | String   | **Required** | Target service name.           |
| `name`          | String   | -            | Filter by event name.          |
| `source`        | String   | -            | Filter by source.              |
| `from`          | ISO Date | `1970-01-01` | Start of date range.           |
| `to`            | ISO Date | now          | End of date range.             |
| `limit`         | Integer  | `100`        | Max results (1–500).           |

---

### ⚙️ System

#### **Health Check**

- **Endpoint**: `GET /health`
- **Response**: `{ "status": "ok", "service": "api-gateway" }`

#### **Warm Up Gateway**

Initiates a warm-up sequence across all downstream services. Returns a session ID for tracking progress.

- **Endpoint**: `GET /warm-up`
- **Response**: `{ "id": "...", "status": "...", "createdAt": "...", "statusUrl": "...", "streamUrl": "..." }`

#### **Warm-Up Status**

Get the current status of a warm-up session.

- **Endpoint**: `GET /warm-up/status/:id`
- **Path Parameters**: `id` (string) — warm-up session UUID.
- **Response**: Full warm-up job object with per-service statuses.

#### **Warm-Up Stream**

Live SSE stream of warm-up progress.

- **Endpoint**: `GET /warm-up/stream/:id`
- **Path Parameters**: `id` (string) — warm-up session UUID.
- **Response**: `Content-Type: text/event-stream`
  - Event `snapshot`: Initial full job state.
  - Event `update`: Per-service status change.
  - Event `done`: Final completed job state.

#### **API Specifications**

- **Endpoint**: `GET /api-specifications`
- **Response**: Links to `/docs` and `/openapi.json` for the gateway and each downstream service.

#### **Swagger / OpenAPI**

- **Gateway**: `GET /docs`, `GET /openapi.json`
- **Per-service**: `GET /{service}/docs`, `GET /{service}/openapi.json`

#### **Global Bulk Import**

Run a bulk catalog import with optional user backfill.

- **Endpoint**: `POST /global/bulk`
- **Body**:

| Field             | Type    | Required | Default | Description                       |
| ----------------- | ------- | -------- | ------- | --------------------------------- |
| `catalogItems`    | Array   | Yes      | -       | Array of catalog item objects.    |
| `runUserBackfill` | Boolean | No       | `true`  | Whether to also run user backfill.|

- **Response**: `{ "ok": true, "steps": [ { "step": "...", "ok": true, "status": 201, "body": ... } ] }`

#### **Gateway Events**

- **Endpoint**: `POST /events`
- **Body**:

| Field       | Type   | Required | Description                  |
| ----------- | ------ | -------- | ---------------------------- |
| `name`      | String | Yes      | Event name (non-empty).      |
| `body`      | Object | Yes      | Event payload.               |
| `source`    | String | Yes      | Event source (non-empty).    |
| `url`       | String | Yes      | Originating URL (non-empty). |
| `id`        | String | No       | Optional event ID.           |
| `timestamp` | String | No       | Optional ISO 8601 timestamp. |

- **Response**: `{ "accepted": true, "eventName": "..." }`

---

## 🚨 Error Handling

The API uses standard HTTP status codes. Errors use the same envelope with `error: true`:

```json
{
  "AppName": "Refinery",
  "Version": "1.0.0",
  "status": 400,
  "error": true,
  "body": null,
  "message": "Invalid budget code format."
}
```

| Status Code           | Description                                       |
| --------------------- | ------------------------------------------------- |
| `200 OK`              | Request succeeded.                                |
| `201 Created`         | Resource created successfully.                    |
| `202 Accepted`        | Request accepted for async processing.            |
| `400 Bad Request`     | Invalid parameters or malformed body.             |
| `401 Unauthorized`    | Authentication failed or session expired.         |
| `403 Forbidden`       | User does not have permission.                    |
| `404 Not Found`       | Resource not found.                               |
| `409 Conflict`        | State conflict (e.g., invalid status transition, supplier mismatch, duplicate name, idempotency collision). |
| `429 Too Many Requests` | Rate limit exceeded.                            |
| `500 Internal Error`  | Server encountered an unexpected condition.       |
| `502/503/504`         | Upstream service unavailable.                     |
