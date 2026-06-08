import { Router } from "express";
import {
  getCronStatus,
  toggleKillSwitch,
  isKillSwitchActive,
} from "../services/cron.service";
import { listCronRuns } from "../repositories/cronRun.repository";

export const cronRouter = Router();

/**
 * GET /api/cron/status
 * Current CRON state — enabled, kill switch, schedules.
 */
cronRouter.get("/status", (_req, res) => {
  res.json(getCronStatus());
});

/**
 * POST /api/cron/toggle
 * Body: { killSwitch: boolean }
 * Activate or deactivate the global kill switch at runtime.
 */
cronRouter.post("/toggle", (req, res) => {
  const { killSwitch } = req.body as { killSwitch?: boolean };
  if (typeof killSwitch !== "boolean") {
    return void res.status(400).json({ error: "killSwitch boolean required" });
  }
  toggleKillSwitch(killSwitch);
  res.json({ killSwitch, status: getCronStatus() });
});

/**
 * GET /api/cron/runs
 * Recent CRON run history.
 */
cronRouter.get("/runs", async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "50");
  const r = await listCronRuns(limit);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ runs: r.value });
});
