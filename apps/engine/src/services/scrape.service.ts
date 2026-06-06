import { env } from "../lib/env";
import { runApifyScrapeForCity, type ApifyPlace, type CityQuery } from "../infra/apify/apify.client";
import {
  upsertLead,
  markLeadRejected,
  setTriageVerdict,
  getLeads,
} from "../repositories/lead.repository";
import { createRun, updateRun } from "../repositories/run.repository";
import { listEnabledKeywordSets } from "../repositories/keywordSet.repository";
import { listEnabledCities } from "../repositories/city.repository";
import { listEnabledFilterRules } from "../repositories/filterRule.repository";
import { applyL2Filter } from "./filter.service";
import { triageLeads } from "./triage.service";
import { computePlaceKey } from "../domain/identity";
import { normalisePhone, toWhatsApp } from "../lib/phone";
import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import type { Lead, Segment } from "../domain/lead";
import type { FilterRule } from "../domain/filtering";

const COST_PER_PLACE_USD = 0.004; // base $4/1k, no enrichment

export interface ScrapeOptions {
  maxPlacesPerSearch?: number;
  mode?: "mock" | "live";
  placeMinimumStars?: number;
}

export interface ScrapeRunResult {
  runId: string;
  cityCount: number;
  placesFound: number;
  newLeads: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
}

export type ScrapeError = {
  code: string;
  message: string;
  runId?: string;
};

// Kept for unit tests
export function buildQueryPlan(
  keywordSets: Array<{ segment: Segment; keywords: string[]; label: string }>,
  cities: Array<{ name: string; query: string }>,
): Array<{ query: string; segment: Segment; keyword: string; city: string }> {
  const seen = new Set<string>();
  const plan: Array<{ query: string; segment: Segment; keyword: string; city: string }> = [];
  for (const kwSet of keywordSets) {
    for (const keyword of kwSet.keywords) {
      for (const city of cities) {
        const query = `${keyword} ${city.query}`;
        if (!seen.has(query)) {
          seen.add(query);
          plan.push({ query, segment: kwSet.segment, keyword, city: city.name });
        }
      }
    }
  }
  return plan;
}

function buildCityQueries(
  keywordSets: Array<{ segment: Segment; keywords: string[] }>,
  cities: Array<{ name: string; query: string }>,
  placeMinimumStars?: number,
): CityQuery[] {
  const allKeywords = [...new Set(keywordSets.flatMap((ks) => ks.keywords))];
  return cities.map((city) => ({
    keywords: allKeywords,
    locationQuery: `${city.query}, Indonesia`,
    cityName: city.name,
    placeMinimumStars,
  }));
}

function segmentForKeyword(
  keyword: string,
  keywordSets: Array<{ segment: Segment; keywords: string[] }>,
): Segment {
  for (const ks of keywordSets) {
    if (ks.keywords.some((k) => keyword.toLowerCase().includes(k.toLowerCase()))) {
      return ks.segment;
    }
  }
  return "cold";
}

function matchedKeyword(place: ApifyPlace, keywords: string[]): string {
  const haystack = `${place.title ?? ""} ${place.categoryName ?? ""}`.toLowerCase();
  return keywords.find((kw) => haystack.includes(kw.toLowerCase())) ?? keywords[0] ?? "";
}

// Apify may return price as "$", "$$" etc, or as integer 1-4
export function parsePriceLevel(raw: Record<string, unknown>): number | null {
  const p = raw.price ?? raw.priceLevel ?? raw.price_level;
  if (typeof p === "number") return Math.min(4, Math.max(1, Math.round(p)));
  if (typeof p === "string") {
    const dollarCount = (p.match(/\$/g) ?? []).length;
    if (dollarCount > 0) return Math.min(4, dollarCount);
  }
  return null;
}

