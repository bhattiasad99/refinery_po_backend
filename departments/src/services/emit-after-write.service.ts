const SERVICE_NAME = "departments";
const EXCLUDED_EVENT_FIELDS = new Set(["password", "passwordHash"]);

function sanitizeEventBody(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeEventBody(entry));
  }

  if (value instanceof Date || value === null || typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(input)) {
    if (EXCLUDED_EVENT_FIELDS.has(key)) {
      continue;
    }
    output[key] = sanitizeEventBody(nested);
  }
  return output;
}

export async function emitAfterWrite(name: string, body: unknown, url: string): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    throw new Error("SERVICE_EVENT_BUS_URL is not set");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }

  const response = await fetch(`${eventBusUrl}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      body: sanitizeEventBody(body),
      source: SERVICE_NAME,
      url,
    }),
  });

  if (!response.ok) {
    throw new Error(`Event bus returned ${response.status} while emitting ${name}`);
  }
}
