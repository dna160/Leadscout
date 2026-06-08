import { Router } from "express";
import { pollReplies, getReplies, getLeadReplyThread } from "../services/inbox.service";

export const inboxRouter = Router();

/**
 * GET /api/inbox
 * List recent replies (newest first).
 */
inboxRouter.get("/", async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "100");
  const offset = parseInt((req.query.offset as string) ?? "0");
  const r = await getReplies(limit, offset);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ replies: r.value });
});

/**
 * GET /api/inbox/:leadId
 * All replies threaded to a specific lead.
 */
inboxRouter.get("/:leadId", async (req, res) => {
  const r = await getLeadReplyThread(req.params.leadId);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ replies: r.value });
});

/**
 * POST /api/inbox/poll
 * Manually trigger an IMAP poll (same logic as CRON).
 * Body: { since?: ISO date string }
 */
inboxRouter.post("/poll", async (req, res) => {
  const since = req.body?.since ? new Date(req.body.since) : undefined;
  const r = await pollReplies(since);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json(r.value);
});
