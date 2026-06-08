/**
 * Inbox service — polls Hostinger IMAP for replies, threads them to leads,
 * auto-suppresses opt-outs, advances pipeline stage to 'replied'.
 */

import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import { env } from "../lib/env";
import { fetchUnseenReplies } from "../infra/imap/imap.client";
import { upsertReply, listReplies, getLeadReplies, existsByMessageId } from "../repositories/reply.repository";
import { updateLeadPipelineStage, getLeadById } from "../repositories/lead.repository";
import { autoSuppressIfOptOut } from "./suppression.service";
import type { Reply } from "../domain/pipeline";
import { pool } from "../infra/db/client";

type AppError = { message: string };

export interface PollResult {
  fetched: number;
  new: number;
  optOuts: number;
  errors: number;
}

/**
 * Poll IMAP for new replies since the given date (default: 24h ago).
 * For each new reply:
 *   1. Thread to lead via in_reply_to header → outreach_messages.message_id
 *   2. Upsert into replies table
 *   3. Advance lead pipeline_stage to 'replied'
 *   4. Auto-suppress if opt-out phrase detected
 */
export async function pollReplies(since?: Date): Promise<Result<PollResult, AppError>> {
  if (!env.IMAP_HOST) {
    return err({ message: "IMAP not configured — set IMAP_HOST, IMAP_USER, IMAP_PASS" });
  }

  const lookback = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts: PollResult = { fetched: 0, new: 0, optOuts: 0, errors: 0 };

  const fetchRes = await fetchUnseenReplies(lookback);
  if (!fetchRes.ok) return err(fetchRes.error);
  const messages = fetchRes.value;
  counts.fetched = messages.length;

  for (const msg of messages) {
    try {
      // Check for duplicate
      const dupRes = await existsByMessageId(msg.messageId);
      if (dupRes.ok && dupRes.value) continue;

      // Thread to lead via in_reply_to
      let leadId: string | undefined;
      if (msg.inReplyTo) {
        const threadRes = await pool.query(
          `SELECT lead_id FROM outreach_messages
           WHERE body LIKE $1 OR subject LIKE $1
           LIMIT 1`,
          [`%${msg.inReplyTo}%`],
        );
        if (threadRes.rows[0]?.lead_id) leadId = threadRes.rows[0].lead_id;
      }

      // If not threaded by header, try matching by from_addr → lead.email
      if (!leadId && msg.fromAddr) {
        const emailRes = await pool.query(
          `SELECT id FROM leads WHERE LOWER(email)=LOWER($1) LIMIT 1`,
          [msg.fromAddr],
        );
        if (emailRes.rows[0]?.id) leadId = emailRes.rows[0].id;
      }

      // Upsert reply
      const replyRes = await upsertReply({
        lead_id: leadId,
        message_id: msg.messageId,
        in_reply_to: msg.inReplyTo ?? undefined,
        from_addr: msg.fromAddr,
        subject: msg.subject,
        body: msg.body,
        received_at: msg.receivedAt,
      });
      if (!replyRes.ok) { counts.errors++; continue; }

      counts.new++;

      // Advance pipeline stage
      if (leadId) {
        await updateLeadPipelineStage(leadId, "replied");
      }

      // Opt-out detection → auto-suppress
      const optRes = await autoSuppressIfOptOut(msg.fromAddr, msg.body);
      if (optRes.ok && optRes.value.suppressed) {
        counts.optOuts++;
        if (leadId) await updateLeadPipelineStage(leadId, "suppressed");
      }

      logger.info(`[inbox] New reply from ${msg.fromAddr} → lead=${leadId ?? "unthreaded"}`);
    } catch (e) {
      logger.error(`[inbox] Error processing message ${msg.messageId}: ${(e as Error).message}`);
      counts.errors++;
    }
  }

  logger.info(`[inbox] Poll complete: fetched=${counts.fetched} new=${counts.new} optOuts=${counts.optOuts}`);
  return ok(counts);
}

export async function getReplies(
  limit = 100,
  offset = 0,
): Promise<Result<Reply[], AppError>> {
  return listReplies(limit, offset);
}

export async function getLeadReplyThread(leadId: string): Promise<Result<Reply[], AppError>> {
  return getLeadReplies(leadId);
}
