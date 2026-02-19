import express from "express";
import type { Request, Response } from "express";
import { checkResource } from "./middleware/check-resource";
import { parseCreateUserInput } from "./schemas/create-user.schema";
import { parseGetUserQuery } from "./schemas/get-user.schema";
import { parseIncomingEvent } from "./schemas/incoming-event.schema";
import { parseVerifyCredentialsInput } from "./schemas/verify-credentials.schema";
import { backfillProvider } from "./services/backfill.provider";
import {
  createRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
} from "./services/auth-session.service";
import { processIncomingEvent } from "./services/events.service";
import { createUser, getUserByIdOrEmail, listUsers, verifyCredentials } from "./services/user.service";

export const app = express();

app.use(express.json());

app.use(checkResource);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/", async (req: Request, res: Response) => {
  const hasLookupQuery = "id" in req.query || "email" in req.query;

  try {
    if (hasLookupQuery) {
      const parsedQuery = parseGetUserQuery(req.query);
      if (!parsedQuery.ok) {
        return res.status(400).json({ message: parsedQuery.message });
      }

      const result = await getUserByIdOrEmail(parsedQuery.value);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }

      return res.status(200).json(result.value);
    }

    const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await listUsers({
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json(result.value);
  } catch (error) {
    console.error("Failed to fetch users", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

app.get("/single-user", async (req: Request, res: Response) => {
  const parsedQuery = parseGetUserQuery(req.query);
  if (!parsedQuery.ok) {
    return res.status(400).json({ message: parsedQuery.message });
  }

  try {
    const result = await getUserByIdOrEmail(parsedQuery.value);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json(result.value);
  } catch (error) {
    console.error("Failed to get user", error);
    return res.status(500).json({ message: "Failed to get user" });
  }
});

app.post("/events", async (req: Request, res: Response) => {
  const parsedEvent = parseIncomingEvent(req.body);
  if (!parsedEvent.ok) {
    return res.status(400).json({ message: parsedEvent.message });
  }

  try {
    await processIncomingEvent(parsedEvent.value);
  } catch (error) {
    console.error("Failed to process incoming event", error);
    return res.status(500).json({ message: "Failed to process event" });
  }

  return res.status(200).json({
    accepted: true,
    eventName: parsedEvent.value.name,
  });
});

app.post("/", async (req: Request, res: Response) => {
  const parsedInput = parseCreateUserInput(req.body);
  if (!parsedInput.ok) {
    return res.status(400).json({ message: parsedInput.message });
  }

  try {
    const result = await createUser(parsedInput.value);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json({
      id: result.value.id,
      email: result.value.email,
      departmentId: result.value.departmentId,
      createdBy: result.value.createdBy,
      createdAt: result.value.createdAt,
      updatedAt: result.value.updatedAt,
    });
  } catch (error) {
    console.error("Failed to create user", error);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

async function handleVerifyCredentials(req: Request, res: Response) {
  const parsedInput = parseVerifyCredentialsInput(req.body);
  if (!parsedInput.ok) {
    return res.status(400).json({ message: parsedInput.message });
  }

  try {
    const result = await verifyCredentials(parsedInput.value);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json({
      authenticated: true,
      user: result.value,
    });
  } catch (error) {
    console.error("Failed to verify credentials", error);
    return res.status(500).json({ message: "Failed to verify credentials" });
  }
}

app.post("/verify-credentials", handleVerifyCredentials);

function parseSessionDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

app.post("/auth/sessions", async (req: Request, res: Response) => {
  const input = req.body as Record<string, unknown>;
  const userId = typeof input?.userId === "string" ? input.userId.trim() : "";
  const tokenHash = typeof input?.tokenHash === "string" ? input.tokenHash.trim() : "";
  const expiresAt = parseSessionDate(input?.expiresAt);

  if (!userId || !tokenHash || !expiresAt) {
    return res.status(400).json({ message: "userId, tokenHash, and expiresAt are required" });
  }

  try {
    const result = await createRefreshSession({
      userId,
      tokenHash,
      expiresAt,
    });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.status(201).json(result.value);
  } catch (error) {
    console.error("Failed to create refresh session", error);
    return res.status(500).json({ message: "Failed to create refresh session" });
  }
});

app.post("/auth/sessions/rotate", async (req: Request, res: Response) => {
  const input = req.body as Record<string, unknown>;
  const tokenHash = typeof input?.tokenHash === "string" ? input.tokenHash.trim() : "";
  const newTokenHash =
    typeof input?.newTokenHash === "string" ? input.newTokenHash.trim() : "";
  const expiresAt = parseSessionDate(input?.expiresAt);

  if (!tokenHash || !newTokenHash || !expiresAt) {
    return res.status(400).json({
      message: "tokenHash, newTokenHash, and expiresAt are required",
    });
  }

  try {
    const result = await rotateRefreshSession({
      tokenHash,
      newTokenHash,
      expiresAt,
    });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.status(200).json(result.value);
  } catch (error) {
    console.error("Failed to rotate refresh session", error);
    return res.status(500).json({ message: "Failed to rotate refresh session" });
  }
});

app.post("/auth/sessions/revoke", async (req: Request, res: Response) => {
  const input = req.body as Record<string, unknown>;
  const tokenHash = typeof input?.tokenHash === "string" ? input.tokenHash.trim() : "";

  if (!tokenHash) {
    return res.status(400).json({ message: "tokenHash is required" });
  }

  try {
    const result = await revokeRefreshSession({ tokenHash });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    return res.status(200).json(result.value);
  } catch (error) {
    console.error("Failed to revoke refresh session", error);
    return res.status(500).json({ message: "Failed to revoke refresh session" });
  }
});

app.post("/back-fill/create_users", async (_req: Request, res: Response) => {
  try {
    const serviceUsersUrl = process.env.SERVICE_USERS_URL?.trim() ?? "http://users:3000";
    const eventUrl = `${serviceUsersUrl.replace(/\/+$/, "")}/back-fill/create_users`;

    await backfillProvider.ensureTrackingTable({
      tableName: "published_users",
      idColumn: "user_id",
      idType: "uuid",
    });

    const summary = await backfillProvider.backfill<{
      id: string;
      email: string;
      department_id: string;
      created_at: string | Date;
    }>({
      sourceTable: "users",
      sourceIdColumn: "id",
      sourceColumns: ["id", "email", "department_id", "created_at"],
      trackingTable: "published_users",
      trackingIdColumn: "user_id",
      eventType: "user_created",
      eventSource: "users",
      eventUrl,
      mapRowToPayload: (row) => ({
        userId: row.id,
        email: row.email,
        departmentId: row.department_id,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      }),
      batchSize: 500,
    });

    return res.status(200).json(summary);
  } catch (error) {
    console.error("Backfill create_users failed", error);
    return res.status(500).json({ message: "Backfill failed" });
  }
});