// Raw item from Apify may use different field names — normalise defensively
function normalisePlaceToLead(
  raw: Record<string, unknown>,
  segment: Segment,
  keyword: string,
  city: string,
  runId: string,
): Omit<Lead, "id" | "created_at"> | null {
  // Accept both "title" and "name" (actor may return either)
  const title = (raw.title ?? raw.name ?? "") as string;
  if (!title) return null; // skip items with no name

  const placeId = (raw.placeId ?? raw.place_id ?? null) as string | null;
  const placeKey = computePlaceKey(raw);

  // Phone: prefer phoneUnformatted, fall back to phone
  const rawPhone = (raw.phoneUnformatted ?? raw.phone ?? null) as string | null;

  // Instagram: may live at raw.instagram, raw.socialMedia.instagram, or raw.instagramUrl
  const socialMedia = (raw.socialMedia ?? {}) as Record<string, string>;
  const instagram =
    (raw.instagram as string | null) ??
    socialMedia.instagram?.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") ??
    (raw.instagramUrl as string | null)?.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") ??
    null;

  return {
    place_key: placeKey,
    place_id: placeId,
    name: title,
    category: (raw.categoryName ?? raw.category ?? null) as string | null,
    segment,
    matched_keyword: keyword,
    matched_keywords: keyword ? [keyword] : [],
    city,
    address: (raw.address ?? null) as string | null,
    phone: normalisePhone(rawPhone),
    whatsapp: toWhatsApp(rawPhone),
    website: (raw.website ?? null) as string | null,
    email: (raw.email ?? null) as string | null,
    instagram,
    maps_url: (raw.url ?? null) as string | null,
    rating: raw.totalScore != null ? Number(raw.totalScore) : null,
    reviews: raw.reviewsCount != null ? Number(raw.reviewsCount) : null,
    price_level: parsePriceLevel(raw),
    status: "active",
    reject_layer: null,
    reject_reason: null,
    triage_verdict: null,
    first_seen_run: runId,
    last_seen_run: runId,
    source_run_id: runId,
  };
}

export interface ScrapeEstimate {
  estimatedPlaces: number;
  estimatedCostUsd: number;
}

/**
 * Compute a cost estimate from the enabled keyword sets and cities in the DB.
 */
export async function estimateScrapeCost(maxPlaces: number): Promise<Result<ScrapeEstimate, ScrapeError>> {
  const kwResult = await listEnabledKeywordSets();
  if (!kwResult.ok) return err({ code: "DB_ERROR", message: kwResult.error.message });

  const cityResult = await listEnabledCities();
  if (!cityResult.ok) return err({ code: "DB_ERROR", message: cityResult.error.message });

  const keywordCount = [...new Set(kwResult.value.flatMap((ks) => ks.keywords))].length;
  const cityCount = cityResult.value.length;
  const estimatedPlaces = keywordCount * cityCount * maxPlaces;
  const estimatedCostUsd = Number((estimatedPlaces * COST_PER_PLACE_USD).toFixed(4));

  return ok({ estimatedPlaces, estimatedCostUsd });
}

