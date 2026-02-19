import { afterEach, describe, expect, it, vi } from "vitest";
import { emitAfterWrite } from "./event-publisher.service";

describe("emitAfterWrite (purchase-orders)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SERVICE_EVENT_BUS_URL;
    delete process.env.SERVICE_PURCHASE_ORDERS_URL;
    delete process.env.INTERNAL_SERVICE_KEY;
    delete process.env.PURCHASE_ORDERS_PORT;
  });

  it("removes password fields from emitted payload", async () => {
    process.env.SERVICE_EVENT_BUS_URL = "http://event-bus:3000";
    process.env.SERVICE_PURCHASE_ORDERS_URL = "http://purchase-orders:3000";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await emitAfterWrite(
      "create_purchase_order",
      {
        id: "po1",
        password: "should-not-exist",
        lineItems: [
          {
            id: "li1",
            passwordHash: "should-not-exist",
            quantity: 10,
          },
        ],
      },
      "/po1",
    );

    const request = fetchMock.mock.calls[0]?.[1] as { body: string };
    const payload = JSON.parse(request.body);
    expect(payload.body).toEqual({
      id: "po1",
      lineItems: [
        {
          id: "li1",
          quantity: 10,
        },
      ],
    });
  });
});
