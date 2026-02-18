import express from "express";
import type { NextFunction, Request, Response } from "express";

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

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
