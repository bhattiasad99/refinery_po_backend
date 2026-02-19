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

function mapToCatalogEntity(item: IncomingCatalogItem): Catalog {
  const payload: Partial<Catalog> = {
    id: item.id,
    name: item.name,
    categoryName: item.category,
    supplierName: item.supplier,
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
    compatibleWith: catalog.compatibleWith ?? [],
  };
}

async function emitCreateCatalogItemEvent(
  catalog: Catalog,
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
    name: "create_catalog_item",
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
    throw new Error(
      `Event bus returned ${response.status} while emitting create_catalog_item`,
    );
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
app.get("/", async (req: Request, res: Response) => {
  const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const limit =
    Number.isFinite(rawLimit) && rawLimit && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

  try {
    const { AppDataSource } = await import("./db/data-source");
    const repository = AppDataSource.getRepository(Catalog);
    const rows = await repository.find({
      order: { name: "ASC" },
      take: limit,
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Failed to fetch catalog items", error);
    return res.status(500).json({ message: "Failed to fetch catalog items" });
  }
});

app.post("/events", (req, res) => {
  return res.status(200).json({
    accepted: true,
    eventName: req.body?.name ?? null,
  });
});

async function handleBulkCreateCatalogItems(req: Request, res: Response) {
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
            select: { id: true },
            where: { id: In(itemIds) },
          })
        : [];
    const existingIdSet = new Set(existingRows.map((row) => row.id));

    const itemsToInsert = uniqueItems.filter((item) => !existingIdSet.has(item.id));
    const createdCatalogs =
      itemsToInsert.length > 0
        ? await catalogRepository.save(itemsToInsert.map(mapToCatalogEntity), {
            chunk: 100,
          })
        : [];

    const emitResults = await Promise.allSettled(
      createdCatalogs.map((catalog) =>
        emitCreateCatalogItemEvent(catalog, req.originalUrl || "/catalog/bulk"),
      ),
    );

    const failedEvents: Array<{ id: string; reason: string }> = [];
    for (let index = 0; index < emitResults.length; index += 1) {
      const result = emitResults[index];
      if (result.status !== "rejected") {
        continue;
      }

      failedEvents.push({
        id: createdCatalogs[index]?.id ?? "unknown",
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }

    if (failedEvents.length > 0) {
      return res.status(502).json({
        message: "Catalog items were saved, but some create_catalog_item events failed",
        createdCount: createdCatalogs.length,
        skippedExistingCount: uniqueItems.length - createdCatalogs.length,
        eventFailures: failedEvents,
      });
    }

    return res.status(201).json({
      createdCount: createdCatalogs.length,
      skippedExistingCount: uniqueItems.length - createdCatalogs.length,
      duplicateIdsInPayload: parsedItems.length - uniqueItems.length,
      eventName: "create_catalog_item",
    });
  } catch (error) {
    console.error("Failed to bulk create catalog items", error);
    return res.status(500).json({ message: "Failed to bulk create catalog items" });
  }
}

app.post("/bulk", handleBulkCreateCatalogItems);
app.post("/catalog/bulk", handleBulkCreateCatalogItems);
