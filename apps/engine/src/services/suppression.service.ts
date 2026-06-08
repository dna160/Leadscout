/**
 * Suppression service — 100% gate on every outreach send.
 * Checks DB suppression list + scans reply text for opt-out phrases.
 */

import { ok, err, type Result } from "../lib/result";
import { logger } from "../lib/logger";
import {
  isSuppressed,
  addSuppression,
  listSuppressions,
  removeSuppression,
} from "../repositories/suppression.repository";
import { detectOptOut } from "../domain/suppression";
import type { Suppression, SuppressionReason } from "../domain/suppression";

type AppError = { message: string };

/**
 * The hard gate — call this before EVERY send.
 * Returns ok(true) if the address is suppressed (do NOT send).
 */
export async function checkSuppressed(email: string): Promise<Result<boolean, AppError>> {
  return isSuppressed(email.toLowerCase().trim());
}

/**
 * Scan reply body text for opt-out phrases.
 * If detected, auto-suppress the sender address.
 */
export async function autoSuppressIfOptOut(
  fromAddr: string,
  replyText: string,
): Promise<Result<{ suppressed: boolean }, AppError>> {
  if (!detectOptOut(replyText)) return ok({ suppressed: false });

  logger.info(`[suppression] Opt-out detected from ${fromAddr} — auto-suppressing`);
  const res = await addSuppression({ value: fromAddr, type: "email", reason: "unsubscribe" });
  if (!res.ok) return err(res.error);
  return ok({ suppressed: true });
}

export async function suppress(
  value: string,
  reason: SuppressionReason,
): Promise<Result<Suppression, AppError>> {
  return addSuppression({ value: value.toLowerCase().trim(), type: "email", reason });
}

export async function getSuppressions(
  limit = 200,
  offset = 0,
): Promise<Result<Suppression[], AppError>> {
  return listSuppressions(limit, offset);
}

export async function deleteSuppression(id: string): Promise<Result<void, AppError>> {
  return removeSuppression(id);
}
