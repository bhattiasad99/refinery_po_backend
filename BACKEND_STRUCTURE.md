# Backend Structure Guide

This repository is a workspace-based monorepo where each service should follow the same layout for predictability.

## Standard service layout

Use this structure in every service:

- `src/app.ts`: HTTP route wiring.
- `src/index.ts`: process bootstrap and server listen.
- `src/db/`: TypeORM data source and DB bootstrap helpers.
- `src/entities/`: persistence models.
- `src/services/`: business logic and integration workflows.
- `src/schemas/`: request/query validation schemas.
- `src/middleware/`: shared request middleware for the service.
- `src/lib/`: framework-agnostic helpers/utilities.
- `src/*.test.ts`: route/service unit tests close to source.

## Naming conventions

- Use verb-first service filenames: `receive-event.service.ts`, `get-events.service.ts`.
- Prefer pluralized validation folders: `schemas` (not `schema`).
- Keep entity names singular and explicit, e.g. `purchase-order.entity.ts`.

## Code hygiene rules

- Keep route handlers thin; move business rules into `services/`.
- Add short intent comments only around complex transformations, transactional logic, or async fan-out.
- Preserve deterministic update semantics for arrays and multi-step payloads (replace-on-write when intended).
- Keep cross-service event contracts normalized at the boundary (trim strings, validate shape).
