import "reflect-metadata";
import { AppDataSource } from "./db/data-source";
import { app } from "./app";

const port = Number(process.env.PORT || 3000);
const eventBusUrl = process.env.EVENT_BUS_URL?.trim();
const internalServiceKey = process.env.INTERNAL_SERVICE_KEY?.trim();

export const SERVICE_NAME = "catalog";

const SYNC_MAX_ATTEMPTS = 8;
const SYNC_RETRY_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncWithEventBus() {
  if (!eventBusUrl) {
    console.warn(`Service: ${SERVICE_NAME} - EVENT_BUS_URL is not set; skipping /sync call`);
    return;
  }

  const headers: Record<string, string> = {};
  if (internalServiceKey) {
    headers["x-internal-key"] = internalServiceKey;
  }

  for (let attempt = 1; attempt <= SYNC_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${eventBusUrl}/sync`, { method: "GET", headers });
      if (!response.ok) {
        console.warn(
          `Service: ${SERVICE_NAME} - /sync failed with status ${response.status}`,
        );
        return;
      }

      await response.json();
      console.log(`Service: ${SERVICE_NAME} - /sync completed`);
      return;
    } catch (error) {
      if (attempt === SYNC_MAX_ATTEMPTS) {
        console.warn(`Service: ${SERVICE_NAME} - Could not call /sync`, error);
        return;
      }

      await delay(SYNC_RETRY_DELAY_MS * attempt);
    }
  }
}

async function startServer() {
  await AppDataSource.initialize();
  app.listen(port, () => {
    console.log(`Service: ${SERVICE_NAME} - Listening on http://localhost:${port}`);
    void syncWithEventBus();
  });
}

startServer().catch((error) => {
  console.error(`Service: ${SERVICE_NAME} - Failed to start server`, error);
  process.exit(1);
});
