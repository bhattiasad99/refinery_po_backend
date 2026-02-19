import express from "express";
import type { NextFunction, Request, Response } from "express";
import { In } from "typeorm";
import { Catalog } from "./entities/catalog.entity";
import { Category } from "./entities/category.entity";
import { Supplier } from "./entities/supplier.entity";

export const app = express();
const SERVICE_NAME = "catalog";

app.use(express.json());

type IncomingCatalogItem = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  manufacturer?: string;
  model: string;
  description?: string;
  leadTimeDays: number;
  priceUsd: number;
  inStock: boolean;
  specs?: Record<string, unknown>;
  compatibleWith?: unknown;
};

type CatalogEventName = "create_catalog_item" | "edit_catalog_item";

const SPEC_FIELD_MAP = {
  standard: "standard",
  supplier: "specsSupplier",
  nominalSize: "nominalSize",
  pressureClass: "pressureClass",
  face: "face",
  windingMaterial: "windingMaterial",
  fillerMaterial: "fillerMaterial",
  innerRing: "innerRing",
  outerRing: "outerRing",
  ringNumber: "ringNumber",
  profile: "profile",
  material: "material",
  thickness: "thickness",
  sheetSize: "sheetSize",
  maxTemperature: "maxTemperature",
  coreMaterial: "coreMaterial",
  facingMaterial: "facingMaterial",
  bodyMaterial: "bodyMaterial",
  endConnection: "endConnection",
  trimOrSeat: "trimOrSeat",
  nace: "nace",
  fireSafe: "fireSafe",
  hydraulicSize: "hydraulicSize",
  configuration: "configuration",
  casingMaterial: "casingMaterial",
  ratedFlow: "ratedFlow",
  ratedHead: "ratedHead",
  sealPlan: "sealPlan",
  driver: "driver",
  measurementType: "measurementType",
  range: "range",
  communication: "communication",
  accuracy: "accuracy",
  hazardousArea: "hazardousArea",
  processConnection: "processConnection",
  trim: "trim",
  actuation: "actuation",
  positioner: "positioner",
  designCode: "designCode",
  temaOrType: "temaOrType",
  surfaceArea: "surfaceArea",
  shellMaterial: "shellMaterial",
  tubeOrPlateMaterial: "tubeOrPlateMaterial",
  designPressure: "designPressure",
  designTemperature: "designTemperature",
  toolType: "toolType",
  voltage: "voltage",
  chuck: "chuck",
  maxTorque: "maxTorque",
  speed: "speed",
  warranty: "warranty",
  current: "current",
  headWeight: "headWeight",
  handle: "handle",
  overallLength: "overallLength",
  tips: "tips",
  count: "count",
  magnetic: "magnetic",
  tip: "tip",
  shaftLength: "shaftLength",
  length: "length",
  jawCapacity: "jawCapacity",
  finish: "finish",
  cuttingEdge: "cuttingEdge",
  bladeType: "bladeType",
  body: "body",
  quickChange: "quickChange",
} as const;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);

  return values.length > 0 ? values : null;
}

