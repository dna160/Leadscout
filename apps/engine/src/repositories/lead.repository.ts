import { pool } from "../infra/db/client";
import { type Lead, type LeadFilters, type LeadStats, type LeadRow, rowToLead } from "../domain/lead";
import { ok, err, type Result } from "../lib/result";

export type DbError = { code: string; message: string };

export async function upsertLead(
  lead: Omit<Lead, "id" | "created_at">,
): Promise<Result<{ lead: Lead; inserted: boolean }, DbError>> {
  try {
    const result = await pool.query<LeadRow & { inserted: boolean }>(
      `INSERT INTO leads (
        place_key, place_id, name, category, segment, matched_keyword, matched_keywords, city,
        address, phone, whatsapp, website, email, instagram, maps_url,
        rating, reviews, price_level, status, reject_layer, reject_reason, triage_verdict,
        first_seen_run, last_seen_run, source_run_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
      )
      ON CONFLICT (place_key) DO UPDATE SET
        -- Identity fields (name, place_id, address): keep first-seen, do not overwrite
        -- Contact fields: COALESCE to the most complete value
        phone = COALESCE(leads.phone, EXCLUDED.phone),
        whatsapp = COALESCE(leads.whatsapp, EXCLUDED.whatsapp),
        website = COALESCE(leads.website, EXCLUDED.website),
        email = COALESCE(leads.email, EXCLUDED.email),
        instagram = COALESCE(leads.instagram, EXCLUDED.instagram),
        maps_url = COALESCE(leads.maps_url, EXCLUDED.maps_url),
        category = COALESCE(leads.category, EXCLUDED.category),
        -- Volatile fields: always refresh
        rating = EXCLUDED.rating,
        reviews = EXCLUDED.reviews,
        -- price_level: COALESCE (keep if already known)
        price_level = COALESCE(leads.price_level, EXCLUDED.price_level),
        -- matched_keywords: accumulate (distinct union)
        matched_keywords = (
          SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
          FROM jsonb_array_elements_text(
            COALESCE(leads.matched_keywords, '[]'::jsonb) || COALESCE(EXCLUDED.matched_keywords, '[]'::jsonb)
          ) AS v
        ),
        -- last_seen_run: always update; first_seen_run: keep first (unchanged)
        last_seen_run = EXCLUDED.last_seen_run
        -- status / reject_* / triage_verdict intentionally left unchanged here;
        -- the scrape pipeline updates them explicitly via markLeadRejected/setTriageVerdict
      RETURNING *, (xmax::text::bigint = 0) AS inserted`,
      [
        lead.place_key,
        lead.place_id,
        lead.name,
        lead.category,
        lead.segment,
        lead.matched_keyword,
        JSON.stringify(lead.matched_keywords ?? []),
        lead.city,
        lead.address,
        lead.phone,
        lead.whatsapp,
        lead.website,
        lead.email,
        lead.instagram,
        lead.maps_url,
        lead.rating,
        lead.reviews,
        lead.price_level,
        lead.status,
        lead.reject_layer,
        lead.reject_reason,
        lead.triage_verdict,
        lead.first_seen_run,
        lead.last_seen_run,
        lead.source_run_id,
      ],
    );
    return ok({ lead: rowToLead(result.rows[0]), inserted: result.rows[0].inserted });
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

function buildLeadQuery(
  filters: LeadFilters,
  forcedStatus?: string,
): { where: string; params: unknown[]; nextIdx: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const status = forcedStatus ?? filters.status ?? "active";
  conditions.push(`status = $${idx++}`);
  params.push(status);

  if (filters.segment) {
    conditions.push(`segment = $${idx++}`);
    params.push(filters.segment);
  }
  if (filters.city) {
    conditions.push(`city = $${idx++}`);
    params.push(filters.city);
  }
  if (filters.search) {
    conditions.push(`(name ILIKE $${idx} OR category ILIKE $${idx} OR address ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  return { where, params, nextIdx: idx };
}

export async function getLeads(
  filters: LeadFilters = {},
): Promise<Result<Lead[], DbError>> {
  try {
    const { where, params, nextIdx } = buildLeadQuery(filters);
    const limit = filters.limit ?? 500;
    const offset = filters.offset ?? 0;

    const result = await pool.query<LeadRow>(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, limit, offset],
    );
    return ok(result.rows.map(rowToLead));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getRejectedLeads(
  filters: LeadFilters = {},
): Promise<Result<Lead[], DbError>> {
  try {
    const { where, params, nextIdx } = buildLeadQuery(filters, "rejected");
    const limit = filters.limit ?? 500;
    const offset = filters.offset ?? 0;

    const result = await pool.query<LeadRow>(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, limit, offset],
    );
    return ok(result.rows.map(rowToLead));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function restoreLead(id: string): Promise<Result<Lead | null, DbError>> {
  try {
    const result = await pool.query<LeadRow>(
      `UPDATE leads
       SET status = 'active', reject_layer = NULL, reject_reason = NULL
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return ok(result.rows[0] ? rowToLead(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function markLeadRejected(
  placeKey: string,
  layer: string,
  reason: string,
  triageVerdict?: string,
): Promise<Result<void, DbError>> {
  try {
    await pool.query(
      `UPDATE leads
       SET status = 'rejected', reject_layer = $2, reject_reason = $3,
           triage_verdict = COALESCE($4, triage_verdict)
       WHERE place_key = $1`,
      [placeKey, layer, reason, triageVerdict ?? null],
    );
    return ok(undefined);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function setTriageVerdict(
  placeKey: string,
  verdict: string,
): Promise<Result<void, DbError>> {
  try {
    await pool.query(`UPDATE leads SET triage_verdict = $2 WHERE place_key = $1`, [placeKey, verdict]);
    return ok(undefined);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getLeadStats(): Promise<Result<LeadStats, DbError>> {
  try {
    const result = await pool.query<{
      total: string;
      hot: string;
      warm: string;
      cold: string;
      rejected: string;
      this_week: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active')::text AS total,
        COUNT(*) FILTER (WHERE segment = 'hot' AND status = 'active')::text AS hot,
        COUNT(*) FILTER (WHERE segment = 'warm' AND status = 'active')::text AS warm,
        COUNT(*) FILTER (WHERE segment = 'cold' AND status = 'active')::text AS cold,
        COUNT(*) FILTER (WHERE status = 'rejected')::text AS rejected,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'active')::text AS this_week
       FROM leads`,
    );
    const row = result.rows[0];
    return ok({
      total: parseInt(row.total),
      hot: parseInt(row.hot),
      warm: parseInt(row.warm),
      cold: parseInt(row.cold),
      rejected: parseInt(row.rejected),
      thisWeek: parseInt(row.this_week),
    });
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getAllLeadsForExport(): Promise<Result<Lead[], DbError>> {
  try {
    const result = await pool.query<LeadRow>(
      "SELECT * FROM leads WHERE status = 'active' ORDER BY created_at DESC",
    );
    return ok(result.rows.map(rowToLead));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getLeadById(id: string): Promise<Result<Lead | null, DbError>> {
  try {
    const result = await pool.query<LeadRow>(`SELECT * FROM leads WHERE id = $1`, [id]);
    return ok(result.rows[0] ? rowToLead(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getQualifiedLeads(): Promise<Result<Lead[], DbError>> {
  try {
    const result = await pool.query<LeadRow>(
      `SELECT * FROM leads
       WHERE status = 'active'
         AND triage_verdict IN ('keep', 'maybe')
         AND enrichment_status IS NULL
       ORDER BY created_at DESC`,
    );
    return ok(result.rows.map(rowToLead));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateLeadPhase2(
  id: string,
  data: Partial<{
    segment: string;
    segment_confidence: number;
    segment_source: string;
    segment_evidence: string[];
    cut_fit: string[];
    contact_person: string | null;
    contact_role: string | null;
    enrichment_status: string;
    triage_verdict: string;
  }>,
): Promise<Result<Lead, DbError>> {
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;

  const jsonbFields = new Set(["segment_evidence", "cut_fit"]);

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sets.push(`${key} = $${idx++}`);
      params.push(jsonbFields.has(key) ? JSON.stringify(value) : value);
    }
  }

  params.push(id);
  try {
    const result = await pool.query<LeadRow>(
      `UPDATE leads SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!result.rows[0]) return err({ code: "NOT_FOUND", message: `Lead ${id} not found` });
    return ok(rowToLead(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateLeadPipelineStage(
  id: string,
  stage: string,
): Promise<Result<void, DbError>> {
  try {
    const now = new Date();
    await pool.query(
      `UPDATE leads SET pipeline_stage=$2, updated_at=$3,
         last_contacted_at = CASE WHEN $2 IN ('sent','queued') THEN $3 ELSE last_contacted_at END,
         replied_at        = CASE WHEN $2 = 'replied'          THEN $3 ELSE replied_at        END
       WHERE id=$1`,
      [id, stage, now],
    );
    return ok(undefined);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getDistinctCities(): Promise<Result<string[], DbError>> {
  try {
    const result = await pool.query<{ city: string }>(
      "SELECT DISTINCT city FROM leads WHERE city IS NOT NULL ORDER BY city",
    );
    return ok(result.rows.map((r) => r.city));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
