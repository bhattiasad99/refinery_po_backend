import { randomUUID } from "node:crypto";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../db/data-source";
import { PurchaseOrderLineItem } from "../entities/purchase-order-line-item.entity";
import { PurchaseOrderNumberCounter } from "../entities/purchase-order-number-counter.entity";
import { PurchaseOrderPaymentMilestone } from "../entities/purchase-order-payment-milestone.entity";
import { PurchaseOrder } from "../entities/purchase-order.entity";
import { PurchaseOrderStatusHistory } from "../entities/purchase-order-status-history.entity";
import { PurchaseOrderWritePayload } from "../schemas/purchase-order.schema";

export const PURCHASE_ORDER_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FULFILLED: "FULFILLED",
} as const;

export type PurchaseOrderStatus =
  typeof PURCHASE_ORDER_STATUS[keyof typeof PURCHASE_ORDER_STATUS];

const PO_NUMBER_PREFIX = "PO";
const PO_NUMBER_SEQUENCE_LENGTH = 4;
export const SUPPLIER_MISMATCH_MESSAGE = "All items in a PO must come from the same supplier";

const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: [PURCHASE_ORDER_STATUS.SUBMITTED],
  SUBMITTED: [PURCHASE_ORDER_STATUS.APPROVED, PURCHASE_ORDER_STATUS.REJECTED],
  APPROVED: [PURCHASE_ORDER_STATUS.FULFILLED],
  REJECTED: [],
  FULFILLED: [],
};

