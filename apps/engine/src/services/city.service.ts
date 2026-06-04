import {
  listCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
  type City,
} from "../repositories/city.repository";
import { ok, err, type Result } from "../lib/result";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1).max(200),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  query: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
});

export type ServiceError = { code: string; message: string };

export async function getAllCities(): Promise<Result<City[], ServiceError>> {
  const result = await listCities();
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(result.value);
}

export async function createNewCity(input: unknown): Promise<Result<City, ServiceError>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
  }
  const result = await createCity(parsed.data);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(result.value);
}

export async function patchCity(
  id: string,
  input: unknown,
): Promise<Result<City, ServiceError>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
  }

  const result = await updateCity(id, parsed.data);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  if (!result.value) return err({ code: "NOT_FOUND", message: `City ${id} not found` });
  return ok(result.value);
}

export async function removeCity(id: string): Promise<Result<void, ServiceError>> {
  const existing = await getCityById(id);
  if (!existing.ok) return err({ code: existing.error.code, message: existing.error.message });
  if (!existing.value) return err({ code: "NOT_FOUND", message: `City ${id} not found` });

  const result = await deleteCity(id);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(undefined);
}
