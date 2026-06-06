import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";

export type RunStatus = "running" | "completed" | "failed";
export type RunMode = "mock" | "live";

export interface ScrapeRun {
  id: string;
  status: RunStatus;
  mode: RunMode;
  apify_run_id: string | null;
  queries: string[] | null;
  cities: string[] | null;
  places_found: number;
  new_leads: number;
  estimated_cost: number | null;
  actual_cost: number | null;
  enrichment: boolean;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
}

export type DbError = { code: string; message: string };

export async function createRun(
  data: Pick<ScrapeRun, "mode" | "queries" | "cities"> &
    Partial<Pick<ScrapeRun, "estimated_cost" | "enrichment">>,
): Promise<Result<ScrapeRun, DbError>> {
  try {
    const result = await pool.query<ScrapeRun>(
      `INSERT INTO scrape_runs (status, mode, queries, cities, estimated_cost, enrichment)
       VALUES ('running', $1, $2, $3, $4, $5) RETURNING *`,
      [
        data.mode,
        JSON.stringify(data.queries),
        JSON.stringify(data.cities),
        data.estimated_cost ?? null,
        data.enrichment ?? false,
      ],
    );
    return ok(result.rows[0]);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateRun(
  id: string,
  data: Partial<
    Pick<
      ScrapeRun,
      "status" | "apify_run_id" | "places_found" | "new_leads" | "actual_cost" | "error" | "finished_at"
    >
  >,
): Promise<Result<ScrapeRun | null, DbError>> {
  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
    if (data.apify_run_id !== undefined) { sets.push(`apify_run_id = $${idx++}`); params.push(data.apify_run_id); }
    if (data.places_found !== undefined) { sets.push(`places_found = $${idx++}`); params.push(data.places_found); }
    if (data.new_leads !== undefined) { sets.push(`new_leads = $${idx++}`); params.push(data.new_leads); }
    if (data.actual_cost !== undefined) { sets.push(`actual_cost = $${idx++}`); params.push(data.actual_cost); }
    if (data.error !== undefined) { sets.push(`error = $${idx++}`); params.push(data.error); }
    if (data.finished_at !== undefined) { sets.push(`finished_at = $${idx++}`); params.push(data.finished_at); }

    if (!sets.length) return ok(null);

    params.push(id);
    const result = await pool.query<ScrapeRun>(
      `UPDATE scrape_runs SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return ok(result.rows[0] ?? null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function listRuns(limit = 20): Promise<Result<ScrapeRun[], DbError>> {
  try {
    const result = await pool.query<ScrapeRun>(
      "SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT $1",
      [limit],
    );
    return ok(result.rows);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getRunById(id: string): Promise<Result<ScrapeRun | null, DbError>> {
  try {
    const result = await pool.query<ScrapeRun>(
      "SELECT * FROM scrape_runs WHERE id = $1",
      [id],
    );
    return ok(result.rows[0] ?? null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