export async function runScrape(
  options: ScrapeOptions = {},
): Promise<Result<ScrapeRunResult, ScrapeError>> {
  const kwResult = await listEnabledKeywordSets();
  if (!kwResult.ok) return err({ code: "DB_ERROR", message: kwResult.error.message });

  const cityResult = await listEnabledCities();
  if (!cityResult.ok) return err({ code: "DB_ERROR", message: cityResult.error.message });

  const filterResult = await listEnabledFilterRules();
  if (!filterResult.ok) return err({ code: "DB_ERROR", message: filterResult.error.message });

  const kwSets = kwResult.value;
  const cities = cityResult.value;
  const filterRules: FilterRule[] = filterResult.value;

  if (!kwSets.length) return err({ code: "NO_KEYWORDS", message: "No enabled keyword sets" });
  if (!cities.length) return err({ code: "NO_CITIES", message: "No enabled cities" });

  const cityQueries = buildCityQueries(kwSets, cities, options.placeMinimumStars);
  const allKeywords = kwSets.flatMap((ks) => ks.keywords);
  const maxPlaces = options.maxPlacesPerSearch ?? 20;

  // Cost estimate before the run starts
  const estimatedCostUsd = Number((allKeywords.length * cities.length * maxPlaces * COST_PER_PLACE_USD).toFixed(4));

  // Request body `mode` takes precedence; fall back to env var default
  const useMock = options.mode === "mock" || (options.mode === undefined && env.APIFY_MOCK);

  const runResult = await createRun({
    mode: useMock ? "mock" : "live",
    queries: cityQueries.map((q) => q.locationQuery),
    cities: cities.map((c) => c.name),
    estimated_cost: estimatedCostUsd,
    enrichment: false,
  });

  if (!runResult.ok) return err({ code: "DB_ERROR", message: runResult.error.message });

  const run = runResult.value;
  logger.info({ runId: run.id, cities: cities.length, estimatedCostUsd }, "Scrape run started");

  let totalPlaces = 0;
  let totalNewLeads = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalRejectedL2 = 0;
  let actualCostUsd = 0;

  // place_keys of leads that survived L2 (candidates for L3 triage)
  const survivors = new Set<string>();

  try {
    for (const cityQuery of cityQueries) {
      const apifyResult = await runApifyScrapeForCity(cityQuery, maxPlaces, useMock);

      if (!apifyResult.ok) {
        logger.warn(
          { city: cityQuery.cityName, error: apifyResult.error.message },
          "City scrape failed — continuing with next city",
        );
        continue;
      }

      const { items, costUsd } = apifyResult.value;
      actualCostUsd += costUsd;
      const rawItems = items as unknown as Record<string, unknown>[];
      totalPlaces += rawItems.length;

      // Log a sample of the first raw item so field names are visible in Railway logs
      if (rawItems.length > 0) {
        logger.info(
          { city: cityQuery.cityName, count: rawItems.length, sampleKeys: Object.keys(rawItems[0]) },
          "Apify items received — sample field names",
        );
      }

      for (const raw of rawItems) {
        const kw = matchedKeyword(raw as unknown as ApifyPlace, allKeywords);
        const leadData = normalisePlaceToLead(
          raw,
          segmentForKeyword(kw, kwSets),
          kw,
          cityQuery.cityName,
          run.id,
        );

        if (!leadData) {
          totalSkipped++;
          logger.warn({ raw: JSON.stringify(raw).slice(0, 200) }, "Skipped item — no title/name");
          continue;
        }

        // ── L2 deterministic filter (before upsert) ──
        const verdict = applyL2Filter(leadData, filterRules);
        if (verdict.verdict === "drop") {
          leadData.status = "rejected";
          leadData.reject_layer = "L2";
          leadData.reject_reason = verdict.reason;
          totalRejectedL2++;
        }

        const upsertResult = await upsertLead(leadData);
        if (!upsertResult.ok) {
          totalErrors++;
          logger.error(
            { error: upsertResult.error, leadName: leadData.name, city: leadData.city },
            "Failed to upsert lead",
          );
          continue;
        }

        if (upsertResult.value.inserted) totalNewLeads++;

        // If this lead was rejected at L2 on a re-scrape it may currently be
        // 'active' in the DB; mark it rejected explicitly (upsert keeps status).
        if (verdict.verdict === "drop") {
          await markLeadRejected(leadData.place_key, "L2", verdict.reason ?? "L2 filter");
        } else {
          survivors.add(leadData.place_key);
        }
      }
    }

    // ── L3 LLM triage on survivors ──
    const triageEnabled = Boolean(env.DEEPSEEK_API_KEY);
    let totalRejectedL3 = 0;
    if (triageEnabled && survivors.size > 0) {
      const activeResult = await getLeads({ status: "active", limit: 5000 });
      if (activeResult.ok) {
        const toTriage = activeResult.value.filter((l) => survivors.has(l.place_key));
        const outcomes = await triageLeads(
          toTriage.map((l) => ({
            leadId: l.place_key,
            name: l.name,
            category: l.category,
            price_level: l.price_level,
            rating: l.rating,
            reviews: l.reviews,
            address: l.address,
          })),
          { enabled: true },
        );

        for (const outcome of outcomes) {
          if (outcome.verdict === "drop") {
            await markLeadRejected(outcome.leadId, "L3", outcome.reason, "drop");
            totalRejectedL3++;
          } else {
            await setTriageVerdict(outcome.leadId, outcome.verdict);
          }
        }
      } else {
        logger.warn({ error: activeResult.error.message }, "Could not load survivors for triage");
      }
    }

    const roundedActualCost = Number(actualCostUsd.toFixed(4));

    await updateRun(run.id, {
      status: "completed",
      places_found: totalPlaces,
      new_leads: totalNewLeads,
      actual_cost: roundedActualCost,
      finished_at: new Date(),
    });

    logger.info(
      {
        runId: run.id,
        placesFound: totalPlaces,
        newLeads: totalNewLeads,
        skipped: totalSkipped,
        errors: totalErrors,
        rejectedL2: totalRejectedL2,
        rejectedL3: totalRejectedL3,
        estimatedCostUsd,
        actualCostUsd: roundedActualCost,
      },
      "Scrape run completed",
    );

    return ok({
      runId: run.id,
      cityCount: cityQueries.length,
      placesFound: totalPlaces,
      newLeads: totalNewLeads,
      estimatedCostUsd,
      actualCostUsd: roundedActualCost,
    });
  } catch (e) {
    const error = e as Error;
    logger.error({ runId: run.id, error: error.message, stack: error.stack }, "Scrape run threw unexpectedly");
    await updateRun(run.id, {
      status: "failed",
      error: error.message,
      finished_at: new Date(),
    });
    return err({ code: "UNEXPECTED_ERROR", message: error.message, runId: run.id });
  }
}
