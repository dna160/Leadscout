/**
 * SMTP client — nodemailer wrapper for the warmed sending domain.
 *
 * POLICY: This client ONLY sends from the dedicated sending domain (SEND_DOMAIN).
 * The Hostinger business domain is strictly receive-only. Mixing them would
 * violate Hostinger ToS and risk burning Johannes's real mail reputation.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../lib/env";
import { ok, err, type Result } from "../../lib/result";

type AppError = { message: string };

export interface SendMailOptions {
  from: string;          // "Display Name <addr@send-domain.com>"
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;      // business email for human replies
  messageId?: string;    // custom Message-ID for threading
  attachments?: Array<{
    filename: string;
    content: string;     // base64
    encoding: "base64";
    contentType: string;
  }>;
}

export interface SentInfo {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

let _transport: Transporter | null = null;

function getTransport(): Transporter {
  if (_transport) return _transport;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in env. " +
      "These must point to the dedicated sending domain (not Hostinger).",
    );
  }
  _transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: Math.floor(3600_000 / (env.SEND_PER_HOUR || 5)), // ms between sends
    rateLimit: 1,
  });
  return _transport;
}

export async function sendMail(opts: SendMailOptions): Promise<Result<SentInfo, AppError>> {
  try {
    const transport = getTransport();
    const info = await transport.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      messageId: opts.messageId,
      attachments: opts.attachments,
    });
    return ok({
      messageId: info.messageId as string,
      accepted: (info.accepted as string[]) ?? [],
      rejected: (info.rejected as string[]) ?? [],
    });
  } catch (e) {
    return err({ message: (e as Error).message });
  }
}

export async function verifySmtp(): Promise<Result<true, AppError>> {
  try {
    const transport = getTransport();
    await transport.verify();
    return ok(true as const);
  } catch (e) {
    return err({ message: (e as Error).message });
  }
}

/** Generate a deterministic Message-ID for a given lead+inbox+date */
export function buildMessageId(leadId: string, inboxAddress: string): string {
  const ts = Date.now();
  const domain = inboxAddress.split("@")[1] ?? "mail";
  return `<ls-${leadId.slice(0, 8)}-${ts}@${domain}>`;
}
