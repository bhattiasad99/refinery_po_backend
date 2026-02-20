# Refinery PO - API Specifications

Welcome to the **Refinery PO API Documentation**. This document provides a comprehensive guide to the API endpoints used by the Refinery Purchase Order frontend application.

These endpoints act as a Backend-for-Frontend (BFF) layer, proxying requests to the upstream API Gateway while handling authentication, session management, and ensuring a seamless developer experience.

---

## 🚀 Overview

- **Base URL**: `/api` (Relative to the frontend application)
- **Response Format**: JSON
- **Authentication**: Cookie-based (HttpOnly `access_token`, `refresh_token`)

---

## 🛠️ Common Headers

| Header            | Type     | Required | Description                                                                 |
| ----------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `Content-Type`    | String   | Yes      | Must be `application/json` for POST/PUT requests.                           |
| `Idempotency-Key` | String   | Optional | Unique key to prevent duplicate operations (e.g., creating the same PO twice). |

---

## 📚 Endpoints

### 📦 Catalog

Managed catalog items available for purchase.

#### **Get Catalog Items**
Retrieve a paginated list of catalog items with optional filtering.

- **Endpoint**: `GET /api/catalog`
- **Query Parameters**:

| Parameter         | Type    | Default | Description                                      |
| ----------------- | ------- | ------- | ------------------------------------------------ |
| `page`            | Integer | `1`     | Page number.                                     |
| `limit`           | Integer | `20`    | Items per page (max 200).                        |
| `search`          | String  | -       | General search term.                             |
| `q`               | String  | -       | Quick search query.                              |
| `category`        | String  | -       | Filter by category name.                         |
| `inStock`         | Boolean | -       | `true` or `false` to filter by stock availability. |
| `sort`            | String  | -       | Sort field (e.g., `price_asc`, `name_desc`).     |
| `simulateDelayMs` | Integer | `0`     | Artificial delay for testing loading states (max 3000ms). |

#### **Get Catalog Filters**
Retrieve available filter options for the catalog (e.g., categories).

- **Endpoint**: `GET /api/catalog/filters`

---

### 🛒 Purchase Orders

Manage purchase orders, including drafting, creation, and retrieval.

#### **List Purchase Orders**
Retrieve a list of all purchase orders.

- **Endpoint**: `GET /api/purchase-orders`

#### **Create Purchase Order**
Create a new purchase order. Supports idempotency to prevent duplicate creations.

- **Endpoint**: `POST /api/purchase-orders`
- **Headers**: `Idempotency-Key` (Recommended)
- **Body**: JSON object representing the purchase order draft.

```json
{
  "requestedByDepartment": "Engineering",
  "requestedByUser": "user-uuid",
  "budgetCode": "ENG-2024-Q1",
  "supplierName": "Acme Corp",
  "items": [...],
  "paymentTerms": "NET_30"
}
```

#### **Get Purchase Order**
Retrieve a specific purchase order by ID.

- **Endpoint**: `GET /api/purchase-orders/:purchaseOrderId`

#### **Update Purchase Order**
Update an existing purchase order.

- **Endpoint**: `PUT /api/purchase-orders/:purchaseOrderId`
- **Headers**: `Idempotency-Key` (Recommended)
- **Body**: Partial or full update of the purchase order.

---

### 🏭 Suppliers

#### **List Suppliers**
Retrieve a list of approved suppliers.

- **Endpoint**: `GET /api/suppliers`
- **Query Parameters**:

| Parameter | Type    | Default | Description               |
| --------- | ------- | ------- | ------------------------- |
| `page`    | Integer | `1`     | Page number.              |
| `limit`   | Integer | `10`    | Items per page (max 100). |
| `search`  | String  | -       | Search by supplier name.  |

---

### 👥 Users & Departments

#### **List Users**
Retrieve active users in the system.

- **Endpoint**: `GET /api/users`
- **Query Parameters**:
  - `limit`: Max records to return (default 200, max 500).

#### **List Departments**
Retrieve all available departments.

- **Endpoint**: `GET /api/departments`

---

### ⚙️ System

#### **Warm Up Gateway**
Initiates a warm-up sequence for the backend gateway service. Useful for checking service availability and waking up dormant instances.

- **Endpoint**: `GET /api/warm-up`
- **Response**:
  - `200`: Gateway is ready.
  - `503`: Gateway is currently unavailable.

---

## 🚨 Error Handling

The API uses standard HTTP status codes to indicate success or failure.

| Status Code | Description                                      |
| ----------- | ------------------------------------------------ |
| `200 OK`    | Request succeeded.                               |
| `400 Bad Request` | Invalid parameters or malformed body.            |
| `401 Unauthorized`| Authenticaton failed or session expired.         |
| `403 Forbidden`   | User does not have permission.                   |
| `404 Not Found`   | Resource not found.                              |
| `429 Too Many Requests` | Rate limit exceeded.                       |
| `500 Internal Error` | Server encountered an unexpected condition.      |
| `502/503/504`     | Upstream Gateway unavailable.                    |

Errors typically return a JSON body with a descriptive message:

```json
{
  "message": "Invalid budget code format.",
  "body": null
}
```
