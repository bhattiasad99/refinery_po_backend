import { AppDataSource } from "../db/data-source";
import { CatalogItemProjection } from "../entities/catalog-item-projection.entity";
import { CategoryProjection } from "../entities/category-projection.entity";
import { DepartmentProjection } from "../entities/department-projection.entity";
import { ProjectionSyncState } from "../entities/projection-sync-state.entity";
import { SupplierProjection } from "../entities/supplier-projection.entity";
import { UserProjection } from "../entities/user-projection.entity";

type EventLike = {
  name: string;
  source: string;
  data: Record<string, unknown>;
};

type IncomingEventLike = {
  name: string;
  source: string;
  body: Record<string, unknown>;
};

const DEFAULT_SYNC_FROM = new Date(0);
const SYNC_STATE_KEY = "event_bus_projection_sync";
const PAGE_LIMIT = 500;
const MAX_PAGES = 2000;

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }
  return headers;
}

function pickString(body: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

function pickBoolean(body: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function pickNumber(body: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }
  return null;
}

function hasAnyKey(body: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => key in body);
}

async function upsertDepartment(body: Record<string, unknown>): Promise<void> {
  const id = pickString(body, ["id", "departmentId", "deptId"]);
  if (!id) {
    return;
  }

  const repository = AppDataSource.getRepository(DepartmentProjection);
  await repository.upsert(
    {
      id,
      name: pickString(body, ["name", "departmentName"]),
      code: pickString(body, ["code", "departmentCode"]),
      isActive: pickBoolean(body, ["isActive", "active"]),
    },
    ["id"],
  );
}

async function upsertUser(body: Record<string, unknown>): Promise<void> {
  const id = pickString(body, ["id", "userId"]);
  if (!id) {
    return;
  }

  const repository = AppDataSource.getRepository(UserProjection);
  await repository.upsert(
    {
      id,
      fullName: pickString(body, ["fullName", "name"]),
      email: pickString(body, ["email"]),
      departmentId: pickString(body, ["departmentId"]),
      departmentName: pickString(body, ["departmentName"]),
      isActive: pickBoolean(body, ["isActive", "active"]),
    },
    ["id"],
  );
}

async function upsertCategory(body: Record<string, unknown>): Promise<void> {
  const id = pickString(body, ["id", "categoryId", "name"]);
  if (!id) {
    return;
  }

  const repository = AppDataSource.getRepository(CategoryProjection);
  await repository.upsert(
    {
      id,
      name: pickString(body, ["name", "categoryName"]),
      code: pickString(body, ["code", "categoryCode"]),
      isActive: pickBoolean(body, ["isActive", "active"]),
    },
    ["id"],
  );
}

async function upsertSupplier(body: Record<string, unknown>): Promise<void> {
  const id = pickString(body, ["id", "supplierId", "name"]);
  if (!id) {
    return;
  }

  const repository = AppDataSource.getRepository(SupplierProjection);
  await repository.upsert(
    {
      id,
      name: pickString(body, ["name", "supplierName"]),
      code: pickString(body, ["code", "supplierCode"]),
      isActive: pickBoolean(body, ["isActive", "active"]),
    },
    ["id"],
  );
}

async function upsertCatalogItem(body: Record<string, unknown>): Promise<void> {
  const id = pickString(body, ["id", "catalogItemId"]);
  if (!id) {
    return;
  }

  const repository = AppDataSource.getRepository(CatalogItemProjection);
  await repository.upsert(
    {
      id,
      name: pickString(body, ["name", "item", "catalogItemName"]),
      description: pickString(body, ["description"]),
      categoryId: pickString(body, ["categoryId"]),
      categoryName: pickString(body, ["categoryName", "category"]),
      supplierId: pickString(body, ["supplierId"]),
      supplierName: pickString(body, ["supplierName", "supplier"]),
      price: pickNumber(body, ["price", "priceUsd", "unitPrice"]),
      currency: pickString(body, ["currency"]),
      inStock: pickBoolean(body, ["inStock"]),
      isActive: pickBoolean(body, ["isActive", "active"]),
    },
    ["id"],
  );
}

