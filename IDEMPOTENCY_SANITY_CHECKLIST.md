# Backend Idempotency Sanity Checklist

Use this checklist to validate purchase-order idempotency behavior from request ingress to persistence replay.

## 1) Code navigation checks

- Route-level idempotency wrapper exists:
  - `purchase-orders/src/app.ts` (`runWithIdempotency`)
- Persistence and replay logic exists:
  - `purchase-orders/src/services/idempotency.service.ts`
- Unique key scope is enforced in DB model:
  - `purchase-orders/src/entities/idempotency-record.entity.ts`
- API contract documents behavior:
  - `api-specifications.md` (`Idempotency` section)
- Frontend default key generation and wiring exists:
  - `../refinery_po_frontend/src/lib/idempotency/purchase-order-idempotency.ts`
  - `../refinery_po_frontend/src/components/use-case/CreatePurchaseOrderFlow/purchase-order-client.ts`

## 2) Automated checks

Run from `refinery_po_frontend`:

```bash
npm run lint
npm run test
npm run build
```

Run from `refinery_po_backend/purchase-orders`:

```bash
npm run build
npm run test
```

Expected:

- Frontend checks pass.
- Purchase-orders service compiles and tests pass (or failures are explicitly explained).

## 3) Runtime behavior checks (manual)

1. Send a purchase-order mutation with `Idempotency-Key: K1`.
2. Repeat the same request with same key and same payload.
3. Verify response is replayed and no duplicate domain side effect is created.
4. Repeat with same key and different payload.
5. Verify `409` conflict (`IdempotencyPayloadMismatchError` semantics).
6. Trigger concurrent duplicate request with same key.
7. Verify one request succeeds and concurrent duplicate gets `409` (`IdempotencyRequestInProgressError` semantics).
