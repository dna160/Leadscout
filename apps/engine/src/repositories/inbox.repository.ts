import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { SendingInbox } from "../domain/pipeline";

type AppError = { message: string };

function row(r: any): SendingInbox {
  return {
    id: r.id, domain: r.domain, address: r.address, display_name: r.display_name,
    daily_cap: r.daily_cap, warmup_stage: r.warmup_stage, warmup_ramp: r.warmup_ramp,
    sent_today: r.sent_today, status: r.status, bounce_rate: parseFloat(r.bounce_rate),
    complaint_rate: parseFloat(r.complaint_rate), last_reset_at: r.last_reset_at,
    created_at: r.created_at,
  };
}

export async function listInboxes(): Promise<Result<SendingInbox[], AppError>> {
  try {
    const r = await pool.query(`SELECT * FROM sending_inboxes ORDER BY created_at ASC`);
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function getInbox(id: string): Promise<Result<SendingInbox | null, AppError>> {
  try {
    const r = await pool.query(`SELECT * FROM sending_inboxes WHERE id=$1`, [id]);
    return ok(r.rows[0] ? row(r.rows[0]) : null);
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function upsertInbox(data: {
  address: string; domain: string; display_name?: string; daily_cap?: number; warmup_ramp?: string;
}): Promise<Result<SendingInbox, AppError>> {
  try {
    const r = await pool.query(
      `INSERT INTO sending_inboxes (address, domain, display_name, daily_cap, warmup_ramp)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (address) DO UPDATE
         SET domain=EXCLUDED.domain,
             display_name=COALESCE(EXCLUDED.display_name, sending_inboxes.display_name),
             daily_cap=EXCLUDED.daily_cap,
             warmup_ramp=EXCLUDED.warmup_ramp
       RETURNING *`,
      [
        data.address, data.domain, data.display_name ?? null,
        data.daily_cap ?? 10, data.warmup_ramp ?? "5,7,9,10",
      ],
    );
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

/** Increment sent_today counter atomically; returns updated inbox */
export async function incrementSentToday(id: string): Promise<Result<SendingInbox, AppError>> {
  try {
    const r = await pool.query(
      `UPDATE sending_inboxes SET sent_today=sent_today+1 WHERE id=$1 RETURNING *`,
      [id],
    );
    if (!r.rows[0]) return err({ message: `Inbox ${id} not found` });
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

/** Reset daily counter (called by cron at midnight) */
export async function resetDailyCounters(): Promise<Result<void, AppError>> {
  try {
    await pool.query(
      `UPDATE sending_inboxes SET sent_today=0, last_reset_at=NOW()
       WHERE status IN ('warming','active')`,
    );
    return ok(undefined);
  } catch (e) { return err({ message: (e as Error).message }); }
}

/** Advance warmup_stage for all warming inboxes that hit their ramp cap today */
export async function advanceWarmupStages(): Promise<Result<void, AppError>> {
  try {
    // Simple: increment stage for warming inboxes (called once/day by cron)
    await pool.query(
      `UPDATE sending_inboxes
       SET warmup_stage = warmup_stage + 1,
           status = CASE
             WHEN warmup_stage + 1 >= array_length(string_to_array(warmup_ramp,','),1) THEN 'active'
             ELSE status
           END
       WHERE status='warming'`,
    );
    return ok(undefined);
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function updateInboxRates(
  id: string,
  bounceRate: number,
  complaintRate: number,
): Promise<Result<void, AppError>> {
  try {
    await pool.query(
      `UPDATE sending_inboxes SET bounce_rate=$2, complaint_rate=$3 WHERE id=$1`,
      [id, bounceRate, complaintRate],
    );
    return ok(undefined);
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function pauseInbox(id: string): Promise<Result<void, AppError>> {
  try {
    await pool.query(`UPDATE sending_inboxes SET status='paused' WHERE id=$1`, [id]);
    return ok(undefined);
  } catch (e) { return err({ message: (e as Error).message }); }
}
