/**
 * Phase 2 I2 — Context enrichment via Serper
 *
 * For each qualified lead:
 *  1. Fire 3 Serper queries (menu, wagyu/A5, reviews)
 *  2. Assemble signals and menu_links from results
 *  3. Optionally fetch the venue website (thin context fallback)
 *  4. Persist in lead_context table
 *  5. Set lead.enrichment_status = 'enriched' | 'no_context'
 */

import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import type { Lead } from "../domain/lead";
import { searchSerperBatch } from "../infra/serper/serper.client";
import { upsertLeadContext } from "../repositories/context.repository";
import { updateLeadPhase2 } from "../repositories/lead.repository";

const WEBSITE_TIMEOUT_MS = 10_000;
const MAX_RAW_TEXT_CHARS = 20_000;
const MAX_SNIPPET_LENGTH = 500;

export type EnrichError = { message: string };

export interface EnrichResult {
  leadId: string;
  enrichmentStatus: "enriched" | "no_context";
  signalCount: number;
  menuLinkCount: number;
}

/** Extract signals (key phrases) from Serper results */
function extractSignals(snippets: string[]): string[] {
  const wagyu = /wagyu|a5|A5|kobe|premium beef|sirloin|ribeye|tenderloin|yakiniku|omakase|teppanyaki/i;
  return snippets
    .filter(s => s.length > 20)
    .map(s => s.slice(0, MAX_SNIPPET_LENGTH).trim())
    .filter(s => wagyu.test(s) || s.length > 50);
}

/** Extract probable menu links from Serper results */
function extractMenuLinks(results: Array<{ link: string; title: string }>): string[] {
  const menuPatterns = /menu|dine|food|restaurant|reservasi|booking/i;
  return results
    .filter(r => menuPatterns.test(r.link) || menuPatterns.test(r.title))
    .map(r => r.link)
    .slice(0, 5);
}

/** Fetch website text (best-effort; returns null on failure) */
async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    if (!url.startsWith("http")) url = `https://${url}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBSITE_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    // Strip tags; grab first MAX_RAW_TEXT_CHARS chars of visible text
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_RAW_TEXT_CHARS);
    return text || null;
  } catch {
    return null;
  }
}

export async function enrichLead(
  lead: Lead,
): Promise<Result<EnrichResult, EnrichError>> {
  const locationHint = lead.city ?? "Indonesia";

  const queries = [
    `"${lead.name}" ${locationHint} menu`,
    `"${lead.name}" wagyu A5 beef`,
    `"${lead.name}" ${locationHint} review restaurant`,
  ];

  const serperResults = await searchSerperBatch(queries);

  const allSnippets: string[] = serperResults.flatMap(r =>
    [
      ...(r.organic ?? []).map(o => o.snippet),
      r.knowledgeGraph?.description ?? "",
      ...Object.values(r.knowledgeGraph?.attributes ?? {}).join(" ").split(". "),
    ].filter(Boolean),
  );

  const allLinks = serperResults.flatMap(r =>
    (r.organic ?? []).map(o => ({ link: o.link, title: o.title })),
  );

  const signals = extractSignals(allSnippets);
  const menuLinks = extractMenuLinks(allLinks);

  // Website fetch if context is thin and venue has a website
  let rawText: string | null = null;
  const hasEnoughContext = signals.length >= 3;
  if (!hasEnoughContext && lead.website) {
    rawText = await fetchWebsiteText(lead.website);
    if (rawText) {
      // Also extract signals from the website text
      const webSignals = extractSignals([rawText]);
      signals.push(...webSignals);
    }
  }

  const sources = [
    ...new Set([
      ...serperResults.map(r => r.query),
      ...(rawText && lead.website ? [lead.website] : []),
    ]),
  ];

  const enrichmentStatus = signals.length > 0 || rawText ? "enriched" : "no_context";

  const contextResult = await upsertLeadContext(lead.id, {
    serper_results: serperResults,
    signals,
    menu_links: menuLinks,
    raw_text: rawText,
    sources,
  });

  if (!contextResult.ok) {
    logger.error({ leadId: lead.id, error: contextResult.error }, "Failed to save lead context");
    return err({ message: contextResult.error.message });
  }

  const updateResult = await updateLeadPhase2(lead.id, { enrichment_status: enrichmentStatus });
  if (!updateResult.ok) {
    logger.warn({ leadId: lead.id, error: updateResult.error }, "Failed to update enrichment_status");
  }

  logger.info(
    { leadId: lead.id, enrichmentStatus, signals: signals.length, menuLinks: menuLinks.length },
    "Lead enriched",
  );

  return ok({
    leadId: lead.id,
    enrichmentStatus,
    signalCount: signals.length,
    menuLinkCount: menuLinks.length,
  });
}

/** Batch enrich a set of leads with bounded concurrency (5 at a time) */
export async function enrichLeadsBatch(
  leads: Lead[],
): Promise<{ enriched: number; noContext: number; failed: number }> {
  let enriched = 0;
  let noContext = 0;
  let failed = 0;

  const CONCURRENCY = 5;
  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(l => enrichLead(l)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) {
        if (result.value.value.enrichmentStatus === "enriched") enriched++;
        else noContext++;
      } else {
        failed++;
      }
    }
  }

  return { enriched, noContext, failed };
}
