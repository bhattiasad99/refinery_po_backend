import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.USERS_DATABASE_URL = process.env.USERS_DATABASE_URL ?? "postgres://user:password@localhost:5432/users_test";

let app: typeof import("./app")["app"];

describe("app routes", () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;

  beforeAll(async () => {
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

  it("GET /single-user blocks access without internal key", async () => {
    const response = await request(app).get("/single-user?id=abc");
    expect(response.status).toBe(403);
  });

  it("GET /single-user validates required query params", async () => {
    const response = await request(app).get("/single-user").set("x-internal-key", "test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "id or email is required" });
  });

  it("GET /single-user rejects both id and email together", async () => {
    const response = await request(app)
      .get("/single-user?id=abc&email=user@example.com")
      .set("x-internal-key", "test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "provide either id or email, not both" });
  });

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
  });
});
