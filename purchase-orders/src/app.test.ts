import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let app: Awaited<typeof import("./app")>["app"];
let AppDataSource: Awaited<typeof import("./db/data-source")>["AppDataSource"];
let purchaseOrderService: Awaited<typeof import("./services/purchase-order.service")>;

describe("app routes", () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const originalDbUrl = process.env.PURCHASE_ORDERS_DATABASE_URL;

  beforeAll(async () => {
    process.env.PURCHASE_ORDERS_DATABASE_URL =
      process.env.PURCHASE_ORDERS_DATABASE_URL ??
      "postgres://test:test@localhost:5432/test_purchase_orders";
    ({ app } = await import("./app"));
    ({ AppDataSource } = await import("./db/data-source"));
    purchaseOrderService = await import("./services/purchase-order.service");
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

  it("returns 409 when creating purchase order with supplier mismatch", async () => {
    vi.spyOn(purchaseOrderService, "createPurchaseOrder").mockRejectedValue(
      new purchaseOrderService.SupplierMismatchConflictError(),
    );

    const response = await request(app)
      .post("/")
      .set("x-internal-key", "test-key")
      .send({
        step2: {
          supplierName: "Supplier A",
          items: [
            { id: "1", supplier: "Supplier A" },
            { id: "2", supplier: "Supplier B" },
          ],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "All items in a PO must come from the same supplier",
    });
  });

  it("returns 409 when updating purchase order with supplier mismatch", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({
        id: "po-1",
        status: purchaseOrderService.PURCHASE_ORDER_STATUS.DRAFT,
        lineItems: [{ supplier: "Supplier A" }],
        milestones: [],
        statusHistory: [],
      }),
    } as never);

    vi.spyOn(purchaseOrderService, "updatePurchaseOrder").mockRejectedValue(
      new purchaseOrderService.SupplierMismatchConflictError(),
    );

    const response = await request(app)
      .put("/po-1")
      .set("x-internal-key", "test-key")
      .send({
        step2: {
          supplierName: "Supplier A",
          items: [
            { id: "1", supplier: "Supplier A" },
            { id: "2", supplier: "Supplier B" },
          ],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "All items in a PO must come from the same supplier",
    });
  });

  afterAll(() => {
    process.env.INTERNAL_SERVICE_KEY = originalKey;
    process.env.PURCHASE_ORDERS_DATABASE_URL = originalDbUrl;
  });
});
