import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let app: Awaited<typeof import("./app")>["app"];

describe("app routes", () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const originalDbUrl = process.env.PURCHASE_ORDERS_DATABASE_URL;

  beforeAll(async () => {
    process.env.PURCHASE_ORDERS_DATABASE_URL =
      process.env.PURCHASE_ORDERS_DATABASE_URL ??
      "postgres://test:test@localhost:5432/test_purchase_orders";
    ({ app } = await import("./app"));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INTERNAL_SERVICE_KEY = "test-key";
  });

  it("GET /health returns service status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("blocks non-health routes without internal key", async () => {
    const response = await request(app).get("/anything");
    expect(response.status).toBe(403);
  });

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
    process.env.PURCHASE_ORDERS_DATABASE_URL = originalDbUrl;
  });
});
