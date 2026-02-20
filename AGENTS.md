# AGENTS.md - Backend AI Collaboration Guide

## Purpose
This backend is an interview challenge. Use AI to accelerate implementation, but keep architecture decisions explicit, observable, and defensible.

## Project Context
- App: `refinery_po_backend`
- Architecture: microservices + API gateway + event bus
- Core concerns: service boundaries, idempotency, status lifecycle, event-driven consistency

## Agent Behavior
- Inspect service-local files first (`src/app.ts`, `src/services`, `src/entities`, `src/openapi.ts`).
- Keep changes isolated to the relevant service unless cross-service updates are required.
- Document tradeoffs when touching contracts, events, or persistence.

## Backend Quality Gates
Run the smallest valid verification set for changed services:
- service tests (Vitest/Supertest where applicable)
- lint/type checks if configured
- contract validation via OpenAPI paths when endpoints change

When full verification is not possible, list exact gaps.

## Implementation Rules
- Preserve data ownership per service; avoid cross-service DB coupling.
- Keep write paths idempotent for mutating purchase-order operations.
- Maintain single-supplier enforcement in service logic and DB constraints.
- If event schemas change, update publishers, consumers, and docs together.
- Keep route handlers thin; business logic stays in service layer.

## AI Usage Evidence (Interview Transparency)
For substantial tasks, add this note in your PR/summary:

```md
### AI Activity Log
- Task:
- Services/files changed:
- AI-assisted parts:
- Human decisions/review performed:
- Verification run (tests/lint/contracts):
- Event or schema impact:
```

## Non-Goals
- Do not bypass gateway/auth assumptions.
- Do not introduce breaking API changes without explicit note.
- Do not hide partial migrations or unverified event impacts.
