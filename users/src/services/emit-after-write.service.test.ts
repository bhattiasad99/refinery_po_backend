import { afterEach, describe, expect, it, vi } from "vitest";
import { emitAfterWrite } from "./emit-after-write.service";

describe("emitAfterWrite (users)", () => {
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
      "user_created",
      {
        id: "u1",
        password: "secret",
        profile: {
          passwordHash: "hash",
          name: "User Name",
        },
      },
      "/users",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as { body: string };
    const payload = JSON.parse(request.body);
    expect(payload.body).toEqual({
      id: "u1",
      profile: {
        name: "User Name",
      },
    });
  });
});
