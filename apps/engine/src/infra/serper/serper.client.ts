/**
 * Serper Google Search API client.
 *
 * Used ONLY for Phase 2 context enrichment of already-qualified leads.
 * Never called during scrape/discovery (Phase 1/1.5).
 */

import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { ok, err, type Result } from "../../lib/result";

const SERPER_URL = "https://google.serper.dev/search";
const TIMEOUT_MS = 10_000;

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

export interface SerperKnowledgeGraph {
  title?: string;
  type?: string;
  description?: string;
  attributes?: Record<string, string>;
}

export interface SerperSearchResult {
  query: string;
  organic: SerperOrganicResult[];
  knowledgeGraph?: SerperKnowledgeGraph;
}

export type SerperError = { message: string; status?: number };

/** Fire a single Serper query. Returns structured results or an error. */
export async function searchSerper(
  query: string,
  maxResults = 5,
): Promise<Result<SerperSearchResult, SerperError>> {
  if (!env.SERPER_API_KEY) {
    return err({ message: "SERPER_API_KEY not set — skipping context enrichment" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(SERPER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": env.SERPER_API_KEY,
      },
      body: JSON.stringify({ q: query, num: maxResults, gl: "id", hl: "id" }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      return err({ message: `Serper HTTP ${response.status}: ${text}`, status: response.status });
    }

    const data = (await response.json()) as {
      organic?: Array<{ title: string; link: string; snippet: string; position?: number }>;
      knowledgeGraph?: SerperKnowledgeGraph;
    };

    return ok({
      query,
      organic: (data.organic ?? []).slice(0, maxResults).map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        position: r.position,
      })),
      knowledgeGraph: data.knowledgeGraph,
    });
  } catch (e) {
    clearTimeout(timer);
    const error = e as Error;
    logger.warn({ query, error: error.message }, "Serper request failed");
    return err({ message: error.message });
  }
}

/** Fire multiple queries concurrently (max 3 at once). Returns an array of results; failed
 *  queries return empty organic arrays so callers get a partial context bundle, never a throw. */
export async function searchSerperBatch(
  queries: string[],
): Promise<SerperSearchResult[]> {
  const results: SerperSearchResult[] = [];
  // Run in groups of 3 to avoid rate-limit spikes
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(q => searchSerper(q).then(r => (r.ok ? r.value : { query: q, organic: [] }))),
    );
    results.push(...batchResults);
  }
  return results;
}
