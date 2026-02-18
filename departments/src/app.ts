import express from "express";
import type { NextFunction, Request, Response } from "express";
import { AppDataSource } from "./db/data-source";
import { Department } from "./entities/department.entity";
import { createDepartmentSchema } from "./schemas/create-department.schema";

export const app = express();
const SERVICE_NAME = "departments";

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

app.get("/health", (_req, res) => res.json({ ok: true }));
app.post("/events", (req, res) => {
  return res.status(200).json({
    accepted: true,
    eventName: req.body?.name ?? null,
  });
});

app.get("/", async (_req: Request, res: Response) => {
  try {
    const repository = AppDataSource.getRepository(Department);
    const departments = await repository.find({
      order: {
        createdAt: "DESC",
      },
    });
    return res.status(200).json(departments);
  } catch (dbError) {
    console.error("Failed to fetch departments", dbError);
    return res.status(500).json({ message: "Failed to fetch departments" });
  }
});

async function emitCreateDepartmentEvent(
  department: Department,
  requestPath: string,
): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    console.warn(
      `Service: ${SERVICE_NAME} - SERVICE_EVENT_BUS_URL is not set; skipping create_department event`,
    );
    return;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }

  const eventPayload = {
    name: "create_department",
    body: {
      id: department.id,
      name: department.name,
      description: department.description,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    },
    source: SERVICE_NAME,
    url: requestPath,
  };

  const response = await fetch(`${eventBusUrl}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    throw new Error(
      `Event bus returned ${response.status} while emitting create_department`,
    );
  }
}

app.post("/", async (req: Request, res: Response) => {
  const { value, error } = createDepartmentSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      message: error.details.map((detail) => detail.message).join(", "),
    });
  }

  try {
    const repository = AppDataSource.getRepository(Department);
    const existingDepartment = await repository
      .createQueryBuilder("department")
      .where("LOWER(department.name) = LOWER(:name)", { name: value.name })
      .getOne();

    if (existingDepartment) {
      return res.status(409).json({ message: "Department name already exists" });
    }

    const department = repository.create({
      name: value.name,
      description: value.description,
    });
    const savedDepartment = await repository.save(department);
    void emitCreateDepartmentEvent(savedDepartment, req.originalUrl || "/").catch(
      (eventError) => {
        console.warn("Failed to emit create_department event", eventError);
      },
    );
    return res.status(201).json(savedDepartment);
  } catch (dbError) {
    console.error("Failed to create department", dbError);
    return res.status(500).json({ message: "Failed to create department" });
  }
});
