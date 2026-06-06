import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { FilterRule, FilterRuleType } from "../domain/filtering";

export type DbError = { code: string; message: string };

interface FilterRuleRow {
  id: string;
  type: string;
  value: string;
  action: string;
  enabled: boolean;
  created_at: Date;
}

function rowToFilterRule(row: FilterRuleRow): FilterRule {
  return { ...row, type: row.type as FilterRuleType };
}

export async function listFilterRules(): Promise<Result<FilterRule[], DbError>> {
  try {
    const result = await pool.query<FilterRuleRow>(
      "SELECT * FROM filter_rules ORDER BY type, value",
    );
    return ok(result.rows.map(rowToFilterRule));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function listEnabledFilterRules(): Promise<Result<FilterRule[], DbError>> {
  try {
    const result = await pool.query<FilterRuleRow>(
      "SELECT * FROM filter_rules WHERE enabled = true ORDER BY type, value",
    );
    return ok(result.rows.map(rowToFilterRule));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getFilterRuleById(id: string): Promise<Result<FilterRule | null, DbError>> {
  try {
    const result = await pool.query<FilterRuleRow>(
      "SELECT * FROM filter_rules WHERE id = $1",
      [id],
    );
    return ok(result.rows[0] ? rowToFilterRule(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function createFilterRule(
  data: Pick<FilterRule, "type" | "value"> & Partial<Pick<FilterRule, "action">>,
): Promise<Result<FilterRule, DbError>> {
  try {
    const action = data.action ?? (data.type.endsWith("_block") ? "block" : "min");
    const result = await pool.query<FilterRuleRow>(
      `INSERT INTO filter_rules (type, value, action)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.type, data.value, action],
    );
    return ok(rowToFilterRule(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateFilterRule(
  id: string,
  data: Partial<Pick<FilterRule, "value" | "action" | "enabled">>,
): Promise<Result<FilterRule | null, DbError>> {
  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.value !== undefined) { sets.push(`value = $${idx++}`); params.push(data.value); }
    if (data.action !== undefined) { sets.push(`action = $${idx++}`); params.push(data.action); }
    if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled); }

    if (!sets.length) return ok(null);

    params.push(id);
    const result = await pool.query<FilterRuleRow>(
      `UPDATE filter_rules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return ok(result.rows[0] ? rowToFilterRule(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function deleteFilterRule(id: string): Promise<Result<boolean, DbError>> {
  try {
    const result = await pool.query("DELETE FROM filter_rules WHERE id = $1", [id]);
    return ok((result.rowCount ?? 0) > 0);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
