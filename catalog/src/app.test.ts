import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";

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

  it("blocks non-health routes without internal key", async () => {
    const response = await request(app).get("/anything");
    expect(response.status).toBe(403);
  });

  it("POST /catalog/bulk is not exposed in the catalog service directly", async () => {
    const response = await request(app)
      .post("/catalog/bulk")
      .set("x-internal-key", "test-key")
      .send([]);

    expect(response.status).toBe(404);
  });

  it("POST /bulk requires x-user-id", async () => {
    const response = await request(app)
      .post("/bulk")
      .set("x-internal-key", "test-key")
      .send([]);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Authenticated user id is required" });
  });

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
  });
});
