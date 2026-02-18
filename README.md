# Refinery PO Backend

Services in this repo:

- `api-gateway`
- `event-bus`
- `catalog`
- `purchase-orders`

## Environment Model

Only 2 root env files are used:

- `.env.local` for local Docker compose
- `.env.production` for Render environment group and isolated `dev:prod` runs

Use flat, explicit keys (no global prefixes and no generated env names):

- `INTERNAL_SERVICE_KEY`
- `API_GATEWAY_PORT`
- `EVENT_BUS_PORT`
- `CATALOG_PORT`
- `PURCHASE_ORDERS_PORT`
- `EVENT_BUS_DATABASE_URL`
- `CATALOG_DATABASE_URL`
- `PURCHASE_ORDERS_DATABASE_URL`
- `SERVICE_EVENT_BUS_URL`
- `SERVICE_CATALOG_URL`
- `SERVICE_PURCHASE_ORDERS_URL`

## Local Stack

1. Install dependencies:

```powershell
npm install
```

2. Set values directly in `.env.local`.

3. Sync generated local files:

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

## Isolated Service Using Production Env

From a service folder, run:

```powershell
npm run dev:prod
```

That service loads values from root `.env.production`, runs on localhost, and can connect to Render service URLs configured in `.env.production`.

## Create Service

```powershell
npm run new:service
```

This does:

1. Generate the service from Hygen template
2. Add it to root workspaces
3. Run `sync:local-stack`

Note:

- Hygen/sync does not edit `.env.local` or `.env.production`
- Add/remove env keys manually when services change
- For gateway routing, update `api-gateway/src/app.service.ts` `SERVICES` list manually

## Delete Service

Normal service delete:

```powershell
npm run del:service -- <service-name>
```

Infra delete (unsafe):

```powershell
npm run del:service-unsafe -- <service-name>
```

Delete is safe by default and refuses infra services unless unsafe flag is used.

## Sync Behavior

`npm run sync:local-stack`:

- Discovers services from workspaces and root service folders (manual Nest CLI services included)
- Regenerates `services.local.json`
- Regenerates local `docker-compose.yml`
