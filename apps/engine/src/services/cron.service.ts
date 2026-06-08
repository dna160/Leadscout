/**
 * CRON service — in-process node-cron scheduler with kill switch.
 *
 * Jobs:
 *   drip  — 09:00 WIB Mon–Sat: run drip batch (send queued emails)
 *   inbox — every 30 min:       poll IMAP for new replies
 *   reset — 00:01 daily:        reset inbox sent_today counters
 *
 * Kill switch: if CRON_KILL_SWITCH=true, all jobs are disabled regardless
 * of CRON_ENABLED. Can also be toggled at runtime via the /api/cron/toggle endpoint.
 */

import cron from "node-cron";
import { logger } from "../lib/logger";
import { env } from "../lib/env";
import { runDripBatch, resetDailyCounters } from "./send.service";
import { pollReplies } from "./inbox.service";
import { startCronRun, finishCronRun, killStalledRuns } from "../repositories/cronRun.repository";

let _killSwitch = env.CRON_KILL_SWITCH;
let _tasks: ReturnType<typeof cron.schedule>[] = [];
let _started = false;

export function isKillSwitchActive(): boolean {
  return _killSwitch;
}

export function toggleKillSwitch(value: boolean): void {
  _killSwitch = value;
  logger.info(`[cron] Kill switch ${value ? "ACTIVATED" : "deactivated"}`);
}

function guard(jobName: string, fn: () => Promise<void>): () => void {
  return async () => {
    if (_killSwitch) {
      logger.info(`[cron:${jobName}] Kill switch active — skipping`);
      return;
    }
    logger.info(`[cron:${jobName}] Starting`);
    const runRes = await startCronRun(jobName as "scrape" | "drip");
    const runId = runRes.ok ? runRes.value.id : null;

    try {
      await fn();
      if (runId) await finishCronRun(runId, "done");
      logger.info(`[cron:${jobName}] Done`);
    } catch (e) {
      const msg = (e as Error).message;
      logger.error(`[cron:${jobName}] Error: ${msg}`);
      if (runId) await finishCronRun(runId, "failed", {}, msg);
    }
  };
}

/** drip: Mon–Sat 09:00 Jakarta time (UTC+7 = 02:00 UTC) */
const DRIP_SCHEDULE = "0 2 * * 1-6";

/** inbox poll: every 30 minutes */
const INBOX_SCHEDULE = "*/30 * * * *";

/** reset: daily at 00:01 */
const RESET_SCHEDULE = "1 0 * * *";

export async function startCron(): Promise<void> {
  if (!env.CRON_ENABLED) {
    logger.info("[cron] CRON_ENABLED=false — scheduler not started");
    return;
  }
  if (_started) {
    logger.warn("[cron] Already started");
    return;
  }

  // Kill any stalled runs from a previous process
  await killStalledRuns();

  const dripTask = cron.schedule(
    DRIP_SCHEDULE,
    guard("drip", async () => {
      const res = await runDripBatch();
      if (res.ok) {
        logger.info(`[cron:drip] sent=${res.value.sent} failed=${res.value.failed} suppressed=${res.value.suppressed}`);
      } else {
        logger.error(`[cron:drip] ${res.error.message}`);
      }
    }),
    { timezone: "Asia/Jakarta" },
  );

  const inboxTask = cron.schedule(
    INBOX_SCHEDULE,
    guard("drip", async () => {
      if (!env.IMAP_HOST) return;
      const res = await pollReplies();
      if (res.ok) {
        logger.info(`[cron:inbox] fetched=${res.value.fetched} new=${res.value.new}`);
      } else {
        logger.warn(`[cron:inbox] ${res.error.message}`);
      }
    }),
  );

  const resetTask = cron.schedule(
    RESET_SCHEDULE,
    guard("drip", async () => {
      await resetDailyCounters();
      logger.info("[cron:reset] Daily counters reset");
    }),
  );

  _tasks = [dripTask, inboxTask, resetTask];
  _started = true;
  logger.info("[cron] Scheduler started — drip=09:00 WIB Mon-Sat, inbox=*/30min, reset=00:01 daily");
}

export function stopCron(): void {
  for (const task of _tasks) task.stop();
  _tasks = [];
  _started = false;
  logger.info("[cron] Scheduler stopped");
}

export function getCronStatus(): {
  enabled: boolean;
  killSwitch: boolean;
  running: boolean;
  schedules: { drip: string; inbox: string; reset: string };
} {
  return {
    enabled: env.CRON_ENABLED,
    killSwitch: _killSwitch,
    running: _started,
    schedules: { drip: DRIP_SCHEDULE, inbox: INBOX_SCHEDULE, reset: RESET_SCHEDULE },
  };
}
