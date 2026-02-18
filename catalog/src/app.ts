import express from "express";
import axios from "axios";

export const app = express();

app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ ok: true }));
