# Refinery PO Backend

## Assignment Checklist (Document Date: 2026-02-12)

### Architecture Requirements
- [x] Service boundaries defined (`catalog` + `purchase-orders` minimum, plus supporting services).
- [x] Data ownership documented per service.
- [x] Synchronous APIs defined.
- [x] Optional asynchronous event model documented (`event-bus`, publish/subscribe flow).
- [x] Idempotency and failure handling described.

### API Requirements
- [x] OpenAPI/Swagger specification provided for services.
- [x] Catalog endpoints support search/filter/sort.
- [x] Procurement endpoints support draft creation, line management, PO submission, and status transitions.
- [x] `409 Conflict` behavior documented for supplier mismatch scenarios.

### Database Requirements
- [x] Explicit schema documented with keys, constraints, and indexes.
- [x] Single-supplier enforcement covered at both service and database levels.
- [x] PO number generation strategy defined.
- [x] Status timeline/audit table implemented (`purchase_order_status_history`).

### Evaluation Focus Coverage
- [x] Service boundary clarity.
- [x] Schema quality.
- [x] API usability.
- [x] Idempotency handling.
- [x] Lifecycle modeling.
- [x] Practical production-oriented design.

<p align="center">
  An event-driven procurement backend built as a multi-service monorepo with clear service boundaries,
  resilient asynchronous communication, and production-minded operational tooling.
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20+-339933" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6" />
  <img alt="Express" src="https://img.shields.io/badge/Express-5-000000" />
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-API%20Gateway-E0234E" />
  <img alt="TypeORM" src="https://img.shields.io/badge/TypeORM-0.3-E83524" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Event%20Store%20%2B%20Service%20DBs-336791" />
</p>

## Why This Backend Stands Out

- Clear domain decomposition: `catalog`, `purchase-orders`, `departments`, and `users` are independently deployable services.
- Event-first integration model with an internal `event-bus` that persists and fans out events to subscribers.
- A single external entrypoint (`api-gateway`) with auth propagation, unified error handling, and service proxying.
- Real-world resilience patterns: idempotent writes, projection catch-up, async publish, and delivery status tracking.

---

## System Architecture

```mermaid
flowchart LR
    FE[Frontend / API Consumer] --> GW[api-gateway\nNestJS]

    GW --> PO[purchase-orders\nExpress + TypeORM]
    GW --> CAT[catalog\nExpress + TypeORM]
    GW --> DEP[departments\nExpress + TypeORM]
    GW --> USR[users\nExpress + TypeORM]
    GW --> EB[event-bus\nExpress + TypeORM]

    PO --> EPOST[POST /events]
    CAT --> EPOST
    DEP --> EPOST
    USR --> EPOST
    EPOST --> EB

    EB --> S1[/events -> catalog/]
    EB --> S2[/events -> purchase-orders/]
    EB --> S3[/events -> users/]
    EB --> S4[/events -> api-gateway/]

    PO --> PODB[(purchase-orders DB)]
    CAT --> CATDB[(catalog DB)]
    DEP --> DEPDB[(departments DB)]
    USR --> USRDB[(users DB)]
    EB --> EDB[(event-bus DB\nevent_store + delivery status)]
```

### Architecture Explanation

1. `api-gateway` is the north-south entrypoint. It validates auth, forwards requests, and injects internal headers (`x-user-*`, `x-internal-key`) to downstream services.
2. Domain services own their write models and service-local databases.
3. After successful writes, services publish domain events to `event-bus` (`POST /events`).
4. `event-bus` persists every event, then asynchronously fans it out to registered services.
5. Subscriber services consume events through their `POST /events` endpoints to build or refresh local projections.
6. Some services run startup catch-up sync from `event-bus` (`GET /events`) to heal missed events and ensure eventual consistency.

---

## Event Pipeline (Publish/Subscribe)

```mermaid
sequenceDiagram
    participant S as Source Service
    participant B as event-bus
    participant DB as event_store
    participant T1 as Target Service A
    participant T2 as Target Service B
    participant D as event_delivery_status

    S->>B: POST /events {name, body, source, url}
    B->>S: 202 Accepted (async processing)

    B->>DB: Persist immutable event row
    B->>T1: POST /events (fanout)
    B->>T2: POST /events (fanout)

    B->>D: Save per-target delivery result
```

### What This Gives You

- Decoupled services (publishers do not call every consumer directly).
- Replayable integration history via `event_store`.
- Operational visibility via `event_delivery_status` and `/events/failed`.
- Lower write-path latency for producers (`202 Accepted`, async fanout).

