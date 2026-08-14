import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../../.env") });
loadEnv();

const configSchema = z.object({
  FASTAPI_BASE_URL: z.string().url().default("http://localhost:8000"),
  GATEWAY_DATABASE_URL: z.string().min(1),
  GATEWAY_PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(16)
});

export const config = configSchema.parse(process.env);
