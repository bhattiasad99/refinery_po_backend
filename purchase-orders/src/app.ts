import express from "express";
import type { NextFunction, Request, Response } from "express";
import { AppDataSource } from "./db/data-source";
import { PurchaseOrder } from "./entities/purchase-order.entity";
import { parseIncomingEvent } from "./schemas/incoming-event.schema";
import {
  parsePurchaseOrderId,
  parsePurchaseOrderWritePayload,
} from "./schemas/purchase-order.schema";
import { emitAfterWrite } from "./services/event-publisher.service";
import {
  buildCreatePurchaseOrderEventPayload,
  buildEditPurchaseOrderEventPayload,
} from "./services/purchase-order-event-payload.service";
import {
  canTransitionPurchaseOrderStatus,
  createPurchaseOrder,
  PURCHASE_ORDER_STATUS,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  validatePurchaseOrderForSubmission,
} from "./services/purchase-order.service";
import { processIncomingProjectionEvent } from "./services/projection.service";

export const app = express();

app.use(express.json());

function checkResource(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/health" || req.path === "/healthz") {
    return next();
  }

  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (!internalServiceKey) {
    return next();
  }

  const incomingKey = req.header("x-internal-key");
  if (incomingKey !== internalServiceKey) {
    return res.status(403).json({ message: "Forbidden resource access" });
  }

  return next();
}

app.use(checkResource);

function resolveActor(req: Request): string | null {
  const email = req.header("x-user-email")?.trim();
  if (email) {
    return email;
  }

  const userId = req.header("x-user-id")?.trim();
  return userId || null;
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", async (_req, res) => {
  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const rows = await repository.find({
      relations: ["lineItems", "milestones"],
      order: {
        createdAt: "DESC",
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
      take: 100,
    });
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Failed to list purchase orders", error);
    return res.status(500).json({ message: "Failed to list purchase orders" });
  }
});

app.get("/:purchaseOrderId", async (req: Request, res: Response) => {
  const parsedId = parsePurchaseOrderId(req.params.purchaseOrderId);
  if (!parsedId.ok) {
    return res.status(400).json({ message: parsedId.message });
  }

  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const row = await repository.findOne({
      where: { id: parsedId.value },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });

    if (!row) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    return res.status(200).json(row);
  } catch (error) {
    console.error("Failed to fetch purchase order", error);
    return res.status(500).json({ message: "Failed to fetch purchase order" });
  }
});

app.post("/", async (req: Request, res: Response) => {
  const parsedPayload = parsePurchaseOrderWritePayload(req.body);
  if (!parsedPayload.ok) {
    return res.status(400).json({ message: parsedPayload.message });
  }

  try {
    const created = await createPurchaseOrder(parsedPayload.value);
    await emitAfterWrite(
      "create_purchase_order",
      buildCreatePurchaseOrderEventPayload(created),
      `/${created.id}`,
    );
    return res.status(201).json(created);
  } catch (error) {
    console.error("Failed to create purchase order", error);
    return res.status(500).json({ message: "Failed to create purchase order" });
  }
});

app.put("/:purchaseOrderId", async (req: Request, res: Response) => {
  const parsedId = parsePurchaseOrderId(req.params.purchaseOrderId);
  if (!parsedId.ok) {
    return res.status(400).json({ message: parsedId.message });
  }

  const parsedPayload = parsePurchaseOrderWritePayload(req.body);
  if (!parsedPayload.ok) {
    return res.status(400).json({ message: parsedPayload.message });
  }

  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const beforeUpdate = await repository.findOne({
      where: { id: parsedId.value },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });
    if (!beforeUpdate) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    if (beforeUpdate.status !== PURCHASE_ORDER_STATUS.DRAFT) {
      return res.status(409).json({
        message: "Only draft purchase orders can be edited",
      });
    }

    const updated = await updatePurchaseOrder(parsedId.value, parsedPayload.value);
    if (!updated) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    await emitAfterWrite(
      "edit_purchase_order",
      buildEditPurchaseOrderEventPayload(beforeUpdate, updated),
      `/${updated.id}`,
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Failed to update purchase order", error);
    return res.status(500).json({ message: "Failed to update purchase order" });
  }
});

app.post("/:purchaseOrderId/submit", async (req: Request, res: Response) => {
  const parsedId = parsePurchaseOrderId(req.params.purchaseOrderId);
  if (!parsedId.ok) {
    return res.status(400).json({ message: parsedId.message });
  }

  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const beforeUpdate = await repository.findOne({
      where: { id: parsedId.value },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });
    if (!beforeUpdate) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    const nextStatus = PURCHASE_ORDER_STATUS.SUBMITTED;
    if (!canTransitionPurchaseOrderStatus(beforeUpdate.status, nextStatus)) {
      return res.status(409).json({
        message: `Cannot transition purchase order from ${beforeUpdate.status} to ${nextStatus}`,
      });
    }

    const submitValidationError = validatePurchaseOrderForSubmission(beforeUpdate);
    if (submitValidationError) {
      return res.status(400).json({ message: submitValidationError });
    }

    const updated = await updatePurchaseOrderStatus(
      parsedId.value,
      nextStatus,
      resolveActor(req),
    );
    if (!updated) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    await emitAfterWrite(
      "edit_purchase_order",
      buildEditPurchaseOrderEventPayload(beforeUpdate, updated),
      `/${updated.id}`,
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Failed to submit purchase order", error);
    return res.status(500).json({ message: "Failed to submit purchase order" });
  }
});

