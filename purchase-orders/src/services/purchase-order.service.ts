import { randomUUID } from "node:crypto";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../db/data-source";
import { PurchaseOrderLineItem } from "../entities/purchase-order-line-item.entity";
import { PurchaseOrderPaymentMilestone } from "../entities/purchase-order-payment-milestone.entity";
import { PurchaseOrder } from "../entities/purchase-order.entity";
import { PurchaseOrderWritePayload } from "../schemas/purchase-order.schema";

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }
  return value;
}

function toNullableDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function applyPayloadToPurchaseOrder(entity: PurchaseOrder, payload: PurchaseOrderWritePayload): void {
  if (payload.step1 !== undefined) {
    const step1 = payload.step1;
    if (step1 === null) {
      entity.requestedByDepartment = null;
      entity.requestedByUser = null;
      entity.budgetCode = null;
      entity.needByDate = null;
    } else {
      if ("requestedByDepartment" in step1) {
        entity.requestedByDepartment = toNullableString(step1.requestedByDepartment);
      }
      if ("requestedByUser" in step1) {
        entity.requestedByUser = toNullableString(step1.requestedByUser);
      }
      if ("budgetCode" in step1) {
        entity.budgetCode = toNullableString(step1.budgetCode);
      }
      if ("needByDate" in step1) {
        entity.needByDate = toNullableDate(step1.needByDate);
      }
    }
  }

  if (payload.step2 !== undefined) {
    const step2 = payload.step2;
    if (step2 === null) {
      entity.supplierName = null;
    } else if ("supplierName" in step2) {
      entity.supplierName = toNullableString(step2.supplierName);
    }
  }

  if (payload.step3 !== undefined) {
    const step3 = payload.step3;
    if (step3 === null) {
      entity.paymentTermId = null;
      entity.paymentTermLabel = null;
      entity.paymentTermDescription = null;
      entity.taxIncluded = null;
      entity.advancePercentage = null;
      entity.balanceDueInDays = null;
      entity.customTerms = null;
    } else {
      if ("paymentTerm" in step3) {
        const paymentTerm = step3.paymentTerm;
        if (paymentTerm === null) {
          entity.paymentTermId = null;
          entity.paymentTermLabel = null;
          entity.paymentTermDescription = null;
        } else if (paymentTerm) {
          if ("id" in paymentTerm) {
            entity.paymentTermId = toNullableString(paymentTerm.id);
          }
          if ("label" in paymentTerm) {
            entity.paymentTermLabel = toNullableString(paymentTerm.label);
          }
          if ("description" in paymentTerm) {
            entity.paymentTermDescription = toNullableString(paymentTerm.description);
          }
        }
      }
      if ("taxIncluded" in step3) {
        entity.taxIncluded = toNullableBoolean(step3.taxIncluded);
      }
      if ("advancePercentage" in step3) {
        entity.advancePercentage = toNullableNumber(step3.advancePercentage);
      }
      if ("balanceDueInDays" in step3) {
        entity.balanceDueInDays = toNullableNumber(step3.balanceDueInDays);
      }
      if ("customTerms" in step3) {
        entity.customTerms = toNullableString(step3.customTerms);
      }
    }
  }

  if (payload.step4 !== undefined) {
    const step4 = payload.step4;
    if (step4 === null) {
      entity.step4Primary = null;
      entity.step4Secondary = null;
      entity.step4Tertiary = null;
    } else {
      if ("primary" in step4) {
        entity.step4Primary = toNullableString(step4.primary);
      }
      if ("secondary" in step4) {
        entity.step4Secondary = toNullableString(step4.secondary);
      }
      if ("tertiary" in step4) {
        entity.step4Tertiary = toNullableString(step4.tertiary);
      }
    }
  }

  if (payload.step5 !== undefined) {
    const step5 = payload.step5;
    if (step5 === null) {
      entity.step5Primary = null;
      entity.step5Secondary = null;
      entity.step5Tertiary = null;
    } else {
      if ("primary" in step5) {
        entity.step5Primary = toNullableString(step5.primary);
      }
      if ("secondary" in step5) {
        entity.step5Secondary = toNullableString(step5.secondary);
      }
      if ("tertiary" in step5) {
        entity.step5Tertiary = toNullableString(step5.tertiary);
      }
    }
  }
}

