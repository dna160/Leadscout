import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { Reply } from "../domain/pipeline";

type AppError = { message: string };

function row(r: any): Reply {
  return {
    id: r.id, lead_id: r.lead_id, message_id: r.message_id,
    in_reply_to: r.in_reply_to, from_addr: r.from_addr,
    subject: r.subject, body: r.body, received_at: r.received_at, created_at: r.created_at,
  };
}

export async function upsertReply(data: {
  lead_id?: string; message_id: string; in_reply_to?: string;
  from_addr?: string; subject?: string; body?: string; received_at?: Date;
}): Promise<Result<Reply, AppError>> {
  try {
    const r = await pool.query(
      `INSERT INTO replies (lead_id, message_id, in_reply_to, from_addr, subject, body, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        data.lead_id ?? null, data.message_id, data.in_reply_to ?? null,
        data.from_addr ?? null, data.subject ?? null, data.body ?? null,
        data.received_at ?? null,
      ],
    );
    // If ON CONFLICT fired (duplicate), fetch existing by message_id
    if (!r.rows[0]) {
      const existing = await pool.query(
        `SELECT * FROM replies WHERE message_id=$1`, [data.message_id],
      );
      return ok(row(existing.rows[0]));
    }
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function listReplies(limit = 100, offset = 0): Promise<Result<Reply[], AppError>> {
  try {
    const r = await pool.query(
      `SELECT rp.*, l.name as lead_name, l.email as lead_email
       FROM replies rp
       LEFT JOIN leads l ON l.id = rp.lead_id
       ORDER BY rp.received_at DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function getLeadReplies(leadId: string): Promise<Result<Reply[], AppError>> {
  try {
    const r = await pool.query(
      `SELECT * FROM replies WHERE lead_id=$1 ORDER BY received_at ASC`, [leadId],
    );
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function existsByMessageId(messageId: string): Promise<Result<boolean, AppError>> {
  try {
    const r = await pool.query(
      `SELECT 1 FROM replies WHERE message_id=$1`, [messageId],
    );
    return ok((r.rowCount ?? 0) > 0);
  } catch (e) { return err({ message: (e as Error).message }); }
}
