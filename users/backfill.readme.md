# Backfill Guide (Simple)

## What this does
This backfill sends missing `user_created` events for old users that were created before event publishing existed.

It is safe to run many times.

## Route to run
`POST /users/back-fill/create_users`

Example through API Gateway:
`POST http://localhost:8000/users/back-fill/create_users`

## What response means
You will get:

```json
{
  "processed": 10,
  "published": 8,
  "skipped": 2,
  "failed": 0
}
```

- `processed`: how many users were checked
- `published`: how many new events were sent now
- `skipped`: already handled before (no duplicate event)
- `failed`: failed rows (check logs, run again later)

## Safe behavior
- Uses `published_users` table to remember completed users.
- Uses primary key + conflict handling, so duplicates are avoided.
- If one row fails, the process continues with other rows.
- If publish fails for a user, marker is removed so retry works later.

## Needed env vars
- `SERVICE_EVENT_BUS_URL`
- `SERVICE_USERS_URL` (used for `url` field in event payload)
- `INTERNAL_SERVICE_KEY` (if your services require it)

## Event format sent to Event Bus
```json
{
  "name": "user_created",
  "body": {
    "id": "<id>",
    "email": "<email>",
    "departmentId": "<departmentId>",
    "createdBy": "<created_by|null>",
    "createdAt": "<created_at>",
    "updatedAt": "<updated_at>"
  },
  "source": "users",
  "url": "http://.../back-fill/create_users"
}
```

## How to copy this to another service
Do these small steps:

1. Copy `src/services/backfill.provider.ts` to the other service.
2. Add one route in that service app file, for example:
   - `POST /back-fill/create_products`
3. In that route, call:
   - `ensureTrackingTable(...)` with a new table name
   - `backfill(...)` with that service table + event mapping
4. Set:
   - `eventType` (example: `product_created`)
   - `eventSource` (example: `catalog`)
   - `eventUrl` (route URL in that service)
5. Restart service and call the route.

## Quick template for another service
```ts
await backfillProvider.ensureTrackingTable({
  tableName: "published_products",
  idColumn: "product_id",
  idType: "uuid",
});

const result = await backfillProvider.backfill<{
  id: string;
  name: string;
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}>({
  sourceTable: "products",
  sourceIdColumn: "id",
  sourceColumns: ["id", "name", "created_by", "created_at", "updated_at"],
  trackingTable: "published_products",
  trackingIdColumn: "product_id",
  eventType: "product_created",
  eventSource: "catalog",
  eventUrl: "http://catalog:3000/back-fill/create_products",
  mapRowToPayload: (row) => ({
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }),
  batchSize: 500,
});
```

## If you see failures
1. Check users logs for error message.
2. Check Event Bus logs for validation error.
3. Fix payload/env issue.
4. Run the same backfill route again.
