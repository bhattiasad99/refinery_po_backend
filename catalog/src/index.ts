import "reflect-metadata";
import { AppDataSource } from "./db/data-source";
import { app } from "./app";

const port = Number(process.env.PORT || 3000);

async function startServer() {
  await AppDataSource.initialize();
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