app.post("/:purchaseOrderId/approve", async (req: Request, res: Response) => {
  const parsedId = parsePurchaseOrderId(req.params.purchaseOrderId);
  if (!parsedId.ok) {
    return res.status(400).json({ message: parsedId.message });
  }

  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const beforeUpdate = await repository.findOne({
      where: { id: parsedId.value },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });
    if (!beforeUpdate) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const nextStatus = PURCHASE_ORDER_STATUS.APPROVED;
    if (!canTransitionPurchaseOrderStatus(beforeUpdate.status, nextStatus)) {
      return res.status(409).json({
        message: `Cannot transition purchase order from ${beforeUpdate.status} to ${nextStatus}`,
      });
    }

    const updated = await updatePurchaseOrderStatus(
      parsedId.value,
      nextStatus,
      resolveActor(req),
    );
    if (!updated) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    await emitAfterWrite(
      "edit_purchase_order",
      buildEditPurchaseOrderEventPayload(beforeUpdate, updated),
      `/${updated.id}`,
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Failed to approve purchase order", error);
    return res.status(500).json({ message: "Failed to approve purchase order" });
  }
});

app.post("/:purchaseOrderId/reject", async (req: Request, res: Response) => {
  const parsedId = parsePurchaseOrderId(req.params.purchaseOrderId);
  if (!parsedId.ok) {
    return res.status(400).json({ message: parsedId.message });
  }

  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const beforeUpdate = await repository.findOne({
      where: { id: parsedId.value },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });
    if (!beforeUpdate) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const nextStatus = PURCHASE_ORDER_STATUS.REJECTED;
    if (!canTransitionPurchaseOrderStatus(beforeUpdate.status, nextStatus)) {
      return res.status(409).json({
        message: `Cannot transition purchase order from ${beforeUpdate.status} to ${nextStatus}`,
      });
    }

    const updated = await updatePurchaseOrderStatus(
      parsedId.value,
      nextStatus,
      resolveActor(req),
    );
    if (!updated) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    await emitAfterWrite(
      "edit_purchase_order",
      buildEditPurchaseOrderEventPayload(beforeUpdate, updated),
      `/${updated.id}`,
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Failed to reject purchase order", error);
    return res.status(500).json({ message: "Failed to reject purchase order" });
  }
});

app.post("/:purchaseOrderId/fulfill", async (req: Request, res: Response) => {
  const parsedId = parsePurchaseOrderId(req.params.purchaseOrderId);
  if (!parsedId.ok) {
    return res.status(400).json({ message: parsedId.message });
  }

  try {
    const repository = AppDataSource.getRepository(PurchaseOrder);
    const beforeUpdate = await repository.findOne({
      where: { id: parsedId.value },
      relations: ["lineItems", "milestones"],
      order: {
        lineItems: { sortOrder: "ASC" },
        milestones: { sortOrder: "ASC" },
      },
    });
    if (!beforeUpdate) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const nextStatus = PURCHASE_ORDER_STATUS.FULFILLED;
    if (!canTransitionPurchaseOrderStatus(beforeUpdate.status, nextStatus)) {
      return res.status(409).json({
        message: `Cannot transition purchase order from ${beforeUpdate.status} to ${nextStatus}`,
      });
    }

    const updated = await updatePurchaseOrderStatus(
      parsedId.value,
      nextStatus,
      resolveActor(req),
    );
    if (!updated) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    await emitAfterWrite(
      "edit_purchase_order",
      buildEditPurchaseOrderEventPayload(beforeUpdate, updated),
      `/${updated.id}`,
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Failed to fulfill purchase order", error);
    return res.status(500).json({ message: "Failed to fulfill purchase order" });
  }
});

app.post("/events", async (req: Request, res: Response) => {
  const parsedEvent = parseIncomingEvent(req.body);
  if (!parsedEvent.ok) {
    return res.status(400).json({ message: parsedEvent.message });
  }

  try {
    await processIncomingProjectionEvent(parsedEvent.value);
    return res.status(200).json({
      accepted: true,
      eventName: parsedEvent.value.name,
    });
  } catch (error) {
    console.error("Failed to process incoming event", error);
    return res.status(500).json({ message: "Failed to process event" });
  }
});
