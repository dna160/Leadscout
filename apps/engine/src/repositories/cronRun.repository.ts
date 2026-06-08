import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { CronRun } from "../domain/pipeline";

type AppError = { message: string };

function row(r: any): CronRun {
  return {
    id: r.id, job: r.job, status: r.status,
    counts: typeof r.counts === "string" ? JSON.parse(r.counts) : r.counts ?? {},
    started_at: r.started_at, finished_at: r.finished_at, error: r.error,
  };
}

export async function startCronRun(job: "scrape" | "drip"): Promise<Result<CronRun, AppError>> {
  try {
    const r = await pool.query(
      `INSERT INTO cron_runs (job) VALUES ($1) RETURNING *`, [job],
    );
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function finishCronRun(
  id: string,
  status: "done" | "failed" | "killed",
  counts: Record<string, number> = {},
  error?: string,
): Promise<Result<CronRun, AppError>> {
  try {
    const r = await pool.query(
      `UPDATE cron_runs
       SET status=$2, counts=$3::jsonb, finished_at=NOW(), error=$4
       WHERE id=$1 RETURNING *`,
      [id, status, JSON.stringify(counts), error ?? null],
    );
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function listCronRuns(limit = 50): Promise<Result<CronRun[], AppError>> {
  try {
    const r = await pool.query(
      `SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT $1`, [limit],
    );
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function getRunningJob(job: "scrape" | "drip"): Promise<Result<CronRun | null, AppError>> {
  try {
    const r = await pool.query(
      `SELECT * FROM cron_runs WHERE job=$1 AND status='running' ORDER BY started_at DESC LIMIT 1`,
      [job],
    );
    return ok(r.rows[0] ? row(r.rows[0]) : null);
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function killStalledRuns(): Promise<Result<number, AppError>> {
  try {
    // Mark as killed any run that's been 'running' for >2 hours (stale after restart)
    const r = await pool.query(
      `UPDATE cron_runs SET status='killed', finished_at=NOW(), error='stalled — killed on boot'
       WHERE status='running' AND started_at < NOW() - INTERVAL '2 hours'
       RETURNING id`,
    );
    return ok(r.rowCount ?? 0);
  } catch (e) { return err({ message: (e as Error).message }); }
}
