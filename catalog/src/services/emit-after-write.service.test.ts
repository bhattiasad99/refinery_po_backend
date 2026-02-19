import { afterEach, describe, expect, it, vi } from "vitest";
import { emitAfterWrite } from "./emit-after-write.service";

describe("emitAfterWrite (catalog)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SERVICE_EVENT_BUS_URL;
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  it("removes password fields from emitted payload", async () => {
    process.env.SERVICE_EVENT_BUS_URL = "http://event-bus:3000";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await emitAfterWrite(
      "create_catalog_item",
      {
        id: "c1",
        name: "Valve",
        password: "should-not-exist",
        metadata: {
          passwordHash: "hash",
          category: "Mechanical",
        },
      },
      "/catalog/bulk",
    );

    const request = fetchMock.mock.calls[0]?.[1] as { body: string };
    const payload = JSON.parse(request.body);
    expect(payload.body).toEqual({
      id: "c1",
      name: "Valve",
      metadata: {
        category: "Mechanical",
      },
    });
  });
});
