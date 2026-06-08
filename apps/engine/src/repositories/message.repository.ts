import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { OutreachMessage, MessageStatus, OutreachChannel, MessageVariant } from "../domain/pipeline";

type AppError = { message: string };

function row(r: any): OutreachMessage {
  return {
    id: r.id, lead_id: r.lead_id, channel: r.channel,
    variant: r.variant, inbox_id: r.inbox_id,
    subject: r.subject, body: r.body, status: r.status,
    sent_at: r.sent_at, error: r.error, created_at: r.created_at,
  };
}

export async function createMessage(data: {
  lead_id: string; channel: OutreachChannel; variant?: MessageVariant;
  subject?: string; body?: string;
}): Promise<Result<OutreachMessage, AppError>> {
  try {
    const r = await pool.query(
      `INSERT INTO outreach_messages (lead_id, channel, variant, subject, body)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.lead_id, data.channel, data.variant ?? null, data.subject ?? null, data.body ?? null],
    );
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function getQueuedMessages(limit = 50): Promise<Result<OutreachMessage[], AppError>> {
  try {
    const r = await pool.query(
      `SELECT * FROM outreach_messages WHERE status = 'queued' ORDER BY created_at ASC LIMIT $1`,
      [limit],
    );
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function getLeadMessages(leadId: string): Promise<Result<OutreachMessage[], AppError>> {
  try {
    const r = await pool.query(
      `SELECT * FROM outreach_messages WHERE lead_id = $1 ORDER BY created_at DESC`,
      [leadId],
    );
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function updateMessageStatus(
  id: string,
  status: MessageStatus,
  extra: { inbox_id?: string; sent_at?: Date; error?: string } = {},
): Promise<Result<OutreachMessage, AppError>> {
  try {
    const r = await pool.query(
      `UPDATE outreach_messages
       SET status=$2, inbox_id=COALESCE($3,inbox_id), sent_at=COALESCE($4,sent_at), error=$5
       WHERE id=$1 RETURNING *`,
      [id, status, extra.inbox_id ?? null, extra.sent_at ?? null, extra.error ?? null],
    );
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function getMessageStats(): Promise<Result<Record<string, number>, AppError>> {
  try {
    const r = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM outreach_messages GROUP BY status`,
    );
    const stats: Record<string, number> = {};
    for (const row of r.rows) stats[row.status] = row.n;
    return ok(stats);
  } catch (e) { return err({ message: (e as Error).message }); }
}
