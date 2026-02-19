import { PurchaseOrderLineItem } from "../entities/purchase-order-line-item.entity";
import { PurchaseOrderPaymentMilestone } from "../entities/purchase-order-payment-milestone.entity";
import { PurchaseOrder } from "../entities/purchase-order.entity";

type ScalarFieldChange = {
  before: string | number | boolean | null;
  after: string | number | boolean | null;
};

type RowFieldChange = {
  before: string | number | null;
  after: string | number | null;
};

type RowUpdate = {
  id: string;
  changes: Record<string, RowFieldChange>;
};

type CollectionDiff<T> = {
  added: T[];
  removed: T[];
  updated: RowUpdate[];
};

type PurchaseOrderSnapshot = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  poNumber: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
  requestedByDepartment: string | null;
  requestedByUser: string | null;
  budgetCode: string | null;
  needByDate: string | null;
  supplierName: string | null;
  paymentTermId: string | null;
  paymentTermLabel: string | null;
  paymentTermDescription: string | null;
  taxIncluded: boolean | null;
  advancePercentage: number | null;
  balanceDueInDays: number | null;
  customTerms: string | null;
  step4Primary: string | null;
  step4Secondary: string | null;
  step4Tertiary: string | null;
  step5Primary: string | null;
  step5Secondary: string | null;
  step5Tertiary: string | null;
  lineItems: Array<{
    id: string;
    purchaseOrderId: string;
    createdAt: string;
    updatedAt: string;
    catalogItemId: string | null;
    item: string | null;
    supplier: string | null;
    category: string | null;
    description: string | null;
    quantity: number | null;
    unitPrice: number | null;
    sortOrder: number;
  }>;
  milestones: Array<{
    id: string;
    purchaseOrderId: string;
    createdAt: string;
    updatedAt: string;
    label: string | null;
    percentage: number | null;
    dueInDays: number | null;
    sortOrder: number;
  }>;
};

const SCALAR_KEYS: Array<keyof Omit<PurchaseOrderSnapshot, "id" | "lineItems" | "milestones">> = [
  "createdAt",
  "updatedAt",
  "status",
  "poNumber",
  "submittedAt",
  "submittedBy",
  "approvedAt",
  "approvedBy",
  "rejectedAt",
  "rejectedBy",
  "fulfilledAt",
  "fulfilledBy",
  "requestedByDepartment",
  "requestedByUser",
  "budgetCode",
  "needByDate",
  "supplierName",
  "paymentTermId",
  "paymentTermLabel",
  "paymentTermDescription",
  "taxIncluded",
  "advancePercentage",
  "balanceDueInDays",
  "customTerms",
  "step4Primary",
  "step4Secondary",
  "step4Tertiary",
  "step5Primary",
  "step5Secondary",
  "step5Tertiary",
];

function snapshotLineItem(item: PurchaseOrderLineItem): PurchaseOrderSnapshot["lineItems"][number] {
  return {
    id: item.id,
    purchaseOrderId: item.purchaseOrderId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    catalogItemId: item.catalogItemId,
    item: item.item,
    supplier: item.supplier,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    sortOrder: item.sortOrder,
  };
}

function snapshotMilestone(
  milestone: PurchaseOrderPaymentMilestone,
): PurchaseOrderSnapshot["milestones"][number] {
  return {
    id: milestone.id,
    purchaseOrderId: milestone.purchaseOrderId,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
    label: milestone.label,
    percentage: milestone.percentage,
    dueInDays: milestone.dueInDays,
    sortOrder: milestone.sortOrder,
  };
}

