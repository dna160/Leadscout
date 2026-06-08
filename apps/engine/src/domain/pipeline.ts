/**
 * Phase 3 — CRM pipeline stage machine.
 * Stages flow in one direction; suppressed is a terminal absorbing state.
 */

export type PipelineStage =
  | "new"        // scraped, not yet through Phase 2
  | "approved"   // Phase 2 assets generated, ready to send
  | "queued"     // added to outreach queue
  | "sent"       // at least one outreach sent
  | "replied"    // prospect replied
  | "meeting"    // meeting booked (manual)
  | "won"        // converted (manual)
  | "lost"       // closed lost (manual)
  | "suppressed"; // bounced / unsubscribed / complaint — no further contact

export type OutreachChannel = "email" | "whatsapp" | "ig";
export type MessageStatus =
  | "queued" | "sent" | "bounced" | "replied" | "failed" | "suppressed";

export type MessageVariant = "A" | "B";

export interface SendingInbox {
  id: string;
  domain: string;
  address: string;
  display_name: string | null;
  daily_cap: number;
  warmup_stage: number;
  warmup_ramp: string;      // "5,7,9,10"
  sent_today: number;
  status: "warming" | "active" | "paused";
  bounce_rate: number;
  complaint_rate: number;
  last_reset_at: Date | null;
  created_at: Date;
}

export interface OutreachMessage {
  id: string;
  lead_id: string;
  channel: OutreachChannel;
  variant: MessageVariant | null;
  inbox_id: string | null;
  subject: string | null;
  body: string | null;
  status: MessageStatus;
  sent_at: Date | null;
  error: string | null;
  created_at: Date;
}

export interface Reply {
  id: string;
  lead_id: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  from_addr: string | null;
  subject: string | null;
  body: string | null;
  received_at: Date | null;
  created_at: Date;
}

export interface CronRun {
  id: string;
  job: "scrape" | "drip";
  status: "running" | "done" | "failed" | "killed";
  counts: Record<string, number>;
  started_at: Date;
  finished_at: Date | null;
  error: string | null;
}

/** Returns the effective daily send cap for an inbox given its warmup stage */
export function effectiveDailyCap(inbox: SendingInbox): number {
  const ramp = inbox.warmup_ramp.split(",").map(Number).filter((n) => !isNaN(n));
  const rampCap = ramp[Math.min(inbox.warmup_stage, ramp.length - 1)] ?? inbox.daily_cap;
  return Math.min(rampCap, inbox.daily_cap);
}
