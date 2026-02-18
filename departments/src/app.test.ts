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

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
  });
});
