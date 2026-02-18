import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { DataSource } from "typeorm";
import { EventDeliveryStatus } from "./entities/event-delivery-status.entity";
import { EventStore } from "./entities/event-store.entity";
import { sendEventToService } from "./lib/event-delivery";
import { generateDeliveryStatusId, generateEventId } from "./lib/id-generator";
import { getRegisteredServices } from "./lib/service-registry";

export const app = express();

app.use(express.json());

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

app.get("/sync", (_req, res) => {
  res.json(getRegisteredServices());
});

app.post("/events", async (req, res) => {
  const parsed = parseIncomingEvent(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }

  const dataSource = getAppDataSource();
  const eventRepository = dataSource.getRepository(EventStore);
  const deliveryStatusRepository = dataSource.getRepository(EventDeliveryStatus);

  const eventId = generateEventId(parsed.value.source);
  const eventRecord = eventRepository.create({
    id: eventId,
    name: parsed.value.name,
    data: parsed.value.body,
    source: parsed.value.source,
    url: parsed.value.url,
  });

  const savedEvent = await eventRepository.save(eventRecord);

  const targetServices = getRegisteredServices();
  const outgoingPayload = {
    id: savedEvent.id,
    name: savedEvent.name,
    body: savedEvent.data,
    source: savedEvent.source,
    url: savedEvent.url,
    timestamp: savedEvent.timestamp,
  };

  const settledResults = await Promise.allSettled(
    targetServices.map((service) => sendEventToService(service, outgoingPayload)),
  );

  const deliveryRows = settledResults.map((result, index) => {
    const targetService = targetServices[index];
    const isSuccess = result.status === "fulfilled";

    return deliveryStatusRepository.create({
      id: generateDeliveryStatusId(savedEvent.id, targetService.name),
      status: isSuccess ? "success" : "failed",
      targetService: targetService.name,
      targetUrl: targetService.url,
      eventId: savedEvent.id,
      errorMessage: isSuccess ? null : getErrorMessage(result.reason),
    });
  });

  if (deliveryRows.length > 0) {
    await deliveryStatusRepository.save(deliveryRows);
  }

  const successCount = deliveryRows.filter((row) => row.status === "success").length;
  const failedCount = deliveryRows.length - successCount;

  return res.status(201).json({
    message: "Event stored and delivery attempted",
    eventId: savedEvent.id,
    delivery: {
      total: deliveryRows.length,
      success: successCount,
      failed: failedCount,
    },
  });
});

app.get("/events", async (req, res) => {
  const filters = parseEventFilters(req.query);
  if (!filters.ok) {
    return res.status(400).json({ message: filters.message });
  }

  const dataSource = getAppDataSource();
  const eventRepository = dataSource.getRepository(EventStore);
  const qb = eventRepository.createQueryBuilder("event");

  if (filters.value.name) {
    qb.andWhere("event.name = :name", { name: filters.value.name });
  }

  if (filters.value.source) {
    qb.andWhere("event.source = :source", { source: filters.value.source });
  }

  qb.andWhere("event.timestamp >= :from", { from: filters.value.from });
  qb.andWhere("event.timestamp <= :to", { to: filters.value.to });
  qb.orderBy("event.timestamp", filters.value.order);
  qb.take(filters.value.limit);

  const events = await qb.getMany();
  return res.json(events);
});

app.get("/events/failed", async (req, res) => {
  const filters = parseFailedEventFilters(req.query);
  if (!filters.ok) {
    return res.status(400).json({ message: filters.message });
  }

  const dataSource = getAppDataSource();
  const statusRepository = dataSource.getRepository(EventDeliveryStatus);

  const qb = statusRepository
    .createQueryBuilder("delivery")
    .innerJoinAndSelect("delivery.event", "event")
    .where("delivery.status = :status", { status: "failed" })
    .andWhere("delivery.targetService = :targetService", {
      targetService: filters.value.targetService,
    })
    .andWhere("event.timestamp >= :from", { from: filters.value.from })
    .andWhere("event.timestamp <= :to", { to: filters.value.to })
    .orderBy("event.timestamp", "DESC")
    .take(filters.value.limit);

  if (filters.value.name) {
    qb.andWhere("event.name = :name", { name: filters.value.name });
  }

  if (filters.value.source) {
    qb.andWhere("event.source = :source", { source: filters.value.source });
  }

  const failedDeliveries = await qb.getMany();
  return res.json(failedDeliveries);
});

type IncomingEvent = {
  name: string;
  body: Record<string, unknown>;
  source: string;
  url: string;
};

type ParsedResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

type EventFilters = {
  name?: string;
  source?: string;
  from: Date;
  to: Date;
  order: "ASC" | "DESC";
  limit: number;
};

type FailedEventFilters = {
  targetService: string;
  name?: string;
  source?: string;
  from: Date;
  to: Date;
  limit: number;
};

function parseIncomingEvent(body: unknown): ParsedResult<IncomingEvent> {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
    return { ok: false, message: "name is required" };
  }

  if (!payload.body || typeof payload.body !== "object" || Array.isArray(payload.body)) {
    return { ok: false, message: "body is required and must be a JSON object" };
  }

  if (typeof payload.source !== "string" || payload.source.trim().length === 0) {
    return { ok: false, message: "source is required" };
  }

  if (typeof payload.url !== "string" || payload.url.trim().length === 0) {
    return { ok: false, message: "url is required" };
  }

  return {
    ok: true,
    value: {
      name: payload.name.trim(),
      body: payload.body as Record<string, unknown>,
      source: payload.source.trim(),
      url: payload.url.trim(),
    },
  };
}

function parseEventFilters(query: Request["query"]): ParsedResult<EventFilters> {
  const name = readString(query.name);
  const source = readString(query.source);
  const from = readDate(query.from, new Date(0));
  const to = readDate(query.to, new Date());
  const order = readOrder(query.order);
  const limit = readLimit(query.limit, 100);

  if (!from || !to) {
    return { ok: false, message: "from and to must be valid ISO dates" };
  }

  return {
    ok: true,
    value: {
      name,
      source,
      from,
      to,
      order,
      limit,
    },
  };
}

function parseFailedEventFilters(query: Request["query"]): ParsedResult<FailedEventFilters> {
  const targetService = readString(query.targetService);
  if (!targetService) {
    return { ok: false, message: "targetService is required" };
  }

  const name = readString(query.name);
  const source = readString(query.source);
  const from = readDate(query.from, new Date(0));
  const to = readDate(query.to, new Date());
  const limit = readLimit(query.limit, 100);

  if (!from || !to) {
    return { ok: false, message: "from and to must be valid ISO dates" };
  }

  return {
    ok: true,
    value: {
      targetService,
      name,
      source,
      from,
      to,
      limit,
    },
  };
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDate(value: unknown, fallback: Date): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function readOrder(value: unknown): "ASC" | "DESC" {
  if (typeof value !== "string") {
    return "DESC";
  }

  const normalized = value.trim().toUpperCase();
  return normalized === "ASC" ? "ASC" : "DESC";
}

function readLimit(value: unknown, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 500);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown delivery failure";
}

function getAppDataSource(): DataSource {
  const module = require("./db/data-source") as { AppDataSource: DataSource };
  return module.AppDataSource;
}
