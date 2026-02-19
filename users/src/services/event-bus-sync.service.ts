import { parseDepartmentProjectionInput, upsertDepartmentProjection } from "./department-projection.service";

type EventBusEvent = {
  name: string;
  source: string;
  data: Record<string, unknown>;
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }
  return headers;
}

export async function syncDepartmentsProjectionFromEventBus(): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    return;
  }

  const query = new URLSearchParams({
    name: "create_department",
    source: "departments",
    order: "ASC",
    limit: "500",
  });

  const response = await fetch(`${eventBusUrl}/events?${query.toString()}`, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(`event bus returned ${response.status} while syncing departments`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("event bus returned invalid events payload");
  }

  for (const rawEvent of payload) {
    if (!rawEvent || typeof rawEvent !== "object") {
      continue;
    }

    const event = rawEvent as Partial<EventBusEvent>;
    if (event.name !== "create_department" || event.source !== "departments") {
      continue;
    }

    const body = event.data;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      continue;
    }

    const projection = parseDepartmentProjectionInput(body as Record<string, unknown>);
    if (!projection) {
      continue;
    }

    await upsertDepartmentProjection(projection);
  }
}