export function toPurchaseOrderSnapshot(entity: PurchaseOrder): PurchaseOrderSnapshot {
  return {
    id: entity.id,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    status: entity.status,
    poNumber: entity.poNumber,
    submittedAt: entity.submittedAt ? entity.submittedAt.toISOString() : null,
    submittedBy: entity.submittedBy,
    approvedAt: entity.approvedAt ? entity.approvedAt.toISOString() : null,
    approvedBy: entity.approvedBy,
    rejectedAt: entity.rejectedAt ? entity.rejectedAt.toISOString() : null,
    rejectedBy: entity.rejectedBy,
    fulfilledAt: entity.fulfilledAt ? entity.fulfilledAt.toISOString() : null,
    fulfilledBy: entity.fulfilledBy,
    requestedByDepartment: entity.requestedByDepartment,
    requestedByUser: entity.requestedByUser,
    budgetCode: entity.budgetCode,
    needByDate: entity.needByDate,
    supplierName: entity.supplierName,
    paymentTermId: entity.paymentTermId,
    paymentTermLabel: entity.paymentTermLabel,
    paymentTermDescription: entity.paymentTermDescription,
    taxIncluded: entity.taxIncluded,
    advancePercentage: entity.advancePercentage,
    balanceDueInDays: entity.balanceDueInDays,
    customTerms: entity.customTerms,
    step4Primary: entity.step4Primary,
    step4Secondary: entity.step4Secondary,
    step4Tertiary: entity.step4Tertiary,
    step5Primary: entity.step5Primary,
    step5Secondary: entity.step5Secondary,
    step5Tertiary: entity.step5Tertiary,
    lineItems: (entity.lineItems ?? []).map(snapshotLineItem),
    milestones: (entity.milestones ?? []).map(snapshotMilestone),
  };
}

function buildScalarDiff(
  before: PurchaseOrderSnapshot | null,
  after: PurchaseOrderSnapshot,
): Record<string, ScalarFieldChange> {
  const diff: Record<string, ScalarFieldChange> = {};

  for (const key of SCALAR_KEYS) {
    const beforeValue = before ? before[key] : null;
    const afterValue = after[key];
    if (beforeValue !== afterValue) {
      diff[key] = { before: beforeValue, after: afterValue };
    }
  }

  return diff;
}

function mapById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function buildCollectionDiff<
  T extends { id: string },
  K extends Exclude<keyof T, "id">,
>(
  beforeRows: T[],
  afterRows: T[],
  comparableFields: K[],
): CollectionDiff<T> {
  const beforeById = mapById(beforeRows);
  const afterById = mapById(afterRows);

  const added = afterRows.filter((row) => !beforeById.has(row.id));
  const removed = beforeRows.filter((row) => !afterById.has(row.id));
  const updated: RowUpdate[] = [];

  for (const afterRow of afterRows) {
    const beforeRow = beforeById.get(afterRow.id);
    if (!beforeRow) {
      continue;
    }

    const changes: Record<string, RowFieldChange> = {};
    for (const field of comparableFields) {
      const beforeValue = beforeRow[field];
      const afterValue = afterRow[field];
      if (beforeValue !== afterValue) {
        changes[String(field)] = {
          before: (beforeValue as string | number | null) ?? null,
          after: (afterValue as string | number | null) ?? null,
        };
      }
    }

    if (Object.keys(changes).length > 0) {
      updated.push({ id: afterRow.id, changes });
    }
  }

  return { added, removed, updated };
}

export function buildCreatePurchaseOrderEventPayload(entity: PurchaseOrder): Record<string, unknown> {
  const snapshot = toPurchaseOrderSnapshot(entity);

  return {
    id: snapshot.id,
    snapshot,
    changes: {
      fields: buildScalarDiff(null, snapshot),
      lineItems: {
        added: snapshot.lineItems,
        removed: [],
        updated: [],
      },
      milestones: {
        added: snapshot.milestones,
        removed: [],
        updated: [],
      },
    },
  };
}

export function buildEditPurchaseOrderEventPayload(
  beforeEntity: PurchaseOrder,
  afterEntity: PurchaseOrder,
): Record<string, unknown> {
  const before = toPurchaseOrderSnapshot(beforeEntity);
  const after = toPurchaseOrderSnapshot(afterEntity);

  return {
    id: after.id,
    changes: {
      fields: buildScalarDiff(before, after),
      lineItems: buildCollectionDiff(before.lineItems, after.lineItems, [
        "purchaseOrderId",
        "createdAt",
        "updatedAt",
        "catalogItemId",
        "item",
        "supplier",
        "category",
        "description",
        "quantity",
        "unitPrice",
        "sortOrder",
      ]),
      milestones: buildCollectionDiff(before.milestones, after.milestones, [
        "purchaseOrderId",
        "createdAt",
        "updatedAt",
        "label",
        "percentage",
        "dueInDays",
        "sortOrder",
      ]),
    },
    snapshot: after,
  };
}
