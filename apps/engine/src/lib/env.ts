import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  APIFY_API_KEY: z.string().optional(),
  APIFY_MOCK: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default("true"),
  PORT: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 4000))
    .default("4000"),
  DASHBOARD_URL: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
