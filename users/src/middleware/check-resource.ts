import type { NextFunction, Request, Response } from "express";

export function checkResource(req: Request, res: Response, next: NextFunction) {
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