---

## Design Patterns Used

## 1) Publish/Subscribe (Event-Driven)

- Publishers: `catalog`, `departments`, `purchase-orders`, `users`.
- Broker: `event-bus`.
- Subscribers: services implementing `POST /events` handlers.

Pattern in code:

- Services emit with `emitAfterWrite(...)` helpers.
- `event-bus` stores and fans out to `getRegisteredServices()` list.
- Consumers route by event name/source and update local state.

This enables loose coupling and autonomous service evolution.

## 2) Event Store Pattern (Event-Sourcing Foundation)

`event-bus` persists each accepted event in `event_store` with immutable attributes (`id`, `timestamp`, `name`, `data`, `source`, `url`).

This acts as:

- An integration audit log.
- A replay source for projection rebuild/catch-up.
- A temporal backbone for analytics (for example, dashboard daily PO series fallback/derivation).

Important nuance:

- This is not full aggregate event sourcing for every write model.
- Domain services still persist current state in service-owned tables.
- Event store is used as an event-sourcing style integration ledger and replay source.

## 3) CQRS-Style Read Projections

`purchase-orders` and `users` consume events and maintain local projection tables for fast reads without cross-service joins.

Examples:

- `users` builds department projection from `create_department` events.
- `purchase-orders` syncs catalog/supplier/category/user/department projections from event stream.

Benefits:

- Query performance and local autonomy.
- Reduced runtime coupling between services.
- Eventually consistent but operationally robust read models.

## 4) Idempotent Write Handling

`purchase-orders` supports `idempotency-key` headers for mutating endpoints.

Behavior:

- First request starts processing and records request hash.
- Identical replay returns stored response.
- Conflicting payload for same key returns a conflict.
- In-progress duplicates are rejected safely.

This prevents duplicate side effects during retries/timeouts.

## 5) API Gateway / Reverse Proxy Pattern

`api-gateway` provides:

- Unified ingress for frontend and external clients.
- Service routing by first path segment (`/{service}/...`).
- Auth verification and propagation of user context to internal services.
- Uniform success/error response envelope.

This centralizes cross-cutting concerns while keeping services focused on domain logic.

## 6) Repository + Service Layer Pattern

Across services, route handlers stay thin while business logic lives in `src/services/` and persistence is managed via TypeORM repositories/entities.

This improves testability and keeps transport concerns separated from domain workflows.

---

## Purchase Order Lifecycle (Domain Flow)

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: submit
    SUBMITTED --> APPROVED: approve
    SUBMITTED --> REJECTED: reject
    APPROVED --> FULFILLED: fulfill
    REJECTED --> [*]
    FULFILLED --> [*]
```

`purchase-orders` also records status transitions into `purchase_order_status_history`, giving you a timeline of state changes (`from_status`, `to_status`, `changed_by`, `changed_at`).

---

## Service Map

| Service | Role | Key Responsibilities |
|---|---|---|
| `api-gateway` | Ingress + auth edge | Proxy routing, auth/login/refresh/logout, header enrichment, global bulk orchestration |
| `event-bus` | Event backbone | Store accepted events, fanout delivery, delivery status tracking, historical queries |
| `catalog` | Product master data | Catalog browse/search/filter/suppliers, bulk upsert, emits catalog/category/supplier events |
| `purchase-orders` | Core procurement workflow | Draft/edit/submit/approve/reject/fulfill, status history, idempotency, projection syncing |
| `departments` | Organization reference data | Department CRUD-lite and department creation events |
| `users` | Identity + sessions | User creation/query/auth verification, refresh session lifecycle, department projection |

---

## Tech Stack

- Runtime: Node.js, TypeScript
- HTTP: Express (domain services), NestJS (gateway)
- ORM/DB: TypeORM + PostgreSQL per service
- Validation: Joi + explicit schema parsers
- API Docs: Swagger/OpenAPI on each HTTP service
- Testing: Vitest + Supertest (service-level)
- Infra/dev: Docker Compose + workspace automation scripts

---

## Quick Start

## 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose
- PostgreSQL URLs for each service DB

## 2. Install

```bash
npm install
```

## 3. Configure Environment

Use `.env.local` for local stack and `.env.production` for production-like isolated runs.

Core keys used across services:

```env
INTERNAL_SERVICE_KEY=your-shared-secret

API_GATEWAY_PORT=8000
EVENT_BUS_PORT=8001
CATALOG_PORT=8002
PURCHASE_ORDERS_PORT=8003
DEPARTMENTS_PORT=8004
USERS_PORT=8005

