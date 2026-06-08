import { Router } from "express";
import { queueLeadForEmail, runDripBatch } from "../services/send.service";
import { verifySmtp } from "../infra/smtp/smtp.client";
import { listInboxes, upsertInbox } from "../repositories/inbox.repository";
import { getMessageStats, getLeadMessages } from "../repositories/message.repository";
import { logger } from "../lib/logger";

export const sendRouter = Router();

/**
 * POST /api/send/queue
 * Body: { leadIds: string[] }
 * Queues leads for email outreach.
 */
sendRouter.post("/queue", async (req, res) => {
  const { leadIds } = req.body as { leadIds?: string[] };
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return void res.status(400).json({ error: "leadIds array required" });
  }

  const results: Array<{ leadId: string; messageId?: string; error?: string }> = [];
  for (const leadId of leadIds) {
    const r = await queueLeadForEmail(leadId);
    if (r.ok) results.push({ leadId, messageId: r.value });
    else results.push({ leadId, error: r.error.message });
  }

  const queued = results.filter((r) => r.messageId).length;
  const failed = results.length - queued;
  res.json({ queued, failed, results });
});

/**
 * POST /api/send/run
 * Manually trigger a drip batch (same logic as CRON).
 */
sendRouter.post("/run", async (_req, res) => {
  logger.info("[route:send] Manual drip run triggered");
  const r = await runDripBatch();
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json(r.value);
});

/**
 * GET /api/send/stats
 * Message status counts across all outreach.
 */
sendRouter.get("/stats", async (_req, res) => {
  const r = await getMessageStats();
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json(r.value);
});

/**
 * GET /api/send/messages/:leadId
 * All outreach messages for a specific lead.
 */
sendRouter.get("/messages/:leadId", async (req, res) => {
  const r = await getLeadMessages(req.params.leadId);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ messages: r.value });
});

/**
 * GET /api/send/inboxes
 * List all configured sending inboxes.
 */
sendRouter.get("/inboxes", async (_req, res) => {
  const r = await listInboxes();
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ inboxes: r.value });
});

/**
 * POST /api/send/inboxes
 * Register or update a sending inbox.
 * Body: { address, domain, display_name?, daily_cap?, warmup_ramp? }
 */
sendRouter.post("/inboxes", async (req, res) => {
  const { address, domain, display_name, daily_cap, warmup_ramp } = req.body;
  if (!address || !domain) {
    return void res.status(400).json({ error: "address and domain required" });
  }
  const r = await upsertInbox({ address, domain, display_name, daily_cap, warmup_ramp });
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.status(201).json(r.value);
});

/**
 * POST /api/send/verify-smtp
 * Test SMTP connectivity.
 */
sendRouter.post("/verify-smtp", async (_req, res) => {
  const r = await verifySmtp();
  if (!r.ok) return void res.status(502).json({ ok: false, error: r.error.message });
  res.json({ ok: true });
});