export class SupplierMismatchConflictError extends Error {
  constructor(message = SUPPLIER_MISMATCH_MESSAGE) {
    super(message);
    this.name = "SupplierMismatchConflictError";
  }
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertSingleSupplierMatchOrThrow(
  supplierName: string | null,
  lineItems: Array<{ supplier?: unknown }>,
): void {
  if (lineItems.length > 0 && !supplierName) {
    throw new SupplierMismatchConflictError();
  }

  for (const lineItem of lineItems) {
    const itemSupplier = toNullableString(lineItem.supplier);
    if (!itemSupplier || itemSupplier !== supplierName) {
      throw new SupplierMismatchConflictError();
    }
  }
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

function toUtcDayStamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function toUtcCounterDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPurchaseOrderNumber(date: Date, sequence: number): string {
  const dateStamp = toUtcDayStamp(date);
  const sequenceStamp = String(sequence).padStart(PO_NUMBER_SEQUENCE_LENGTH, "0");
  return `${PO_NUMBER_PREFIX}-${dateStamp}-${sequenceStamp}`;
}

async function getNextPurchaseOrderSequence(manager: EntityManager, date: Date): Promise<number> {
  // Atomic increment per UTC day to avoid duplicate IDs under concurrent creation.
  const counterDate = toUtcCounterDate(date);
  const counterRepository = manager.getRepository(PurchaseOrderNumberCounter);

  const upsertResult = await counterRepository.query(
    `INSERT INTO purchase_order_number_counters (counter_date, last_value, updated_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (counter_date)
     DO UPDATE SET
       last_value = purchase_order_number_counters.last_value + 1,
       updated_at = NOW()
     RETURNING last_value`,
    [counterDate],
  );

  const sequence = Number(upsertResult?.[0]?.last_value);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    throw new Error("Failed to generate purchase order id sequence");
  }

  return Math.floor(sequence);
}

async function recordStatusTransition(
  manager: EntityManager,
  purchaseOrderId: string,
  fromStatus: string | null,
  toStatus: PurchaseOrderStatus,
  changedBy: string | null,
  changedAt: Date,
): Promise<void> {
  const statusHistoryRepository = manager.getRepository(PurchaseOrderStatusHistory);
  const row = statusHistoryRepository.create({
    id: randomUUID(),
    purchaseOrderId,
    fromStatus,
    toStatus,
    changedBy,
    changedAt,
  });
  await statusHistoryRepository.save(row);
}

export function getAllowedTransitions(status: string): PurchaseOrderStatus[] {
  const normalized = String(status || "").toUpperCase() as PurchaseOrderStatus;
  return ALLOWED_TRANSITIONS[normalized] ?? [];
}

export function canTransitionPurchaseOrderStatus(
  fromStatus: string,
  toStatus: PurchaseOrderStatus,
): boolean {
  return getAllowedTransitions(fromStatus).includes(toStatus);
}

export function validatePurchaseOrderForSubmission(purchaseOrder: PurchaseOrder): string | null {
  if (!purchaseOrder.requestedByDepartment) {
    return "Requested by department is required before submission";
  }
  if (!purchaseOrder.requestedByUser) {
    return "Requested by user is required before submission";
  }
  if (!purchaseOrder.budgetCode) {
    return "Budget code is required before submission";
  }
  if (!purchaseOrder.supplierName) {
    return "Supplier name is required before submission";
  }

  const lineItems = purchaseOrder.lineItems ?? [];
  if (lineItems.length === 0) {
    return "At least one line item is required before submission";
  }

  const hasInvalidLineItem = lineItems.some((item) => {
    const quantity = typeof item.quantity === "number" ? item.quantity : null;
    const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : null;
    return !item.item || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0;
  });

  if (hasInvalidLineItem) {
    return "Each line item must include name, quantity (>0), and unit price (>=0)";
  }

  return null;
}

function applyPayloadToPurchaseOrder(entity: PurchaseOrder, payload: PurchaseOrderWritePayload): void {
  // Each step supports partial updates and explicit null reset semantics.
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

type Step2ItemInput = NonNullable<NonNullable<PurchaseOrderWritePayload["step2"]>["items"]>[number];
type Step3MilestoneInput = NonNullable<
  NonNullable<PurchaseOrderWritePayload["step3"]>["milestones"]
>[number];

function buildLineItem(
  row: Step2ItemInput,
  purchaseOrderId: string,
  sortOrder: number,
): PurchaseOrderLineItem {
  const lineItem = new PurchaseOrderLineItem();
  lineItem.id = toNullableString(row.id) ?? randomUUID();
  lineItem.purchaseOrderId = purchaseOrderId;
  lineItem.catalogItemId = toNullableString(row.catalogItemId);
  lineItem.item = toNullableString(row.item);
  lineItem.supplier = toNullableString(row.supplier) ?? "";
  lineItem.category = toNullableString(row.category);
  lineItem.description = toNullableString(row.description);
  lineItem.quantity = toNullableNumber(row.quantity);
  lineItem.unitPrice = toNullableNumber(row.unitPrice);
  lineItem.sortOrder = sortOrder;
  return lineItem;
}

function buildMilestone(
  row: Step3MilestoneInput,
  purchaseOrderId: string,
  sortOrder: number,
): PurchaseOrderPaymentMilestone {
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
  // Treat provided arrays as full replacement to keep ordering and removals deterministic.
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
      id: "",
      status: "DRAFT",
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      fulfilledAt: null,
      fulfilledBy: null,
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
    if (payload.step2?.items !== undefined) {
      assertSingleSupplierMatchOrThrow(purchaseOrder.supplierName, payload.step2.items ?? []);
    }

    const now = new Date();
    const nextSequence = await getNextPurchaseOrderSequence(manager, now);
    purchaseOrder.id = formatPurchaseOrderNumber(now, nextSequence);

    const saved = await repository.save(purchaseOrder);

    await replaceLineItemsIfProvided(manager, saved.id, payload);
    await replaceMilestonesIfProvided(manager, saved.id, payload);

    // Always return a fully hydrated aggregate for API responses.
    const full = await repository.findOneOrFail({
      where: { id: saved.id },
      relations: ["lineItems", "milestones", "statusHistory"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
        statusHistory: { changedAt: "ASC" },
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
      relations: ["lineItems"],
    });

    if (!existing) {
      return null;
    }

    applyPayloadToPurchaseOrder(existing, payload);
    if (payload.step2?.items !== undefined) {
      assertSingleSupplierMatchOrThrow(existing.supplierName, payload.step2.items ?? []);
    } else if (payload.step2 === null) {
      assertSingleSupplierMatchOrThrow(existing.supplierName, existing.lineItems ?? []);
    } else if (payload.step2?.supplierName !== undefined) {
      assertSingleSupplierMatchOrThrow(existing.supplierName, existing.lineItems ?? []);
    }
    await repository.save(existing);

    await replaceLineItemsIfProvided(manager, purchaseOrderId, payload);
    await replaceMilestonesIfProvided(manager, purchaseOrderId, payload);

    const full = await repository.findOneOrFail({
      where: { id: purchaseOrderId },
      relations: ["lineItems", "milestones", "statusHistory"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
        statusHistory: { changedAt: "ASC" },
      },
    });

    return full;
  });
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: PurchaseOrderStatus,
  actor: string | null = null,
): Promise<PurchaseOrder | null> {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(PurchaseOrder);
    const existing = await repository.findOne({
      where: { id: purchaseOrderId },
    });

    if (!existing) {
      return null;
    }

    const previousStatus = existing.status;
    const changedAt = new Date();
    // Transition side-effects are centralized here to keep status timeline consistent.
    existing.status = status;
    if (status === PURCHASE_ORDER_STATUS.SUBMITTED) {
      existing.submittedAt = changedAt;
      existing.submittedBy = actor;
    } else if (status === PURCHASE_ORDER_STATUS.APPROVED) {
      existing.approvedAt = changedAt;
      existing.approvedBy = actor;
    } else if (status === PURCHASE_ORDER_STATUS.REJECTED) {
      existing.rejectedAt = changedAt;
      existing.rejectedBy = actor;
    } else if (status === PURCHASE_ORDER_STATUS.FULFILLED) {
      existing.fulfilledAt = changedAt;
      existing.fulfilledBy = actor;
    }
    await repository.save(existing);
    await recordStatusTransition(
      manager,
      purchaseOrderId,
      previousStatus,
      status,
      actor,
      changedAt,
    );

    const full = await repository.findOneOrFail({
      where: { id: purchaseOrderId },
      relations: ["lineItems", "milestones", "statusHistory"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
        statusHistory: { changedAt: "ASC" },
      },
    });

    return full;
  });
}

