import "reflect-metadata";
import express from "express";
import axios from "axios";
import { AppDataSource } from "./db/data-source";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/ping", async (_req, res) => {
  const r = await axios.get("https://example.com");
  res.json({ status: r.status });
});

const port = Number(process.env.PORT || 3000);

async function startServer() {
  await AppDataSource.initialize();
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