function normalizeEvent(raw: unknown): EventLike | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const source = typeof row.source === "string" ? row.source.trim() : "";
  const data = row.data;

  if (!name || !source || !data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return {
    name,
    source,
    data: data as Record<string, unknown>,
  };
}

async function processProjectionEvent(event: EventLike): Promise<void> {
  // Route by source/name heuristics because producer services emit slightly different payload contracts.
  const source = event.source.toLowerCase();
  const name = event.name.toLowerCase();
  const body = event.data;

  if (source.includes("department") || name.includes("department")) {
    await upsertDepartment(body);
    return;
  }

  if (source.includes("user") || name.includes("user")) {
    await upsertUser(body);
    return;
  }

  if (source.includes("catalog")) {
    if (name.includes("supplier")) {
      await upsertSupplier(body);
      return;
    }
    if (name.includes("category")) {
      await upsertCategory(body);
      return;
    }

    await upsertCatalogItem(body);
    return;
  }

  if (source.includes("supplier") || name.includes("supplier")) {
    await upsertSupplier(body);
    return;
  }

  if (source.includes("category") || name.includes("category")) {
    await upsertCategory(body);
    return;
  }

  if (source.includes("item") || name.includes("item") || hasAnyKey(body, ["catalogItemId", "priceUsd"])) {
    await upsertCatalogItem(body);
  }
}

async function getSyncCursor(): Promise<Date> {
  // Cursor tracks "last processed timestamp + 1ms" for idempotent incremental sync.
  const repository = AppDataSource.getRepository(ProjectionSyncState);
  const row = await repository.findOne({ where: { key: SYNC_STATE_KEY } });
  if (!row?.lastCursorAt) {
    return DEFAULT_SYNC_FROM;
  }
  return row.lastCursorAt;
}

async function setSyncCursor(nextCursor: Date): Promise<void> {
  const repository = AppDataSource.getRepository(ProjectionSyncState);
  await repository.upsert(
    {
      key: SYNC_STATE_KEY,
      lastCursorAt: nextCursor,
    },
    ["key"],
  );
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export async function syncProjectionsFromEventBus(): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    return;
  }

  let cursor = await getSyncCursor();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      order: "ASC",
      limit: String(PAGE_LIMIT),
      from: cursor.toISOString(),
    });

    const response = await fetch(`${eventBusUrl}/events?${query.toString()}`, {
      method: "GET",
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`event bus returned ${response.status} while syncing projections`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error("event bus returned invalid events payload");
    }

    if (payload.length === 0) {
      return;
    }

    let maxTimestamp = cursor;
    let processedAtLeastOneEvent = false;

    for (const row of payload) {
      const event = normalizeEvent(row);
      if (!event) {
        continue;
      }

      await processProjectionEvent(event);
      processedAtLeastOneEvent = true;

      const rowTimestamp = parseTimestamp((row as Record<string, unknown>).timestamp);
      if (rowTimestamp && rowTimestamp.getTime() > maxTimestamp.getTime()) {
        maxTimestamp = rowTimestamp;
      }
    }

    if (!processedAtLeastOneEvent) {
      return;
    }

    // Move cursor forward by 1ms to avoid re-reading the boundary event on next page/sync.
    cursor = new Date(maxTimestamp.getTime() + 1);
    await setSyncCursor(cursor);

    if (payload.length < PAGE_LIMIT) {
      return;
    }
  }

  throw new Error(`projection sync reached page limit (${MAX_PAGES})`);
}

export async function processIncomingProjectionEvent(event: IncomingEventLike): Promise<void> {
  await processProjectionEvent({
    name: event.name,
    source: event.source,
    data: event.body,
  });
}
