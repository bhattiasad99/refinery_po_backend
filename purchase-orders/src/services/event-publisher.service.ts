type EventPayload = unknown;

function buildServiceUrl(path: string): string {
  const explicitUrl = process.env.SERVICE_PURCHASE_ORDERS_URL?.trim();
  if (explicitUrl) {
    return `${explicitUrl.replace(/\/+$/, "")}${path}`;
  }

  const port = process.env.PURCHASE_ORDERS_PORT?.trim() || "3000";
  return `http://purchase-orders:${port}${path}`;
}

export async function publishEvent(
  name: string,
  payload: EventPayload,
  urlPath: string,
): Promise<void> {
  const eventBusUrl = process.env.SERVICE_EVENT_BUS_URL?.trim();
  if (!eventBusUrl) {
    throw new Error("SERVICE_EVENT_BUS_URL is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
      body: payload,
      source: "purchase-orders",
      url: buildServiceUrl(urlPath),
    }),
  });

  if (!response.ok) {
    throw new Error(`Event bus responded with status ${response.status}`);
  }
}