function parseIncomingCatalogItem(
  value: unknown,
  index: number,
): { ok: true; item: IncomingCatalogItem } | { ok: false; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: `Item at index ${index} must be an object` };
  }

  const input = value as Record<string, unknown>;

  const id = asNonEmptyString(input.id);
  const name = asNonEmptyString(input.name);
  const category = asNonEmptyString(input.category);
  const supplier = asNonEmptyString(input.supplier);
  const model = asNonEmptyString(input.model);
  const inStock = input.inStock;
  const leadTimeDays = input.leadTimeDays;
  const priceUsd = input.priceUsd;

  if (!id || !name || !category || !supplier || !model) {
    return {
      ok: false,
      message:
        `Item ${index} is missing one of required fields: ` +
        "id, name, category, supplier, model",
    };
  }

  if (typeof inStock !== "boolean") {
    return { ok: false, message: `Item ${index} field inStock must be boolean` };
  }

  if (typeof leadTimeDays !== "number" || !Number.isFinite(leadTimeDays)) {
    return {
      ok: false,
      message: `Item ${index} field leadTimeDays must be a valid number`,
    };
  }

  if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd)) {
    return {
      ok: false,
      message: `Item ${index} field priceUsd must be a valid number`,
    };
  }

  const specsValue = input.specs;
  const specs =
    specsValue && typeof specsValue === "object" && !Array.isArray(specsValue)
      ? (specsValue as Record<string, unknown>)
      : undefined;

  return {
    ok: true,
    item: {
      id,
      name,
      category,
      supplier,
      model,
      manufacturer: asOptionalString(input.manufacturer) ?? undefined,
      description: asOptionalString(input.description) ?? undefined,
      inStock,
      leadTimeDays,
      priceUsd,
      specs,
      compatibleWith: input.compatibleWith,
    },
  };
}

function mapToCatalogEntity(item: IncomingCatalogItem, createdBy: string): Catalog {
  const payload: Partial<Catalog> = {
    id: item.id,
    name: item.name,
    categoryName: item.category,
    supplierName: item.supplier,
    createdBy,
    manufacturer: item.manufacturer ?? null,
    model: item.model,
    description: item.description ?? null,
    leadTimeDays: item.leadTimeDays,
    priceUsd: item.priceUsd,
    inStock: item.inStock,
    compatibleWith: asStringArray(item.compatibleWith),
  };

  const specs = item.specs ?? {};
  for (const [specKey, catalogField] of Object.entries(SPEC_FIELD_MAP)) {
    const rawValue = specs[specKey];
    (payload as Record<string, unknown>)[catalogField] = asOptionalString(rawValue);
  }

  return payload as Catalog;
}

function buildEventBody(catalog: Catalog): Record<string, unknown> {
  return {
    id: catalog.id,
    name: catalog.name,
    category: catalog.categoryName,
    supplier: catalog.supplierName,
    manufacturer: catalog.manufacturer,
    model: catalog.model,
    description: catalog.description,
    leadTimeDays: catalog.leadTimeDays,
    priceUsd: catalog.priceUsd,
    inStock: catalog.inStock,
    createdBy: catalog.createdBy,
    compatibleWith: catalog.compatibleWith ?? [],
  };
}

