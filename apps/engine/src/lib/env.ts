import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  APIFY_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  APIFY_MOCK: z.string().optional().transform((v) => v === "true").default("true"),
  PORT: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 4000)).default("4000"),
  DASHBOARD_URL: z.string().optional(),

  // ── Phase 3: SMTP (warmed sending domain, NOT the business domain) ──────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 587)).default("587"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SEND_DOMAIN: z.string().optional(),
  SEND_FROM_NAME_A: z.string().optional().default("Johannes — A5 Wagyu Indonesia"),
  SEND_FROM_NAME_B: z.string().optional().default("IBUKI A5 Wagyu"),
  SEND_PER_HOUR: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 5)).default("5"),
  SEND_PER_INBOX_DAILY_CAP: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 10)).default("10"),
  WARMUP_RAMP: z.string().optional().default("5,7,9,10"),
  OPEN_TRACKING: z.string().optional().transform((v) => v === "true").default("false"),

  // ── Phase 3: IMAP (Hostinger, receive-only reply inbox) ─────────────────────
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 993)).default("993"),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),

  // ── Phase 3: CRON ────────────────────────────────────────────────────────────
  CRON_ENABLED: z.string().optional().transform((v) => v === "true").default("false"),
  CRON_KILL_SWITCH: z.string().optional().transform((v) => v === "true").default("false"),
  CRON_DAILY_NEW_LEADS: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)).default("20"),
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
