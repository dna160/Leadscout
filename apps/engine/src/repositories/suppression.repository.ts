import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { Suppression, SuppressionReason, SuppressionType } from "../domain/suppression";

type AppError = { message: string };

function row(r: any): Suppression {
  return { id: r.id, value: r.value, type: r.type, reason: r.reason, created_at: r.created_at };
}

export async function isSuppressed(value: string): Promise<Result<boolean, AppError>> {
  try {
    const r = await pool.query(`SELECT 1 FROM suppressions WHERE LOWER(value)=LOWER($1)`, [value]);
    return ok(r.rowCount! > 0);
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function addSuppression(data: {
  value: string; type?: SuppressionType; reason: SuppressionReason;
}): Promise<Result<Suppression, AppError>> {
  try {
    const r = await pool.query(
      `INSERT INTO suppressions (value, type, reason)
       VALUES ($1,$2,$3)
       ON CONFLICT (value) DO UPDATE SET reason=EXCLUDED.reason
       RETURNING *`,
      [data.value.toLowerCase(), data.type ?? "email", data.reason],
    );
    return ok(row(r.rows[0]));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function listSuppressions(limit = 200, offset = 0): Promise<Result<Suppression[], AppError>> {
  try {
    const r = await pool.query(
      `SELECT * FROM suppressions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return ok(r.rows.map(row));
  } catch (e) { return err({ message: (e as Error).message }); }
}

export async function removeSuppression(id: string): Promise<Result<void, AppError>> {
  try {
    await pool.query(`DELETE FROM suppressions WHERE id=$1`, [id]);
    return ok(undefined);
  } catch (e) { return err({ message: (e as Error).message }); }
}