function buildLineItem(row: PurchaseOrderWritePayload["step2"] extends infer S
  ? S extends { items?: infer I }
    ? I extends Array<infer R>
      ? R
      : never
    : never
  : never, purchaseOrderId: string, sortOrder: number): PurchaseOrderLineItem {
  const lineItem = new PurchaseOrderLineItem();
  lineItem.id = toNullableString(row.id) ?? randomUUID();
  lineItem.purchaseOrderId = purchaseOrderId;
  lineItem.catalogItemId = toNullableString(row.catalogItemId);
  lineItem.item = toNullableString(row.item);
  lineItem.supplier = toNullableString(row.supplier);
  lineItem.category = toNullableString(row.category);
  lineItem.description = toNullableString(row.description);
  lineItem.quantity = toNullableNumber(row.quantity);
  lineItem.unitPrice = toNullableNumber(row.unitPrice);
  lineItem.sortOrder = sortOrder;
  return lineItem;
}

function buildMilestone(row: PurchaseOrderWritePayload["step3"] extends infer S
  ? S extends { milestones?: infer I }
    ? I extends Array<infer R>
      ? R
      : never
    : never
  : never, purchaseOrderId: string, sortOrder: number): PurchaseOrderPaymentMilestone {
  const milestone = new PurchaseOrderPaymentMilestone();
  milestone.id = toNullableString(row.id) ?? randomUUID();
  milestone.purchaseOrderId = purchaseOrderId;
  milestone.label = toNullableString(row.label);
  milestone.percentage = toNullableNumber(row.percentage);
  milestone.dueInDays = toNullableNumber(row.dueInDays);
  milestone.sortOrder = sortOrder;
  return milestone;
}

async function replaceLineItemsIfProvided(
  manager: EntityManager,
  purchaseOrderId: string,
  payload: PurchaseOrderWritePayload,
): Promise<void> {
  if (!payload.step2 || payload.step2.items === undefined) {
    return;
  }

  const lineItemRepository = manager.getRepository(PurchaseOrderLineItem);
  await lineItemRepository.delete({ purchaseOrderId });

  const incomingItems = payload.step2.items ?? [];
  if (incomingItems.length === 0) {
    return;
  }

  const nextRows = incomingItems.map((item, index) => buildLineItem(item, purchaseOrderId, index));
  await lineItemRepository.save(nextRows);
}

async function replaceMilestonesIfProvided(
  manager: EntityManager,
  purchaseOrderId: string,
  payload: PurchaseOrderWritePayload,
): Promise<void> {
  if (!payload.step3 || payload.step3.milestones === undefined) {
    return;
  }

  const milestoneRepository = manager.getRepository(PurchaseOrderPaymentMilestone);
  await milestoneRepository.delete({ purchaseOrderId });

  const incomingRows = payload.step3.milestones ?? [];
  if (incomingRows.length === 0) {
    return;
  }

  const nextRows = incomingRows.map((milestone, index) =>
    buildMilestone(milestone, purchaseOrderId, index),
  );
  await milestoneRepository.save(nextRows);
}

export async function createPurchaseOrder(payload: PurchaseOrderWritePayload): Promise<PurchaseOrder> {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(PurchaseOrder);
    const purchaseOrder = repository.create({
      id: randomUUID(),
      status: "DRAFT",
      requestedByDepartment: null,
      requestedByUser: null,
      budgetCode: null,
      needByDate: null,
      supplierName: null,
      paymentTermId: null,
      paymentTermLabel: null,
      paymentTermDescription: null,
      taxIncluded: null,
      advancePercentage: null,
      balanceDueInDays: null,
      customTerms: null,
      step4Primary: null,
      step4Secondary: null,
      step4Tertiary: null,
      step5Primary: null,
      step5Secondary: null,
      step5Tertiary: null,
    });

    applyPayloadToPurchaseOrder(purchaseOrder, payload);
    const saved = await repository.save(purchaseOrder);

    await replaceLineItemsIfProvided(manager, saved.id, payload);
    await replaceMilestonesIfProvided(manager, saved.id, payload);

    const full = await repository.findOneOrFail({
      where: { id: saved.id },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });

    return full;
  });
}

export async function updatePurchaseOrder(
  purchaseOrderId: string,
  payload: PurchaseOrderWritePayload,
): Promise<PurchaseOrder | null> {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(PurchaseOrder);
    const existing = await repository.findOne({
      where: { id: purchaseOrderId },
    });

    if (!existing) {
      return null;
    }

    applyPayloadToPurchaseOrder(existing, payload);
    await repository.save(existing);

    await replaceLineItemsIfProvided(manager, purchaseOrderId, payload);
    await replaceMilestonesIfProvided(manager, purchaseOrderId, payload);

    const full = await repository.findOneOrFail({
      where: { id: purchaseOrderId },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });

    return full;
  });
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: string,
): Promise<PurchaseOrder | null> {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(PurchaseOrder);
    const existing = await repository.findOne({
      where: { id: purchaseOrderId },
    });

    if (!existing) {
      return null;
    }

    existing.status = status;
    await repository.save(existing);

    const full = await repository.findOneOrFail({
      where: { id: purchaseOrderId },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });

    return full;
  });
}
