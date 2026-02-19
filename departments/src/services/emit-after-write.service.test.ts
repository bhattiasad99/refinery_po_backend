import { afterEach, describe, expect, it, vi } from "vitest";
import { emitAfterWrite } from "./emit-after-write.service";

describe("emitAfterWrite (departments)", () => {
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
      "create_department",
      {
        id: "d1",
        name: "Operations",
        passwordHash: "should-not-exist",
      },
      "/departments",
    );

    const request = fetchMock.mock.calls[0]?.[1] as { body: string };
    const payload = JSON.parse(request.body);
    expect(payload.body).toEqual({
      id: "d1",
      name: "Operations",
    });
  });
});
