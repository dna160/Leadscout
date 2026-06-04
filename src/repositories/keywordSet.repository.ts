import { pool } from "@/infra/db/client";
import { ok, err, type Result } from "@/lib/result";
import type { Segment } from "@/domain/lead";

export interface KeywordSet {
  id: string;
  segment: Segment;
  label: string;
  keywords: string[];
  enabled: boolean;
  created_at: Date;
}

interface KeywordSetRow {
  id: string;
  segment: string;
  label: string;
  keywords: string[];
  enabled: boolean;
  created_at: Date;
}

export type DbError = { code: string; message: string };

function rowToKeywordSet(row: KeywordSetRow): KeywordSet {
  return {
    ...row,
    segment: row.segment as Segment,
    keywords: Array.isArray(row.keywords) ? row.keywords : JSON.parse(row.keywords as unknown as string),
  };
}

export async function listKeywordSets(): Promise<Result<KeywordSet[], DbError>> {
  try {
    const result = await pool.query<KeywordSetRow>(
      "SELECT * FROM keyword_sets ORDER BY segment, label",
    );
    return ok(result.rows.map(rowToKeywordSet));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getKeywordSetById(id: string): Promise<Result<KeywordSet | null, DbError>> {
  try {
    const result = await pool.query<KeywordSetRow>(
      "SELECT * FROM keyword_sets WHERE id = $1",
      [id],
    );
    return ok(result.rows[0] ? rowToKeywordSet(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function createKeywordSet(
  data: Pick<KeywordSet, "segment" | "label" | "keywords">,
): Promise<Result<KeywordSet, DbError>> {
  try {
    const result = await pool.query<KeywordSetRow>(
      `INSERT INTO keyword_sets (segment, label, keywords)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.segment, data.label, JSON.stringify(data.keywords)],
    );
    return ok(rowToKeywordSet(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateKeywordSet(
  id: string,
  data: Partial<Pick<KeywordSet, "label" | "keywords" | "enabled">>,
): Promise<Result<KeywordSet | null, DbError>> {
  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.label !== undefined) { sets.push(`label = $${idx++}`); params.push(data.label); }
    if (data.keywords !== undefined) { sets.push(`keywords = $${idx++}`); params.push(JSON.stringify(data.keywords)); }
    if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled); }

    if (!sets.length) return ok(null);

    params.push(id);
    const result = await pool.query<KeywordSetRow>(
      `UPDATE keyword_sets SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return ok(result.rows[0] ? rowToKeywordSet(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function deleteKeywordSet(id: string): Promise<Result<boolean, DbError>> {
  try {
    const result = await pool.query(
      "DELETE FROM keyword_sets WHERE id = $1",
      [id],
    );
    return ok((result.rowCount ?? 0) > 0);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function listEnabledKeywordSets(): Promise<Result<KeywordSet[], DbError>> {
  try {
    const result = await pool.query<KeywordSetRow>(
      "SELECT * FROM keyword_sets WHERE enabled = true ORDER BY segment",
    );
    return ok(result.rows.map(rowToKeywordSet));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
