# Refinery PO Backend

This repository is a multi-service backend with:

- `api-gateway` (NestJS gateway/proxy)
- `event-bus` (event store + fanout delivery)
- `catalog`
- `purchase-orders`
- `departments`
- `users`

## Quick Navigation

- [Environment Model](#environment-model)
- [Local Stack](#local-stack)
- [Isolated Service Using Production Env](#isolated-service-using-production-env)
- [Backend Structure Guide](#backend-structure-guide)
- [Guidelines](#guidelines)
  - [A. Add a New Service (Automatic)](#a-add-a-new-service-automatic)
  - [B. Add a New Service (Manual)](#b-add-a-new-service-manual)
  - [C. Add a New Projection Table (Event-Driven)](#c-add-a-new-projection-table-event-driven)
  - [D. Projection Example in This Repo](#d-projection-example-in-this-repo)
  - [E. Verification Checklist](#e-verification-checklist)
- [Delete Service](#delete-service)
- [Sync Behavior](#sync-behavior)

## Environment Model

Only 2 root env files are used:

- `.env.local` for local Docker Compose
- `.env.production` for Render environment group and isolated `dev:prod` runs

Use flat, explicit keys:

- `INTERNAL_SERVICE_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `AUTH_COOKIE_NAME`
- `<SERVICE>_PORT`
- `<SERVICE>_DATABASE_URL`
- `SERVICE_<SERVICE>_URL`

Examples:

- `USERS_PORT`
- `USERS_DATABASE_URL`
- `SERVICE_USERS_URL`

## Local Stack

1. Install dependencies:

```powershell
npm install
```

2. Set values in `.env.local`.

3. Sync local stack files:

```powershell
npm run sync:local-stack
```

4. Run local stack:

```powershell
npm run up:build
```

5. Stop local stack:

```powershell
npm run down
```

## OpenAPI Docs

Each backend HTTP service exposes:

- `GET /docs` (Swagger UI)
- `GET /openapi.json` (raw OpenAPI JSON)

Through API gateway routing, you can access service docs at:

- `/catalog/docs`
- `/purchase-orders/docs`
- `/departments/docs`
- `/users/docs`

Gateway docs are available at:

- `/docs`
- `/openapi.json`
- `/api-specifications` (single index endpoint for all gateway/service docs links)

## Isolated Service Using Production Env

From inside a service folder:

```powershell
npm run dev:prod
```

This loads root `.env.production` values and runs the service on localhost.

## Backend Structure Guide

For folder conventions, naming rules, and code hygiene standards across all services, see:

- [`BACKEND_STRUCTURE.md`](BACKEND_STRUCTURE.md)

## Guidelines

### A. Add a New Service (Automatic)

Use this when you want the fastest setup.

1. Generate the service:

```powershell
npm run new:service
```

2. What this command already does:
- Creates the new service from Hygen template
- Adds it to root `package.json` workspaces
- Runs `npm run sync:local-stack`

3. Manually complete the required wiring:
- Add env keys in `.env.local`, `.env.production`, `.env.example`:
  - `<SERVICE>_PORT`
  - `<SERVICE>_DATABASE_URL`
  - `SERVICE_<SERVICE>_URL`
- Add the service route in `api-gateway/src/app.service.ts` inside `SERVICES`
- Add the service in `event-bus/src/lib/service-registry.ts` so it receives events

4. Start and verify:

```powershell
npm run up:build
```

### B. Add a New Service (Manual)

Use this when you are not using Hygen templates.

1. Create service folder with its own `package.json` and `src`.
2. Add workspace entry:

```powershell
node scripts/add-workspace.mjs <service-name>
```

3. Ensure service has at least one runnable script (`dev`, or `start:dev`, or `start`) so Docker sync can run it.
4. Add minimal required endpoints in service:
- `GET /health`
- `POST /events` (should accept event payload and return 200)
5. Add env keys in `.env.local`, `.env.production`, `.env.example`.
6. Register service for routing and event fanout:
- `api-gateway/src/app.service.ts` -> add entry in `SERVICES`
- `event-bus/src/lib/service-registry.ts` -> add entry in returned array
7. Regenerate compose:

```powershell
npm run sync:local-stack
```

8. Boot stack and test service health.

### C. Add a New Projection Table (Event-Driven)

Use this when one service needs read data owned by another service.

Flow:

1. Source service emits event (example: `create_<resource>`) to event bus.
2. Event bus stores it and forwards it to registered services (`/events`).
3. Target service receives event and upserts projection table.
4. Optional catch-up step reads historical events from `GET /events` on startup.

Implementation steps:

1. In source service, emit event after successful write:
- Event shape:
  - `name`: `create_<resource>`
  - `body`: projection-safe fields
  - `source`: source service name
  - `url`: request path
- Send to `POST ${SERVICE_EVENT_BUS_URL}/events`

2. In target service, add projection entity:
- Create entity in `src/entities/...`
- Include only fields needed for read/query use-cases

3. Add projection upsert service:
- Parse and validate event body
- Upsert by stable key (`id`)

4. Handle event in `POST /events` flow:
- Parse incoming event payload
- Route by `event.name`
- For matching event types, call projection upsert
- Ignore unknown events safely

5. Optional startup backfill/catch-up:
- On service start, call event bus `GET /events?name=create_<resource>&source=<owner>`
- Replay each event and run the same upsert function

### D. Projection Example in This Repo

Current pattern:

- Source: `departments` emits `create_department` in `departments/src/app.ts`
- Target: `users` consumes `create_department` in `users/src/services/events.service.ts`
- Projection table: `users/src/entities/department.entity.ts`
- Upsert logic: `users/src/services/department-projection.service.ts`
- Startup catch-up from event bus: `users/src/services/event-bus-sync.service.ts`, called in `users/src/index.ts`

This is the reference pattern to copy for new projections.

### E. Verification Checklist

After adding service/projection:

1. `GET /<service>/health` works through gateway.
2. Creating source resource emits an event to event bus.
3. Target service `/events` receives and accepts the event.
4. Projection row is visible in target DB table.
5. Restart target service and confirm startup catch-up still keeps projection correct.

## Delete Service

Normal delete:

```powershell
npm run del:service -- <service-name>
```

Infra delete (unsafe):

```powershell
npm run del:service-unsafe -- <service-name>
```

Safe delete blocks infra services unless unsafe flag is used.

## Sync Behavior

`npm run sync:local-stack`:

- Discovers services from workspaces and root service folders
- Regenerates local `docker-compose.yml`
