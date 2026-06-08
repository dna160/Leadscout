import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { leadsRouter } from "./routes/leads";
import { keywordSetsRouter } from "./routes/keyword-sets";
import { citiesRouter } from "./routes/cities";
import { runsRouter } from "./routes/runs";
import { scrapeRouter } from "./routes/scrape";
import { filterRulesRouter } from "./routes/filter-rules";
import { pipelineRouter } from "./routes/pipeline";
import { logger } from "./lib/logger";
import { env } from "./lib/env";
import { pool } from "./infra/db/client";
import { runMigrations } from "./infra/db/migrate";

async function main() {
  // ── Auto-migrate on every boot (idempotent CREATE IF NOT EXISTS) ──
  logger.info("Running database migrations...");
  await runMigrations(env.DATABASE_URL);
  logger.info("Migrations complete.");

  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: env.DASHBOARD_URL ? [env.DASHBOARD_URL.replace(/\/$/, "")] : "*",
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }),
  );
  app.use(compression() as express.RequestHandler);
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, service: "engine" }));

  app.use("/api/leads", leadsRouter);
  app.use("/api/keyword-sets", keywordSetsRouter);
  app.use("/api/cities", citiesRouter);
  app.use("/api/runs", runsRouter);
  app.use("/api/scrape", scrapeRouter);
  app.use("/api/filter-rules", filterRulesRouter);
  app.use("/api/pipeline", pipelineRouter);

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "LeadScout engine running");
  });

  function shutdown(signal: string) {
    logger.info({ signal }, "Shutdown signal received — closing gracefully");
    server.close(() => {
      logger.info("HTTP server closed");
      pool
        .end()
        .then(() => {
          logger.info("DB pool closed");
          process.exit(0);
        })
        .catch(() => process.exit(0));
    });

    setTimeout(() => {
      logger.warn("Graceful shutdown timed out — forcing exit");
      process.exit(0);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
