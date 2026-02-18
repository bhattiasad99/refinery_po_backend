import request from "supertest";
import axios from "axios";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "./app";

describe("app routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /health returns service status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("GET /ping returns upstream status code", async () => {
    const axiosGet = vi.spyOn(axios, "get").mockResolvedValue({ status: 200 } as any);

    const response = await request(app).get("/ping");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 200 });
    expect(axiosGet).toHaveBeenCalledWith("https://example.com");
  });
});
