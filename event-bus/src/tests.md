# Event Bus API Tests (Simple View)

This file explains the tests from `event-bus/src/app.test.ts` in plain English.

| Test Case | Endpoint | Input / Setup | Expected Result |
| --- | --- | --- | --- |
| Health check works | `GET /health` | No auth header needed | `200` and body is `{ ok: true }` |
| Sync endpoint is reachable with internal key | `GET /sync` | Header: `x-internal-key: test-key` | `200` and response is an array |
| Sync endpoint is blocked without key | `GET /sync` | No `x-internal-key` header | `403` |
| Create event fails on invalid body | `POST /events` | Missing required field `name` in request body | `400` and `ok: false` |
| Create event succeeds with valid body | `POST /events` | Valid event payload, service call is mocked | `201` and summary response with `eventId`, `total`, `success`, `failed` |
| Events list rejects invalid date | `GET /events?from=not-a-date` | Header: `x-internal-key: test-key` | `400` and message `from and to must be valid ISO dates` |
| Events list returns data | `GET /events?name=product.created&limit=1` | `getEvents` service is mocked to return one item | `200` and same list is returned |
| Failed events requires target service | `GET /events/failed` | Header: `x-internal-key: test-key`, no `targetService` | `400` and message `targetService is required` |
| Failed events returns data | `GET /events/failed?targetService=catalog` | `getFailedEvents` service is mocked to return one failed record | `200` and same list is returned |

## Notes

- These are API-level route tests.
- Service/database work is mocked to keep tests simple.
- Internal-key middleware behavior is included in the checks.