async function emitCatalogItemEvent(
  catalog: Catalog,
  eventName: CatalogEventName,
  requestPath: string,
): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    throw new Error("SERVICE_EVENT_BUS_URL is not set");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }

  const eventPayload = {
    name: eventName,
    body: buildEventBody(catalog),
    source: SERVICE_NAME,
    url: requestPath,
  };

  const response = await fetch(`${eventBusUrl}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    throw new Error(`Event bus returned ${response.status} while emitting ${eventName}`);
  }
}

function checkResource(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/health" || req.path === "/healthz") {
    return next();
  }

  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (!internalServiceKey) {
    return next();
  }

  const incomingKey = req.header("x-internal-key");
  if (incomingKey !== internalServiceKey) {
    return res.status(403).json({ message: "Forbidden resource access" });
  }

  return next();
}

app.use(checkResource);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

type CatalogSortOption =
  | "price_asc"
  | "price_desc"
  | "lead_time_asc"
  | "lead_time_desc"
  | "supplier_asc";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function parseBooleanQuery(value: unknown): boolean | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return null;
}

function resolveSortOption(value: unknown): CatalogSortOption | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "price_asc" ||
    normalized === "price_desc" ||
    normalized === "lead_time_asc" ||
    normalized === "lead_time_desc" ||
    normalized === "supplier_asc"
  ) {
    return normalized;
  }

  return null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get("/", async (req: Request, res: Response) => {
  const limit = Math.min(asPositiveInt(req.query.limit) ?? 50, 200);
  const offset = Math.max(asPositiveInt(req.query.offset) ?? 0, 0);
  const searchInput =
    asNonEmptyString(req.query.search) ?? asNonEmptyString(req.query.q) ?? null;
  const category = asNonEmptyString(req.query.category);
  const inStock = parseBooleanQuery(req.query.inStock);
  const sort = resolveSortOption(req.query.sort);
  const simulatedDelayMs = Math.min(asPositiveInt(req.query.simulateDelayMs) ?? 0, 3000);

  try {
    if (simulatedDelayMs > 0) {
      await sleep(simulatedDelayMs);
    }

    const { AppDataSource } = await import("./db/data-source");
    const repository = AppDataSource.getRepository(Catalog);
    const queryBuilder = repository.createQueryBuilder("catalog");

    if (searchInput) {
      const searchPattern = `%${escapeLikePattern(searchInput)}%`;
      queryBuilder.andWhere(
        "(catalog.id ILIKE :search ESCAPE '\\' OR " +
          "catalog.name ILIKE :search ESCAPE '\\' OR " +
          "catalog.supplier_name ILIKE :search ESCAPE '\\' OR " +
          "catalog.manufacturer ILIKE :search ESCAPE '\\' OR " +
          "catalog.model ILIKE :search ESCAPE '\\')",
        { search: searchPattern },
      );
    }

    if (category) {
      queryBuilder.andWhere("catalog.category_name = :category", { category });
    }

    if (inStock !== null) {
      queryBuilder.andWhere("catalog.in_stock = :inStock", { inStock });
    }

    switch (sort) {
      case "price_asc":
        queryBuilder.orderBy("catalog.price_usd", "ASC");
        break;
      case "price_desc":
        queryBuilder.orderBy("catalog.price_usd", "DESC");
        break;
      case "lead_time_asc":
        queryBuilder.orderBy("catalog.lead_time_days", "ASC");
        break;
      case "lead_time_desc":
        queryBuilder.orderBy("catalog.lead_time_days", "DESC");
        break;
      case "supplier_asc":
        queryBuilder.orderBy("catalog.supplier_name", "ASC");
        break;
      default:
        queryBuilder.orderBy("catalog.name", "ASC");
        break;
    }

    queryBuilder.take(limit).skip(offset);
    const rows = await queryBuilder.getMany();
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Failed to fetch catalog items", error);
    return res.status(500).json({ message: "Failed to fetch catalog items" });
  }
});

app.get("/:id", async (req: Request, res: Response) => {
  const id = asNonEmptyString(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Catalog id is required" });
  }

  try {
    const { AppDataSource } = await import("./db/data-source");
    const repository = AppDataSource.getRepository(Catalog);
    const row = await repository.findOne({ where: { id } });

    if (!row) {
      return res.status(404).json({ message: "Catalog item not found" });
    }

    return res.status(200).json(row);
  } catch (error) {
    console.error("Failed to fetch catalog item", error);
    return res.status(500).json({ message: "Failed to fetch catalog item" });
  }
});

app.post("/events", (req, res) => {
  return res.status(200).json({
    accepted: true,
    eventName: req.body?.name ?? null,
  });
});

async function handleBulkCreateCatalogItems(req: Request, res: Response) {
  const requestUserId = asNonEmptyString(req.header("x-user-id"));
  if (!requestUserId) {
    return res.status(401).json({ message: "Authenticated user id is required" });
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      message:
        "Request body must be a JSON array of catalog items (same shape as refinery_items_50_5suppliers_strict.json)",
    });
  }

  const parsedItems: IncomingCatalogItem[] = [];
  for (let index = 0; index < req.body.length; index += 1) {
    const parsed = parseIncomingCatalogItem(req.body[index], index);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    parsedItems.push(parsed.item);
  }

  const dedupedById = new Map<string, IncomingCatalogItem>();
  for (const item of parsedItems) {
    if (!dedupedById.has(item.id)) {
      dedupedById.set(item.id, item);
    }
  }
  const uniqueItems = [...dedupedById.values()];

  try {
    const { AppDataSource } = await import("./db/data-source");
    const categoryRepository = AppDataSource.getRepository(Category);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const catalogRepository = AppDataSource.getRepository(Catalog);

    const categoryNames = [...new Set(uniqueItems.map((item) => item.category))];
    const supplierNames = [...new Set(uniqueItems.map((item) => item.supplier))];

    if (categoryNames.length > 0) {
      await categoryRepository.upsert(
        categoryNames.map((name) => ({ name })),
        ["name"],
      );
    }

    if (supplierNames.length > 0) {
      await supplierRepository.upsert(
        supplierNames.map((name) => ({ name })),
        ["name"],
      );
    }

    const itemIds = uniqueItems.map((item) => item.id);
    const existingRows =
      itemIds.length > 0
        ? await catalogRepository.find({
            select: { id: true, createdBy: true },
            where: { id: In(itemIds) },
          })
        : [];
    const existingRowById = new Map(existingRows.map((row) => [row.id, row]));

    const itemsToCreate: IncomingCatalogItem[] = [];
    const itemsToUpdate: IncomingCatalogItem[] = [];
    for (const item of uniqueItems) {
      if (existingRowById.has(item.id)) {
        itemsToUpdate.push(item);
      } else {
        itemsToCreate.push(item);
      }
    }

    const createdCatalogs =
      itemsToCreate.length > 0
        ? await catalogRepository.save(
            itemsToCreate.map((item) => mapToCatalogEntity(item, requestUserId)),
            { chunk: 100 },
          )
        : [];

    const updatedCatalogs =
      itemsToUpdate.length > 0
        ? await catalogRepository.save(
            itemsToUpdate.map((item) => {
              const existingRow = existingRowById.get(item.id);
              const existingCreatedBy = asNonEmptyString(existingRow?.createdBy);
              return mapToCatalogEntity(item, existingCreatedBy ?? requestUserId);
            }),
            { chunk: 100 },
          )
        : [];

    const eventsToEmit: Array<{ catalog: Catalog; eventName: CatalogEventName }> = [
      ...createdCatalogs.map((catalog) => ({
        catalog,
        eventName: "create_catalog_item" as const,
      })),
      ...updatedCatalogs.map((catalog) => ({
        catalog,
        eventName: "edit_catalog_item" as const,
      })),
    ];

    const emitResults = await Promise.allSettled(
      eventsToEmit.map(({ catalog, eventName }) =>
        emitCatalogItemEvent(catalog, eventName, req.originalUrl || "/catalog/bulk"),
      ),
    );

    const failedEvents: Array<{ id: string; eventName: CatalogEventName; reason: string }> = [];
    for (let index = 0; index < emitResults.length; index += 1) {
      const result = emitResults[index];
      if (result.status !== "rejected") {
        continue;
      }

      failedEvents.push({
        id: eventsToEmit[index]?.catalog.id ?? "unknown",
        eventName: eventsToEmit[index]?.eventName ?? "create_catalog_item",
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }

    if (failedEvents.length > 0) {
      return res.status(502).json({
        message: "Catalog items were saved, but some events failed",
        createdCount: createdCatalogs.length,
        updatedCount: updatedCatalogs.length,
        eventFailures: failedEvents,
      });
    }

    return res.status(201).json({
      createdCount: createdCatalogs.length,
      updatedCount: updatedCatalogs.length,
      duplicateIdsInPayload: parsedItems.length - uniqueItems.length,
      emittedEventNames: ["create_catalog_item", "edit_catalog_item"],
    });
  } catch (error) {
    console.error("Failed to bulk create catalog items", error);
    return res.status(500).json({ message: "Failed to bulk create catalog items" });
  }
}

app.post("/bulk", handleBulkCreateCatalogItems);
