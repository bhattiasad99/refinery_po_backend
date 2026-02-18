import "reflect-metadata";
import { AppDataSource } from "./db/data-source";
import { app } from "./app";

const port = Number(process.env.PORT || 3000);

export const SERVICE_NAME = "purchase-orders";

async function startServer() {
  await AppDataSource.initialize();
  app.listen(port, () => console.log(`Service: ${SERVICE_NAME} - Listening on http://localhost:${port}`));
}

startServer().catch((error) => {
  console.error(`Service: ${SERVICE_NAME} - Failed to start server`, error);
  process.exit(1);
});