export type PurchaseOrdersPerDayPoint = {
  date: string;
  count: number;
};

export type DashboardStats = {
  totalPurchases: number;
  totalPurchaseOrders: number;
  totalItemsPurchased: number;
  purchaseOrdersThisMonth: number;
  purchaseOrdersPerDay: PurchaseOrdersPerDayPoint[];
};

type EventBusEvent = {
  timestamp?: string;
  data?: {
    snapshot?: {
      createdAt?: string;
    };
  };
};

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toSafeNumber(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function toMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function buildDailySeriesFromDates(dates: Date[]): PurchaseOrdersPerDayPoint[] {
  if (dates.length === 0) {
    return [];
  }

  const byDay = new Map<string, number>();
  let minTimestamp = Number.POSITIVE_INFINITY;
  let maxTimestamp = Number.NEGATIVE_INFINITY;

  for (const date of dates) {
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const day = formatUtcDate(date);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    const timestamp = date.getTime();
    minTimestamp = Math.min(minTimestamp, timestamp);
    maxTimestamp = Math.max(maxTimestamp, timestamp);
  }

  if (!Number.isFinite(minTimestamp) || !Number.isFinite(maxTimestamp)) {
    return [];
  }

  const points: PurchaseOrdersPerDayPoint[] = [];
  const cursor = new Date(minTimestamp);
  cursor.setUTCHours(0, 0, 0, 0);

  const end = new Date(maxTimestamp);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const day = formatUtcDate(cursor);
    points.push({
      date: day,
      count: byDay.get(day) ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

async function fetchDailySeriesFromEventBus(): Promise<PurchaseOrdersPerDayPoint[] | null> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    return null;
  }

  const headers: Record<string, string> = {};
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }

  const query = new URLSearchParams({
    source: "purchase-orders",
    name: "create_purchase_order",
    from: new Date(0).toISOString(),
    to: new Date().toISOString(),
    order: "ASC",
    limit: "500",
  });

  try {
    const response = await fetch(`${eventBusUrl.replace(/\/+$/, "")}/events?${query.toString()}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) {
      return null;
    }

    // Event bus caps this endpoint to 500 items; avoid returning partial chart data.
    if (body.length >= 500) {
      return null;
    }

    const creationDates: Date[] = [];
    for (const row of body as EventBusEvent[]) {
      const createdAt = row.data?.snapshot?.createdAt ?? row.timestamp;
      if (!createdAt) {
        continue;
      }
      const parsed = new Date(createdAt);
      if (Number.isNaN(parsed.getTime())) {
        continue;
      }
      creationDates.push(parsed);
    }

    return buildDailySeriesFromDates(creationDates);
  } catch (error) {
    console.error("Failed to fetch dashboard events from event-bus", error);
    return null;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const repository = AppDataSource.getRepository(PurchaseOrder);
  const rows = await repository.find({
    relations: ["lineItems"],
    order: {
      createdAt: "ASC",
      lineItems: { sortOrder: "ASC" },
    },
  });

  const now = new Date();
  const monthStart = toMonthStartUtc(now);

  let totalPurchases = 0;
  let totalItemsPurchased = 0;
  let purchaseOrdersThisMonth = 0;

  for (const row of rows) {
    if (row.createdAt >= monthStart) {
      purchaseOrdersThisMonth += 1;
    }

    for (const lineItem of row.lineItems ?? []) {
      const quantity = toSafeNumber(lineItem.quantity);
      const unitPrice = toSafeNumber(lineItem.unitPrice);
      totalItemsPurchased += quantity;
      totalPurchases += quantity * unitPrice;
    }
  }

  const eventBusSeries = await fetchDailySeriesFromEventBus();
  const fallbackSeries = buildDailySeriesFromDates(rows.map((row) => row.createdAt));

  return {
    totalPurchases,
    totalPurchaseOrders: rows.length,
    totalItemsPurchased,
    purchaseOrdersThisMonth,
    purchaseOrdersPerDay: eventBusSeries ?? fallbackSeries,
  };
}
