/**
 * IMAP client — imapflow-based reply poller.
 *
 * POLICY: This client connects to Hostinger (or any IMAP server) receive-only
 * to fetch replies. It does not send. Thread matching is done via In-Reply-To
 * or References headers.
 */

import { ImapFlow } from "imapflow";
import { env } from "../../lib/env";
import { ok, err, type Result } from "../../lib/result";

type AppError = { message: string };

export interface FetchedReply {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  fromAddr: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

function makeClient(): ImapFlow {
  if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASS) {
    throw new Error(
      "IMAP not configured. Set IMAP_HOST, IMAP_USER, IMAP_PASS in env.",
    );
  }
  return new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: env.IMAP_PORT === 993,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASS },
    logger: false,
    tls: { rejectUnauthorized: true },
  });
}

/**
 * Fetch all unseen messages from INBOX since `since` date.
 * Returns them as FetchedReply objects, then marks them as seen.
 */
export async function fetchUnseenReplies(since: Date): Promise<Result<FetchedReply[], AppError>> {
  const client = makeClient();
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const replies: FetchedReply[] = [];

    // Search: UNSEEN + SINCE date — imapflow returns number[] or false
    const searchResult = await client.search({ seen: false, since });
    const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

    if (uids.length === 0) {
      await client.logout();
      return ok([]);
    }

    for await (const msg of client.fetch(uids, {
      uid: true,
      envelope: true,
      source: true,
    })) {
      try {
        const envelope = msg.envelope;
        if (!envelope) continue;

        const fromAddr = envelope.from?.[0]?.address ?? "";
        const subject = envelope.subject ?? "(no subject)";
        const messageId = envelope.messageId ?? `uid-${msg.uid}`;
        const inReplyTo = (envelope as any).inReplyTo ?? null;
        const date = envelope.date ?? new Date();

        // Extract plain text from source (basic — strips HTML)
        const source = msg.source?.toString("utf-8") ?? "";
        const body = extractPlainText(source);

        replies.push({ uid: msg.uid, messageId, inReplyTo, fromAddr, subject, body, receivedAt: date });
      } catch {
        // skip malformed message
      }
    }

    // Mark fetched messages as seen
    if (uids.length > 0) {
      await client.messageFlagsAdd(uids, ["\\Seen"]);
    }

    await client.logout();
    return ok(replies);
  } catch (e) {
    try { await client.logout(); } catch { /* ignore */ }
    return err({ message: (e as Error).message });
  }
}

/** Minimal plain-text extractor — strips headers and HTML tags */
function extractPlainText(raw: string): string {
  // Find body after double CRLF
  const headerEnd = raw.indexOf("\r\n\r\n");
  const body = headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw;
  // Strip HTML tags
  return body.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 4000);
}
