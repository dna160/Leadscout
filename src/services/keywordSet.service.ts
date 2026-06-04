import {
  listKeywordSets,
  getKeywordSetById,
  createKeywordSet,
  updateKeywordSet,
  deleteKeywordSet,
  type KeywordSet,
} from "@/repositories/keywordSet.repository";
import { ok, err, type Result } from "@/lib/result";
import { z } from "zod";
import type { Segment } from "@/domain/lead";

const VALID_SEGMENTS: Segment[] = ["hot", "warm", "cold", "drop"];

const createSchema = z.object({
  segment: z.enum(["hot", "warm", "cold", "drop"]),
  label: z.string().min(1).max(100),
  keywords: z.array(z.string().min(1).max(100)).min(1),
});

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  keywords: z.array(z.string().min(1).max(100)).optional(),
  enabled: z.boolean().optional(),
});

export type ServiceError = { code: string; message: string };

export async function getAllKeywordSets(): Promise<Result<KeywordSet[], ServiceError>> {
  const result = await listKeywordSets();
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(result.value);
}

export async function createNewKeywordSet(
  input: unknown,
): Promise<Result<KeywordSet, ServiceError>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return err({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  if (!VALID_SEGMENTS.includes(parsed.data.segment)) {
    return err({ code: "INVALID_SEGMENT", message: "Invalid segment value" });
  }

  const result = await createKeywordSet(parsed.data);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(result.value);
}

export async function patchKeywordSet(
  id: string,
  input: unknown,
): Promise<Result<KeywordSet, ServiceError>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return err({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(", ") });
  }

  const result = await updateKeywordSet(id, parsed.data);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  if (!result.value) return err({ code: "NOT_FOUND", message: `KeywordSet ${id} not found` });
  return ok(result.value);
}

export async function removeKeywordSet(id: string): Promise<Result<void, ServiceError>> {
  const existing = await getKeywordSetById(id);
  if (!existing.ok) return err({ code: existing.error.code, message: existing.error.message });
  if (!existing.value) return err({ code: "NOT_FOUND", message: `KeywordSet ${id} not found` });

  const result = await deleteKeywordSet(id);
  if (!result.ok) return err({ code: result.error.code, message: result.error.message });
  return ok(undefined);
}
