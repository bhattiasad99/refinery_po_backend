import axios from "axios";
import type { RegisteredService } from "./service-registry";

export type DeliveryResponse = {
  statusCode: number;
};

export async function sendEventToService(
  service: RegisteredService,
  payload: Record<string, unknown>,
): Promise<DeliveryResponse> {
  const url = `${service.url.replace(/\/+$/, "")}/events`;

  const response = await axios.post(url, payload, {
    timeout: 10000,
    headers: buildHeaders(),
    validateStatus: () => true,
  });

  if (response.status >= 200 && response.status < 300) {
    return { statusCode: response.status };
  }

  throw new Error(`HTTP ${response.status}`);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }
  return headers;
}
