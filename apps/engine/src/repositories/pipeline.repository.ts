import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";

export type DbError = { code: string; message: string };

export type PipelineRunStatus = "running" | "done" | "failed";

export interface PipelineRun {
  id: string;
  status: PipelineRunStatus;
  leads_total: number;
  leads_enriched: number;
  leads_classified: number;
  leads_generated: number;
  leads_failed: number;
  estimated_cost: number | null;
  actual_cost: number | null;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}

interface PipelineRunRow {
  id: string;
  status: string;
  leads_total: number;
  leads_enriched: number;
  leads_classified: number;
  leads_generated: number;
  leads_failed: number;
  estimated_cost: string | null;
  actual_cost: string | null;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}

function rowToRun(row: PipelineRunRow): PipelineRun {
  return {
    ...row,
    status: row.status as PipelineRunStatus,
    estimated_cost: row.estimated_cost != null ? parseFloat(row.estimated_cost) : null,
    actual_cost: row.actual_cost != null ? parseFloat(row.actual_cost) : null,
  };
}

export async function createPipelineRun(
  leadsTotal: number,
): Promise<Result<PipelineRun, DbError>> {
  try {
    const result = await pool.query<PipelineRunRow>(
      `INSERT INTO pipeline_runs (status, leads_total)
       VALUES ('running', $1) RETURNING *`,
      [leadsTotal],
    );
    return ok(rowToRun(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updatePipelineRun(
  id: string,
  updates: Partial<{
    status: PipelineRunStatus;
    leads_enriched: number;
    leads_classified: number;
    leads_generated: number;
    leads_failed: number;
    actual_cost: number;
    error: string;
    finished_at: Date;
  }>,
): Promise<Result<PipelineRun, DbError>> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(value instanceof Date ? value.toISOString() : value);
    }
  }

  if (sets.length === 0) {
    const r = await pool.query<PipelineRunRow>(`SELECT * FROM pipeline_runs WHERE id = $1`, [id]);
    if (!r.rows[0]) return err({ code: "NOT_FOUND", message: `PipelineRun ${id} not found` });
    return ok(rowToRun(r.rows[0]));
  }

  params.push(id);
  try {
    const result = await pool.query<PipelineRunRow>(
      `UPDATE pipeline_runs SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return ok(rowToRun(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getPipelineRuns(
  limit = 20,
): Promise<Result<PipelineRun[], DbError>> {
  try {
    const result = await pool.query<PipelineRunRow>(
      `SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return ok(result.rows.map(rowToRun));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getPipelineRun(
  id: string,
): Promise<Result<PipelineRun | null, DbError>> {
  try {
    const result = await pool.query<PipelineRunRow>(
      `SELECT * FROM pipeline_runs WHERE id = $1`,
      [id],
    );
    return ok(result.rows[0] ? rowToRun(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
