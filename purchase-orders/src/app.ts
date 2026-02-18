import express from "express";
import axios from "axios";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/ping", async (_req, res) => {
  const response = await axios.get("https://example.com");
  res.json({ status: response.status });
});
