/**
 * Send service — core outreach engine.
 *
 * Responsibilities:
 *   - Queue a lead for outreach (creates outreach_messages row, sets pipeline_stage=queued)
 *   - Run the drip batch: pick queued messages, throttle by inbox daily cap + SEND_PER_HOUR,
 *     A/B variant selection, suppression gate, send via SMTP, update DB
 *
 * POLICY:
 *   - Email only — WhatsApp/IG are human-gated, never automated here
 *   - Never send from Hostinger business domain — SMTP must be warmed sending domain
 *   - Suppression check is a 100% hard gate before every send
 */

import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import { env } from "../lib/env";
import {
  createMessage,
  getQueuedMessages,
  updateMessageStatus,
} from "../repositories/message.repository";
import { listInboxes, incrementSentToday, resetDailyCounters } from "../repositories/inbox.repository";
import { getLeadById, updateLeadPipelineStage } from "../repositories/lead.repository";
import { checkSuppressed } from "./suppression.service";
import { sendMail, buildMessageId } from "../infra/smtp/smtp.client";
import { effectiveDailyCap } from "../domain/pipeline";
import type { SendingInbox } from "../domain/pipeline";
import type { Lead } from "../domain/lead";

type AppError = { message: string };

// ── A/B variant selection ────────────────────────────────────────────────────

function pickVariant(leadId: string): "A" | "B" {
  // Deterministic 50/50 split by lead ID
  const n = parseInt(leadId.replace(/-/g, "").slice(0, 8), 16);
  return n % 2 === 0 ? "A" : "B";
}

function fromAddress(variant: "A" | "B", inbox: SendingInbox): string {
  const name = variant === "A"
    ? (env.SEND_FROM_NAME_A || "Johannes — A5 Wagyu Indonesia")
    : (env.SEND_FROM_NAME_B || "IBUKI A5 Wagyu");
  return `"${name}" <${inbox.address}>`;
}

// ── Email template (Bahasa Indonesia) ───────────────────────────────────────