JWT_ACCESS_SECRET=your-jwt-secret
JWT_ACCESS_TTL_SECONDS=600
REFRESH_TOKEN_TTL_DAYS=30
AUTH_COOKIE_NAME=rt

SERVICE_API_GATEWAY_URL=http://api-gateway:8000
SERVICE_EVENT_BUS_URL=http://event-bus:8001
SERVICE_CATALOG_URL=http://catalog:8002
SERVICE_PURCHASE_ORDERS_URL=http://purchase-orders:8003
SERVICE_DEPARTMENTS_URL=http://departments:8004
SERVICE_USERS_URL=http://users:8005

EVENT_BUS_DATABASE_URL=postgres://...
CATALOG_DATABASE_URL=postgres://...
PURCHASE_ORDERS_DATABASE_URL=postgres://...
DEPARTMENTS_DATABASE_URL=postgres://...
USERS_DATABASE_URL=postgres://...
```

## 4. Sync Local Stack

```bash
npm run sync:local-stack
```

This script scans workspaces/services and regenerates `docker-compose.yml` with:

- service commands (`dev`/`start:dev`/`start`)
- derived env wiring
- health checks
- dependency graph (`depends_on`)

## 5. Run Everything

```bash
npm run up:build
```

Stop stack:

```bash
npm run down
```

---

## API Docs

Gateway docs:

- `/docs`
- `/openapi.json`
- `/api-specifications`

Service docs through gateway:

- `/catalog/docs`
- `/purchase-orders/docs`
- `/departments/docs`
- `/users/docs`

---

## Auth Flow (Gateway + Users)

```mermaid
sequenceDiagram
    participant C as Client
    participant G as api-gateway
    participant U as users

    C->>G: POST /auth/login
    G->>U: POST /verify-credentials
    U-->>G: user authenticated
    G->>U: POST /auth/sessions (store refresh hash)
    G-->>C: access token + refresh cookie

    C->>G: POST /auth/refresh (with refresh cookie)
    G->>U: POST /auth/sessions/rotate
    U-->>G: new session + user
    G-->>C: new access token + rotated refresh cookie
```

---

## Projection Sync and Replay

At startup, services can backfill their projections from historical events.

- `users` calls event-bus for `create_department` history.
- `purchase-orders` performs cursor-based incremental sync from event-bus and persists cursor in `projection_sync_state`.

This gives eventual consistency with replay-based recovery if a service was down during event fanout.

---

## Local Monorepo Structure

```text
refinery_po_backend/
  api-gateway/         # NestJS ingress/proxy/auth edge
  event-bus/           # event store + fanout + delivery tracking
  catalog/             # catalog + suppliers + categories
  purchase-orders/     # PO workflow + status machine + projections + idempotency
  departments/         # departments service + create events
  users/               # users + credential verify + refresh sessions + projections
  scripts/             # stack sync, service lifecycle helpers
  BACKEND_STRUCTURE.md # service layout conventions
```

---

## Development Scripts

Root scripts:

```bash
npm run new:service         # scaffold new workspace service
npm run sync:local-stack    # regenerate docker-compose from workspaces
npm run up                  # start compose stack
npm run up:build            # build and start stack
npm run down                # stop stack
npm run del:service -- <name>
npm run del:service-unsafe -- <name>
```

Per service (common):

```bash
npm run dev
npm run dev:prod
npm run test
npm run test:watch
npm run test:cov
```

---

## Engineering Notes

- Internal traffic is protected by `INTERNAL_SERVICE_KEY` and `x-internal-key` validation on service routes.
- Event payloads are sanitized before emission (sensitive fields like `password` are excluded).
- `purchase-orders` enforces business invariants such as single-supplier line items and valid status transitions.
- Async event emission is intentionally non-blocking on write paths to keep API latency predictable.
- `event-bus` keeps failure telemetry for downstream delivery, enabling retry/reconciliation workflows.

---

## Production Readiness Checklist

- `npm run sync:local-stack` executed after adding/removing services.
- Required env keys are set for every service URL, DB URL, and auth secret.
- All service `/health` endpoints pass.
- Gateway can reach downstream services.
- Event-bus `/events` ingest and `/events/failed` diagnostics are healthy.
- Service tests pass (`npm run test` in each workspace).

---

## Related Docs

- Backend conventions: [`BACKEND_STRUCTURE.md`](BACKEND_STRUCTURE.md)
- Gateway module details: [`api-gateway/README.md`](api-gateway/README.md)
- Users backfill notes: [`users/backfill.readme.md`](users/backfill.readme.md)
