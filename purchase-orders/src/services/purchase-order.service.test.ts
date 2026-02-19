import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let AppDataSource: Awaited<typeof import("../db/data-source")>["AppDataSource"];
let createPurchaseOrder: Awaited<typeof import("./purchase-order.service")>["createPurchaseOrder"];
let updatePurchaseOrder: Awaited<typeof import("./purchase-order.service")>["updatePurchaseOrder"];
let SupplierMismatchConflictError: Awaited<
  typeof import("./purchase-order.service")
>["SupplierMismatchConflictError"];

describe("purchase-order.service single supplier validation", () => {
  beforeAll(async () => {
    process.env.PURCHASE_ORDERS_DATABASE_URL =
      process.env.PURCHASE_ORDERS_DATABASE_URL ??
      "postgres://test:test@localhost:5432/test_purchase_orders";

    ({ AppDataSource } = await import("../db/data-source"));
    ({ createPurchaseOrder, updatePurchaseOrder, SupplierMismatchConflictError } = await import(
      "./purchase-order.service"
    ));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws on create when payload includes mixed line item suppliers", async () => {
    const purchaseOrderRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(),
      findOneOrFail: vi.fn(),
    };
    const manager = {
      getRepository: vi.fn(() => purchaseOrderRepository),
    };

    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (cb) =>
      cb(manager as never),
    );

    await expect(
      createPurchaseOrder({
        step2: {
          supplierName: "Supplier A",
          items: [
            { id: "1", supplier: "Supplier A" },
            { id: "2", supplier: "Supplier B" },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(SupplierMismatchConflictError);
    expect(purchaseOrderRepository.save).not.toHaveBeenCalled();
  });

  it("throws on update when supplierName conflicts with existing line items", async () => {
    const existing = {
      id: "po-1",
      supplierName: "Supplier A",
      lineItems: [{ supplier: "Supplier A" }],
    };
    const purchaseOrderRepository = {
      findOne: vi.fn().mockResolvedValue(existing),
      save: vi.fn(),
      findOneOrFail: vi.fn(),
    };
    const manager = {
      getRepository: vi.fn(() => purchaseOrderRepository),
    };

    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (cb) =>
      cb(manager as never),
    );

    await expect(
      updatePurchaseOrder("po-1", {
        step2: {
          supplierName: "Supplier B",
        },
      }),
    ).rejects.toBeInstanceOf(SupplierMismatchConflictError);
    expect(purchaseOrderRepository.save).not.toHaveBeenCalled();
  });

  it("throws on update when payload includes mixed line item suppliers", async () => {
    const existing = {
      id: "po-1",
      supplierName: "Supplier A",
      lineItems: [{ supplier: "Supplier A" }],
    };
    const purchaseOrderRepository = {
      findOne: vi.fn().mockResolvedValue(existing),
      save: vi.fn(),
      findOneOrFail: vi.fn(),
    };
    const manager = {
      getRepository: vi.fn(() => purchaseOrderRepository),
    };

    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (cb) =>
      cb(manager as never),
    );

    await expect(
      updatePurchaseOrder("po-1", {
        step2: {
          supplierName: "Supplier A",
          items: [
            { id: "1", supplier: "Supplier A" },
            { id: "2", supplier: "Supplier B" },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(SupplierMismatchConflictError);
    expect(purchaseOrderRepository.save).not.toHaveBeenCalled();
  });
});
