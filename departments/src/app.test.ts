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

  it("creates a department with name and description", async () => {
    const response = await request(app)
      .post("/")
      .set("x-internal-key", "test-key")
      .send({ name: "Operations", description: "Handles plant operations" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Operations");
    expect(response.body.description).toBe("Handles plant operations");
    expect(response.body.id).toMatch(/^dep_/);
  });

  it("returns 400 when name is missing", async () => {
    const response = await request(app)
      .post("/")
      .set("x-internal-key", "test-key")
      .send({ description: "Missing name" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "name is required" });
  });

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
  });
});
