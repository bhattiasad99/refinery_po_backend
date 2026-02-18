# Refinery PO Backend - Simple Setup Guide

This repository uses a microservice setup:

- `api-gateway` (entrypoint)
- `event-bus` (event router)
- Registered business services (for example: `catalog`, `purchase-orders`)

`api-gateway` and `event-bus` are infrastructure services.  
Business services publish events to `event-bus`.

## 1) What You Need Installed

- Docker Desktop
- Node.js 22+
- npm

## 2) First-Time Local Setup (PowerShell)

Run these commands in project root:

```powershell
npm install
npm run sync:local-stack
docker compose up --build
```

What this does:

- installs root dependencies
- generates `services.local.json` and `docker-compose.yml`
- builds images and starts all services

## 3) Normal Local Start/Stop

Start:

```powershell
docker compose up
```

Stop:

```powershell
docker compose down
```

Rebuild (after Dockerfile/dependency changes):

```powershell
docker compose up --build
```

## 4) Local Service Discovery Files

- `services.local.json`: list of all services and registered services
- `docker-compose.yml`: local deployment file for all services

Both are auto-generated from `package.json` workspaces + each service `.env` `PORT`.

If you ever edit ports manually, run:

```powershell
npm run sync:local-stack
```

## 5) Add a New Service (Your Main Workflow)

1. Stop containers:

```powershell
docker compose down
```

2. Create a service:

```powershell
npm run new:service
```

3. Start again:

```powershell
docker compose up --build
```

`npm run new:service` now auto-updates:

- root workspace list
- `services.local.json`
- `docker-compose.yml`

## 6) Required `.env` Values Per Service

Every service:

- `PORT=...`
- `DATABASE_URL=...` (Neon DB URL)

Business services also use:

- `EVENT_BUS_URL=...`

Notes:

- Local docker compose sets internal URLs automatically.
- Keep using Neon URLs (no local Postgres container needed).

## 7) Render Deployment (One Service Per Render Project)

Create separate Render services for:

- `api-gateway`
- `event-bus`
- every registered business service

In each Render project, set environment variables in Render dashboard.

Simple rule:

- Business service -> set `EVENT_BUS_URL` to your live event-bus Render URL.
- Gateway/Event-bus -> set service URL variables you need (from your private table).
- Every service -> set its own `DATABASE_URL` (its own Neon project URL) and `PORT`.

## 8) Your Private Table (Recommended)

Keep one private sheet/document with:

- Service Name
- Local Port
- Render URL
- Neon DB URL

Use this table when filling Render env vars.

## 9) From Current Stage to Target Stage (Step by Step)

1. Fill real `DATABASE_URL` in all service `.env` files.
2. Run `npm run sync:local-stack`.
3. Run `docker compose up --build` and confirm all services start.
4. Add 1 new test service using `npm run new:service`.
5. Run `docker compose up --build` again and confirm new service is included automatically.
6. Create Render projects, one per service.
7. Copy values from your private table into Render env vars.
8. Deploy each service.
9. Verify:
   - gateway can reach target services
   - business services can reach event-bus
   - each service can connect to its own Neon DB

## 10) Optional Mac/Linux Commands

Same commands, just in terminal:

```bash
npm install
npm run sync:local-stack
docker compose up --build
```
