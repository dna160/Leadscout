import { pool } from "@/infra/db/client";
import { ok, err, type Result } from "@/lib/result";

export interface City {
  id: string;
  name: string;
  query: string;
  enabled: boolean;
}

export type DbError = { code: string; message: string };

export async function listCities(): Promise<Result<City[], DbError>> {
  try {
    const result = await pool.query<City>("SELECT * FROM target_cities ORDER BY name");
    return ok(result.rows);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function listEnabledCities(): Promise<Result<City[], DbError>> {
  try {
    const result = await pool.query<City>(
      "SELECT * FROM target_cities WHERE enabled = true ORDER BY name",
    );
    return ok(result.rows);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function getCityById(id: string): Promise<Result<City | null, DbError>> {
  try {
    const result = await pool.query<City>("SELECT * FROM target_cities WHERE id = $1", [id]);
    return ok(result.rows[0] ?? null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function createCity(
  data: Pick<City, "name" | "query">,
): Promise<Result<City, DbError>> {
  try {
    const result = await pool.query<City>(
      "INSERT INTO target_cities (name, query) VALUES ($1, $2) RETURNING *",
      [data.name, data.query],
    );
    return ok(result.rows[0]);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function updateCity(
  id: string,
  data: Partial<Pick<City, "name" | "query" | "enabled">>,
): Promise<Result<City | null, DbError>> {
  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
    if (data.query !== undefined) { sets.push(`query = $${idx++}`); params.push(data.query); }
    if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled); }

    if (!sets.length) return ok(null);

    params.push(id);
    const result = await pool.query<City>(
      `UPDATE target_cities SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return ok(result.rows[0] ?? null);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}

export async function deleteCity(id: string): Promise<Result<boolean, DbError>> {
  try {
    const result = await pool.query("DELETE FROM target_cities WHERE id = $1", [id]);
    return ok((result.rowCount ?? 0) > 0);
  } catch (e) {
    const error = e as Error & { code?: string };
    return err({ code: error.code ?? "DB_ERROR", message: error.message });
  }
}
