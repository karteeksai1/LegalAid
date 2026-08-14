import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", aiService: config.FASTAPI_BASE_URL });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(config.GATEWAY_PORT, () => {
    console.log(`gateway listening on ${config.GATEWAY_PORT}`);
  });
}

