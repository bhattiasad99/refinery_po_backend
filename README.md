# Refinery PO Backend

This repo has 4 apps:

- `api-gateway`
- `event-bus`
- `catalog`
- `purchase-orders`

## Env Strategy (Only 2 Files)

You now manage env from root using only:

- `.env.local` (for local Docker)
- `.env.production` (reference for production/Render values)

Prefix rules:

- `GLOBAL_*` -> shared values for all apps
- `<APP>_*` -> app-specific values (`API_GATEWAY_*`, `EVENT_BUS_*`, `CATALOG_*`, `PURCHASE_ORDERS_*`)
- `SERVICE_*` -> URL routing values used by `api-gateway` (and later by `event-bus`)

Example files:

- `.env.local.example`
- `.env.production`

## Local Run (Exact Order)

1. Launch Docker Desktop first.  
Wait until Docker Desktop shows it is running.

2. Install dependencies once:

```powershell
npm install
```

3. Prepare env:

```powershell
Copy-Item .env.local.example .env.local
```

Then update values in `.env.local` (especially DB URLs).

4. Regenerate local stack files:

```powershell
npm run sync:local-stack
```

5. Start all services (build + run):

```powershell
docker compose --env-file .env.local up --build
```

6. Stop all services:

```powershell
docker compose --env-file .env.local down
```

7. Start again without rebuild:

```powershell
docker compose --env-file .env.local up
```

## Prod Compose (Optional Local Test)

`docker-compose.prod.yml` is wired to `.env.production`.

Build + run:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Run without rebuild:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.production up
```

Stop:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

## Render (Simple, Per App)

Deploy each app as a separate Render service:

1. `api-gateway`
2. `event-bus`
3. `catalog`
4. `purchase-orders`

Set env vars manually in each Render project.

### `api-gateway` Render env

- `PORT`
- `INTERNAL_SERVICE_KEY` (same shared secret as other apps)
- `SERVICE_CATALOG_URL`
- `SERVICE_PURCHASE_ORDERS_URL`

### `event-bus` Render env

- `PORT`
- `DATABASE_URL`
- `INTERNAL_SERVICE_KEY`
- `SERVICE_CATALOG_URL`
- `SERVICE_PURCHASE_ORDERS_URL`

### `catalog` Render env

- `PORT`
- `DATABASE_URL`
- `INTERNAL_SERVICE_KEY`
- `EVENT_BUS_URL`

### `purchase-orders` Render env

- `PORT`
- `DATABASE_URL`
- `INTERNAL_SERVICE_KEY`
- `EVENT_BUS_URL`

## Why `services.local.json` Is No Longer Needed On Render

Gateway now supports direct env routing:

- `SERVICE_CATALOG_URL=...`
- `SERVICE_PURCHASE_ORDERS_URL=...`

So Render can work fully from env vars without a JSON file.

`services.local.json` remains only for local convenience/fallback.

## Add New Service

1. Stop local containers first:

```powershell
docker compose --env-file .env.local down
```

2. Create service:

```powershell
npm run new:service
```

3. Add new service vars in both:

- `.env.local`
- `.env.production`

Use your service prefix, for example `INVENTORY_PORT`, `INVENTORY_DATABASE_URL`, and `SERVICE_INVENTORY_URL`.

4. Regenerate stack files:

```powershell
npm run sync:local-stack
```

5. Start again:

```powershell
docker compose --env-file .env.local up --build
```

## Delete Service

Normal business service delete:

```powershell
npm run del:service -- <service-name>
```

Infra service delete (unsafe):

```powershell
npm run del:service-unsafe -- <service-name>
```

After delete, run local again:

```powershell
docker compose --env-file .env.local up --build
```
