import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/receive-event.service", () => ({
  receiveEventService: vi.fn(),
}));
vi.mock("./services/get-events.service", () => ({
  getEvents: vi.fn(),
}));
vi.mock("./services/get-failed-events.service", () => ({
  getFailedEvents: vi.fn(),
}));

import { app } from "./app";
import { receiveEventService } from "./services/receive-event.service";
import { getEvents } from "./services/get-events.service";
import { getFailedEvents } from "./services/get-failed-events.service";

describe("app routes", () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INTERNAL_SERVICE_KEY = "test-key";
  });

  it("GET /health returns service status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("GET /sync returns empty list", async () => {
    const response = await request(app)
      .get("/sync")
      .set("x-internal-key", "test-key");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("blocks /sync without internal key", async () => {
    const response = await request(app).get("/sync");
    expect(response.status).toBe(403);
  });

  it("POST /events returns 400 when body is invalid", async () => {
    const response = await request(app)
      .post("/events")
      .set("x-internal-key", "test-key")
      .send({
        source: "catalog",
        url: "/products",
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it("POST /events accepts event for async processing", async () => {
    vi.mocked(receiveEventService).mockResolvedValue({
      savedEvent: {
        id: "evt-1",
        name: "product.created",
        data: { id: 10 },
        source: "catalog",
        url: "/products/10",
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
      } as any,
      deliveryRows: [{}, {}] as any[],
      successCount: 1,
      failedCount: 1,
    });

    const response = await request(app)
      .post("/events")
      .set("x-internal-key", "test-key")
      .send({
        name: "  product.created  ",
        body: { id: 10 },
        source: "  catalog  ",
        url: "  /products/10  ",
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      message: "Event accepted for async processing",
      accepted: true,
    });
    expect(receiveEventService).toHaveBeenCalledWith({
      name: "product.created",
      body: { id: 10 },
      source: "catalog",
      url: "/products/10",
    });
  });

  it("GET /events returns 400 for invalid dates", async () => {
    const response = await request(app)
      .get("/events?from=not-a-date")
      .set("x-internal-key", "test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "from and to must be valid ISO dates" });
  });

  it("GET /events returns data from service", async () => {
    vi.mocked(getEvents).mockResolvedValue([
      { id: "evt-1", name: "product.created" } as any,
    ]);

    const response = await request(app)
      .get("/events?name=product.created&limit=1")
      .set("x-internal-key", "test-key");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "evt-1", name: "product.created" }]);
    expect(getEvents).toHaveBeenCalledTimes(1);
  });

  it("GET /events/failed requires targetService", async () => {
    const response = await request(app)
      .get("/events/failed")
      .set("x-internal-key", "test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "targetService is required" });
  });

  it("GET /events/failed returns failed deliveries", async () => {
    vi.mocked(getFailedEvents).mockResolvedValue([
      { id: "del-1", status: "failed" } as any,
    ]);

    const response = await request(app)
      .get("/events/failed?targetService=catalog")
      .set("x-internal-key", "test-key");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "del-1", status: "failed" }]);
    expect(getFailedEvents).toHaveBeenCalledTimes(1);
  });

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
  });
});