function buildEmailBody(lead: Lead, variant: "A" | "B"): { subject: string; html: string; text: string } {
  const venueName = lead.name;
  const contactName = lead.contact_person ?? "Bapak/Ibu";

  const subject = variant === "A"
    ? `A5 Wagyu Wagyu Premium — Penawaran Eksklusif untuk ${venueName}`
    : `IBUKI A5 Wagyu — Kolaborasi untuk ${venueName}`;

  const text = `
Yth. ${contactName},

Saya Johannes dari IBUKI, distributor resmi A5 Wagyu Indonesia.

Kami menyediakan A5 Wagyu grade tertinggi dengan sertifikasi Japan Meat Grading Association — marbling score 8–12, dipilih langsung dari prefektur terpercaya di Jepang.

Kami percaya ${venueName} akan menghargai kualitas ini untuk tamu-tamu terbaik Anda.

Yang kami tawarkan:
• A5 Wagyu grade A4–A5 (BMS 8-12)
• Cold-chain terjaga langsung dari Jepang
• Minimum order fleksibel untuk venue fine dining
• Deck produk dan sheet harga tersedia atas permintaan

Boleh saya kirimkan detail lebih lanjut? Cukup balas email ini.

Salam hormat,
Johannes
IBUKI A5 Wagyu Indonesia

---
Jika Anda tidak ingin menerima email ini, balas dengan "berhenti" atau "unsubscribe".
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,serif;color:#1a1a1a;background:#fff;max-width:600px;margin:0 auto;padding:32px 24px">
  <div style="border-top:3px solid #C9A96E;padding-top:24px;margin-bottom:24px"></div>

  <p style="margin:0 0 16px">Yth. <strong>${contactName}</strong>,</p>

  <p style="margin:0 0 16px;line-height:1.7">
    Saya <strong>Johannes</strong> dari <strong>IBUKI</strong>, distributor resmi A5 Wagyu di Indonesia.
  </p>

  <p style="margin:0 0 16px;line-height:1.7">
    Kami menyediakan A5 Wagyu grade tertinggi dengan sertifikasi Japan Meat Grading Association —
    marbling score 8–12, dipilih langsung dari prefektur terpercaya di Jepang.
  </p>

  <p style="margin:0 0 16px;line-height:1.7">
    Kami percaya <strong>${venueName}</strong> akan menghargai kualitas ini untuk tamu-tamu terbaik Anda.
  </p>

  <div style="background:#F7F4EF;border-left:3px solid #C9A96E;padding:16px 20px;margin:24px 0;border-radius:2px">
    <p style="margin:0 0 8px;font-weight:bold;color:#C9A96E;text-transform:uppercase;font-size:12px;letter-spacing:1px">Yang kami tawarkan</p>
    <ul style="margin:0;padding-left:20px;line-height:1.8;color:#333">
      <li>A5 Wagyu grade A4–A5 (BMS 8-12)</li>
      <li>Cold-chain terjaga langsung dari Jepang</li>
      <li>Minimum order fleksibel untuk venue fine dining</li>
      <li>Deck produk &amp; sheet harga atas permintaan</li>
    </ul>
  </div>

  <p style="margin:0 0 24px;line-height:1.7">
    Boleh saya kirimkan detail lebih lanjut? Cukup balas email ini.
  </p>

  <p style="margin:0 0 4px">Salam hormat,</p>
  <p style="margin:0 0 4px"><strong>Johannes</strong></p>
  <p style="margin:0;color:#C9A96E;font-size:14px">IBUKI A5 Wagyu Indonesia</p>

  <div style="border-top:1px solid #eee;margin-top:40px;padding-top:16px">
    <p style="color:#999;font-size:11px;line-height:1.6;margin:0">
      Jika Anda tidak ingin menerima email ini, balas dengan kata "berhenti" atau "unsubscribe".
    </p>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

// ── Queue a lead ─────────────────────────────────────────────────────────────

export async function queueLeadForEmail(leadId: string): Promise<Result<string, AppError>> {
  // Fetch lead to get email
  const leadRes = await getLeadById(leadId);
  if (!leadRes.ok) return err(leadRes.error);
  const lead = leadRes.value;
  if (!lead) return err({ message: `Lead ${leadId} not found` });
  if (!lead.email) return err({ message: `Lead ${leadId} has no email address` });

  // Suppression gate
  const suppRes = await checkSuppressed(lead.email);
  if (!suppRes.ok) return err(suppRes.error);
  if (suppRes.value) return err({ message: `${lead.email} is suppressed — skipping` });

  const variant = pickVariant(leadId);
  const { subject, html, text } = buildEmailBody(lead, variant);

  const msgRes = await createMessage({ lead_id: leadId, channel: "email", variant, subject, body: html });
  if (!msgRes.ok) return err(msgRes.error);

  // Advance pipeline stage to queued
  await updateLeadPipelineStage(leadId, "queued");

  logger.info(`[send] Queued message ${msgRes.value.id} for lead ${leadId} (variant ${variant})`);
  return ok(msgRes.value.id);
}

// ── Drip batch ───────────────────────────────────────────────────────────────

export interface DripResult {
  attempted: number;
  sent: number;
  failed: number;
  suppressed: number;
  skipped: number;
}

/**
 * Run one drip batch. Called by CRON or manually via POST /api/send/run.
 * Processes queued messages up to the inbox daily cap.
 */
export async function runDripBatch(): Promise<Result<DripResult, AppError>> {
  if (!env.SMTP_HOST) {
    return err({ message: "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS" });
  }

  const counts: DripResult = { attempted: 0, sent: 0, failed: 0, suppressed: 0, skipped: 0 };

  // Load active/warming inboxes
  const inboxRes = await listInboxes();
  if (!inboxRes.ok) return err(inboxRes.error);
  const inboxes = inboxRes.value.filter((i) => i.status !== "paused");
  if (inboxes.length === 0) return err({ message: "No active inboxes configured" });

  // Calculate total remaining capacity across all inboxes
  const totalCapacity = inboxes.reduce((sum, inbox) => {
    const cap = effectiveDailyCap(inbox);
    return sum + Math.max(0, cap - inbox.sent_today);
  }, 0);

  if (totalCapacity === 0) {
    logger.info("[send] All inboxes at daily cap — drip skipped");
    return ok(counts);
  }

  // Load queued messages
  const queueRes = await getQueuedMessages(Math.min(totalCapacity, 100));
  if (!queueRes.ok) return err(queueRes.error);
  const queue = queueRes.value;
  if (queue.length === 0) {
    logger.info("[send] Queue empty — nothing to send");
    return ok(counts);
  }

  // Round-robin across inboxes
  let inboxIdx = 0;

  for (const msg of queue) {
    // Find next inbox with remaining capacity
    let inbox: SendingInbox | null = null;
    for (let i = 0; i < inboxes.length; i++) {
      const candidate = inboxes[(inboxIdx + i) % inboxes.length];
      const cap = effectiveDailyCap(candidate);
      if (candidate.sent_today < cap) {
        inbox = candidate;
        inboxIdx = (inboxIdx + i + 1) % inboxes.length;
        break;
      }
    }
    if (!inbox) break; // All inboxes saturated

    counts.attempted++;

    // Fetch lead for email address
    const leadRes = await getLeadById(msg.lead_id);
    if (!leadRes.ok || !leadRes.value?.email) {
      await updateMessageStatus(msg.id, "failed", { error: "Lead or email not found" });
      counts.failed++;
      continue;
    }
    const lead = leadRes.value;

    // Suppression gate (re-checked at send time)
    const suppRes = await checkSuppressed(lead.email!);
    if (!suppRes.ok || suppRes.value) {
      await updateMessageStatus(msg.id, "suppressed");
      await updateLeadPipelineStage(lead.id, "suppressed");
      counts.suppressed++;
      logger.info(`[send] Suppressed ${lead.email} — skipping`);
      continue;
    }

    const variant = (msg.variant ?? pickVariant(lead.id)) as "A" | "B";
    const { subject, html, text } = buildEmailBody(lead, variant);
    const from = fromAddress(variant, inbox);
    const messageId = buildMessageId(lead.id, inbox.address);

    const sendRes = await sendMail({
      from,
      to: lead.email!,
      subject,
      html,
      text,
      replyTo: env.IMAP_USER, // replies go to Hostinger inbox
      messageId,
    });

    if (!sendRes.ok) {
      await updateMessageStatus(msg.id, "failed", { error: sendRes.error.message });
      counts.failed++;
      logger.error(`[send] Failed to send to ${lead.email}: ${sendRes.error.message}`);
      continue;
    }

    // Success
    await updateMessageStatus(msg.id, "sent", {
      inbox_id: inbox.id,
      sent_at: new Date(),
    });
    await incrementSentToday(inbox.id);
    // Mutate local copy so round-robin cap check stays accurate within this batch
    inbox.sent_today++;
    await updateLeadPipelineStage(lead.id, "sent");
    counts.sent++;
    logger.info(`[send] ✓ Sent to ${lead.email} via ${inbox.address} (variant ${variant})`);

    // Inter-send delay to respect SEND_PER_HOUR rate
    const delayMs = Math.floor(3600_000 / (env.SEND_PER_HOUR || 5));
    if (delayMs > 0 && counts.attempted < queue.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return ok(counts);
}

/** Reset daily sent counters (call at midnight via CRON) */
export { resetDailyCounters };
