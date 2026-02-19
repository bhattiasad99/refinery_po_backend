import express from "express";
import type { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { AppDataSource } from "./db/data-source";
import { Department } from "./entities/department.entity";
import { openApiSpec } from "./openapi";
import { createDepartmentSchema } from "./schemas/create-department.schema";
import { emitAfterWrite } from "./services/emit-after-write.service";

export const app = express();

app.use(express.json());

function checkResource(req: Request, res: Response, next: NextFunction) {
  if (
    req.path === "/health" ||
    req.path === "/healthz" ||
    req.path === "/openapi.json" ||
    req.path.startsWith("/docs")
  ) {
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
app.get("/openapi.json", (_req, res) => res.status(200).json(openApiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

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
    void emitAfterWrite("create_department", savedDepartment, req.originalUrl || "/").catch(
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
