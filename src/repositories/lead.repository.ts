import { pool } from "@/infra/db/client";
import { type Lead, type LeadFilters, type LeadStats, type LeadRow, rowToLead } from "@/domain/lead";
import { ok, err, type Result } from "@/lib/result";

export type DbError = { code: string; message: string };

export async function upsertLead(
  lead: Omit<Lead, "id" | "created_at">,
): Promise<Result<Lead, DbError>> {
  try {
    const result = await pool.query<LeadRow>(
      `INSERT INTO leads (
        place_key, place_id, name, category, segment, matched_keyword, city,
        address, phone, whatsapp, website, email, instagram, maps_url,
        rating, reviews, source_run_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (place_key) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        phone = EXCLUDED.phone,
        whatsapp = EXCLUDED.whatsapp,
        website = EXCLUDED.website,
        email = EXCLUDED.email,
        instagram = EXCLUDED.instagram,
        maps_url = EXCLUDED.maps_url,
        rating = EXCLUDED.rating,
        reviews = EXCLUDED.reviews
      RETURNING *`,
      [
        lead.place_key,
        lead.place_id,
        lead.name,
        lead.category,
        lead.segment,
        lead.matched_keyword,
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
        lead.source_run_id,
      ],
    );
    return ok(rowToLead(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getLeads(
  filters: LeadFilters = {},
): Promise<Result<Lead[], DbError>> {
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

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

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit ?? 500;
    const offset = filters.offset ?? 0;

    const result = await pool.query<LeadRow>(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );
    return ok(result.rows.map(rowToLead));
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
      this_week: string;
    }>(
      `SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE segment = 'hot')::text AS hot,
        COUNT(*) FILTER (WHERE segment = 'warm')::text AS warm,
        COUNT(*) FILTER (WHERE segment = 'cold')::text AS cold,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS this_week
       FROM leads`,
    );
    const row = result.rows[0];
    return ok({
      total: parseInt(row.total),
      hot: parseInt(row.hot),
      warm: parseInt(row.warm),
      cold: parseInt(row.cold),
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
      "SELECT * FROM leads ORDER BY created_at DESC",
    );
    return ok(result.rows.map(rowToLead));
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
