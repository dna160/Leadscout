import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { leadsRouter } from "./routes/leads";
import { keywordSetsRouter } from "./routes/keyword-sets";
import { citiesRouter } from "./routes/cities";
import { runsRouter } from "./routes/runs";
import { scrapeRouter } from "./routes/scrape";
import { logger } from "./lib/logger";
import { env } from "./lib/env";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: env.DASHBOARD_URL ? [env.DASHBOARD_URL] : "*",
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

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "LeadScout engine running");
});
