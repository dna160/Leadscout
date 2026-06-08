import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";
import type { SerperSearchResult } from "../infra/serper/serper.client";

export type DbError = { code: string; message: string };

export interface LeadContext {
  id: string;
  lead_id: string;
  serper_results: SerperSearchResult[];
  signals: string[];
  menu_links: string[];
  raw_text: string | null;
  sources: string[];
  fetched_at: Date;
}

interface LeadContextRow {
  id: string;
  lead_id: string;
  serper_results: unknown;
  signals: unknown;
  menu_links: unknown;
  raw_text: string | null;
  sources: unknown;
  fetched_at: Date;
}

function parseJsonb<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try { return JSON.parse(value as string) as T; } catch { return fallback; }
}

function rowToContext(row: LeadContextRow): LeadContext {
  return {
    id: row.id,
    lead_id: row.lead_id,
    serper_results: parseJsonb<SerperSearchResult[]>(row.serper_results, []),
    signals: parseJsonb<string[]>(row.signals, []),
    menu_links: parseJsonb<string[]>(row.menu_links, []),
    raw_text: row.raw_text,
    sources: parseJsonb<string[]>(row.sources, []),
    fetched_at: row.fetched_at,
  };
}

export async function upsertLeadContext(
  leadId: string,
  data: {
    serper_results: SerperSearchResult[];
    signals: string[];
    menu_links: string[];
    raw_text?: string | null;
    sources: string[];
  },
): Promise<Result<LeadContext, DbError>> {
  try {
    const result = await pool.query<LeadContextRow>(
      `INSERT INTO lead_context (lead_id, serper_results, signals, menu_links, raw_text, sources)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6::jsonb)
       ON CONFLICT (lead_id) DO UPDATE SET
         serper_results = EXCLUDED.serper_results,
         signals        = EXCLUDED.signals,
         menu_links     = EXCLUDED.menu_links,
         raw_text       = EXCLUDED.raw_text,
         sources        = EXCLUDED.sources,
         fetched_at     = NOW()
       RETURNING *`,
      [
        leadId,
        JSON.stringify(data.serper_results),
        JSON.stringify(data.signals),
        JSON.stringify(data.menu_links),
        data.raw_text ?? null,
        JSON.stringify(data.sources),
      ],
    );
    return ok(rowToContext(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getLeadContext(
  leadId: string,
): Promise<Result<LeadContext | null, DbError>> {
  try {
    const result = await pool.query<LeadContextRow>(
      `SELECT * FROM lead_context WHERE lead_id = $1`,
      [leadId],
    );
    return ok(result.rows[0] ? rowToContext(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
