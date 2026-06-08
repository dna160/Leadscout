import { pool } from "../infra/db/client";
import { ok, err, type Result } from "../lib/result";

export type DbError = { code: string; message: string };

export type AssetType = "whatsapp" | "email" | "deck";
export type AssetStatus = "draft" | "approved";

export interface LeadAsset {
  id: string;
  lead_id: string;
  type: AssetType;
  content: string | null;
  file_path: string | null;
  model: string | null;
  prompt_version: string | null;
  status: AssetStatus;
  created_at: Date;
}

interface LeadAssetRow {
  id: string;
  lead_id: string;
  type: string;
  content: string | null;
  file_path: string | null;
  model: string | null;
  prompt_version: string | null;
  status: string;
  created_at: Date;
}

function rowToAsset(row: LeadAssetRow): LeadAsset {
  return {
    ...row,
    type: row.type as AssetType,
    status: row.status as AssetStatus,
  };
}

export async function createAsset(
  leadId: string,
  data: {
    type: AssetType;
    content?: string | null;
    file_path?: string | null;
    model?: string | null;
    prompt_version?: string | null;
  },
): Promise<Result<LeadAsset, DbError>> {
  try {
    const result = await pool.query<LeadAssetRow>(
      `INSERT INTO lead_assets (lead_id, type, content, file_path, model, prompt_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        leadId,
        data.type,
        data.content ?? null,
        data.file_path ?? null,
        data.model ?? null,
        data.prompt_version ?? null,
      ],
    );
    return ok(rowToAsset(result.rows[0]));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getLeadAssets(
  leadId: string,
): Promise<Result<LeadAsset[], DbError>> {
  try {
    const result = await pool.query<LeadAssetRow>(
      `SELECT * FROM lead_assets WHERE lead_id = $1 ORDER BY created_at DESC`,
      [leadId],
    );
    return ok(result.rows.map(rowToAsset));
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function approveAsset(
  id: string,
): Promise<Result<LeadAsset | null, DbError>> {
  try {
    const result = await pool.query<LeadAssetRow>(
      `UPDATE lead_assets SET status = 'approved' WHERE id = $1 RETURNING *`,
      [id],
    );
    return ok(result.rows[0] ? rowToAsset(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateAssetContent(
  id: string,
  content: string,
): Promise<Result<LeadAsset | null, DbError>> {
  try {
    const result = await pool.query<LeadAssetRow>(
      `UPDATE lead_assets SET content = $2, status = 'draft' WHERE id = $1 RETURNING *`,
      [id, content],
    );
    return ok(result.rows[0] ? rowToAsset(result.rows[0]) : null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

/** Delete all existing assets of a given type for a lead, then create a fresh one.
 *  Used when regenerating a specific asset type. */
export async function replaceAsset(
  leadId: string,
  data: {
    type: AssetType;
    content?: string | null;
    file_path?: string | null;
    model?: string | null;
    prompt_version?: string | null;
  },
): Promise<Result<LeadAsset, DbError>> {
  try {
    await pool.query(
      `DELETE FROM lead_assets WHERE lead_id = $1 AND type = $2`,
      [leadId, data.type],
    );
    return createAsset(leadId, data);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
