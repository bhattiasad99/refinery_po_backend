import { eventHelpersProvider } from './services/event-helpers.provider';
import express from "express";
import { getRegisteredServices } from "./lib/service-registry";
import { checkResource } from "./middleware/check-resource";
import { receiveEventService } from "./services/receive-event.service";
import { incomingEventSchema } from "./schemas/incoming-event.schema";
import type { IncomingEvent, } from './types';
import { getEvents } from './services/get-events.service';
import { getFailedEvents } from './services/get-failed-events.service';

export const app = express();

app.use(express.json());
app.use(checkResource);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => {
  res.json({
    service: "event-bus",
    routes: ["/events", "/events/failed", "/sync"],
  });
});

app.get("/sync", (_req, res) => {
  res.json(getRegisteredServices());
});

app.post("/events", (req, res) => {
  const { value, error } = incomingEventSchema.validate(req.body, { abortEarly: true });
  if (error) {
    return res.status(400).json({ ok: false, message: error.details[0]?.message ?? "Invalid request body" });
  }

  const modifiedValue: IncomingEvent = {
    name: value.name.trim(),
    body: value.body,
    source: value.source.trim(),
    url: value.url.trim(),
  }

  // Return immediately and process delivery asynchronously to keep producer latency low.
  void receiveEventService(modifiedValue).catch((serviceError) => {
    console.error("Failed to process event in background", serviceError);
  });

  return res.status(202).json({
    message: "Event accepted for async processing",
    accepted: true,
  });
});

app.get("/events", async (req, res) => {
  const filters = eventHelpersProvider.parseEventFilters(req.query);
  if (!filters.ok) {
    return res.status(400).json({ message: filters.message });
  }

  const events = await getEvents(filters.value);

  return res.json(events);
});

app.get("/events/failed", async (req, res) => {
  const filters = eventHelpersProvider.parseFailedEventFilters(req.query);
  if (!filters.ok) {
    return res.status(400).json({ message: filters.message });
  }

  const failedDeliveries = await getFailedEvents(filters.value);

  return res.json(failedDeliveries);
});
