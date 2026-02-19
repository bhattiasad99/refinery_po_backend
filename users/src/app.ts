import express from "express";
import type { Request, Response } from "express";
import { checkResource } from "./middleware/check-resource";
import { parseCreateUserInput } from "./schemas/create-user.schema";
import { parseIncomingEvent } from "./schemas/incoming-event.schema";
import { processIncomingEvent } from "./services/events.service";
import { createUser } from "./services/user.service";

export const app = express();

app.use(express.json());

app.use(checkResource);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
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
