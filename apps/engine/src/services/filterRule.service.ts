import {
  listFilterRules,
  getFilterRuleById,
  createFilterRule,
  updateFilterRule,
  deleteFilterRule,
} from "../repositories/filterRule.repository";
import { ok, err, type Result } from "../lib/result";
import type { FilterRule } from "../domain/filtering";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum(["category_block", "name_block", "price_min", "rating_min", "reviews_min"]),
  value: z.string().min(1).max(200),
  action: z.string().min(1).max(20).optional(),
});

const updateSchema = z.object({
  value: z.string().min(1).max(200).optional(),
  action: z.string().min(1).max(20).optional(),
  enabled: z.boolean().optional(),
});

export type ServiceError = { code: string; message: string };

export async function getAllFilterRules(): Promise<Result<FilterRule[], ServiceError>> {
  const result = await listFilterRules();
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(result.value);
}

export async function createNewFilterRule(input: unknown): Promise<Result<FilterRule, ServiceError>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return err({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  const result = await createFilterRule(parsed.data);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(result.value);
}

export async function patchFilterRule(id: string, input: unknown): Promise<Result<FilterRule, ServiceError>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return err({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  const result = await updateFilterRule(id, parsed.data);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  if (!result.value) return err({ code: "NOT_FOUND", message: `FilterRule ${id} not found` });
  return ok(result.value);
}

export async function removeFilterRule(id: string): Promise<Result<void, ServiceError>> {
  const existing = await getFilterRuleById(id);
  if (!existing.ok) return err({ code: existing.error.code, message: existing.error.message });
  if (!existing.value) return err({ code: "NOT_FOUND", message: `FilterRule ${id} not found` });

  const result = await deleteFilterRule(id);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(undefined);
}
