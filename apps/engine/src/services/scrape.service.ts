import crypto from "crypto";
import { env } from "../lib/env";
import { runApifyScrapeForCity, type ApifyPlace, type CityQuery } from "../infra/apify/apify.client";
import { upsertLead } from "../repositories/lead.repository";
import { createRun, updateRun } from "../repositories/run.repository";
import { listEnabledKeywordSets } from "../repositories/keywordSet.repository";
import { listEnabledCities } from "../repositories/city.repository";
import { normalisePhone, toWhatsApp } from "../lib/phone";
import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import type { Lead, Segment } from "../domain/lead";

export interface ScrapeOptions {
  maxPlacesPerSearch?: number;
}

export interface ScrapeRunResult {
  runId: string;
  cityCount: number;
  placesFound: number;
  newLeads: number;
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
): CityQuery[] {
  const allKeywords = [...new Set(keywordSets.flatMap((ks) => ks.keywords))];
  return cities.map((city) => ({
    keywords: allKeywords,
    locationQuery: `${city.query}, Indonesia`,
    cityName: city.name,
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
  const placeKey =
    placeId ??
    crypto.createHash("sha1").update(`${title}::${city}`).digest("hex").slice(0, 20);

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
    source_run_id: runId,
  };
}

export async function runScrape(
  options: ScrapeOptions = {},
): Promise<Result<ScrapeRunResult, ScrapeError>> {
  const kwResult = await listEnabledKeywordSets();
  if (!kwResult.ok) return err({ code: "DB_ERROR", message: kwResult.error.message });

  const cityResult = await listEnabledCities();
  if (!cityResult.ok) return err({ code: "DB_ERROR", message: cityResult.error.message });

  const kwSets = kwResult.value;
  const cities = cityResult.value;

  if (!kwSets.length) return err({ code: "NO_KEYWORDS", message: "No enabled keyword sets" });
  if (!cities.length) return err({ code: "NO_CITIES", message: "No enabled cities" });

  const cityQueries = buildCityQueries(kwSets, cities);
  const allKeywords = kwSets.flatMap((ks) => ks.keywords);

  const runResult = await createRun({
    mode: env.APIFY_MOCK ? "mock" : "live",
    queries: cityQueries.map((q) => q.locationQuery),
    cities: cities.map((c) => c.name),
  });

  if (!runResult.ok) return err({ code: "DB_ERROR", message: runResult.error.message });

  const run = runResult.value;
  logger.info({ runId: run.id, cities: cities.length }, "Scrape run started");

  let totalPlaces = 0;
  let totalNewLeads = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    for (const cityQuery of cityQueries) {
      const apifyResult = await runApifyScrapeForCity(
        cityQuery,
        options.maxPlacesPerSearch ?? 20,
      );

      if (!apifyResult.ok) {
        logger.warn(
          { city: cityQuery.cityName, error: apifyResult.error.message },
          "City scrape failed — continuing with next city",
        );
        continue;
      }

      const rawItems = apifyResult.value as unknown as Record<string, unknown>[];
      totalPlaces += rawItems.length;

      // Log a sample of the first raw item so field names are visible in Railway logs
      if (rawItems.length > 0) {
        logger.info(
          { city: cityQuery.cityName, count: rawItems.length, sampleKeys: Object.keys(rawItems[0]) },
          "Apify items received — sample field names",
        );
      }

      for (const raw of rawItems) {
        const leadData = normalisePlaceToLead(raw, segmentForKeyword(matchedKeyword(raw as unknown as ApifyPlace, allKeywords), kwSets), matchedKeyword(raw as unknown as ApifyPlace, allKeywords), cityQuery.cityName, run.id);

        if (!leadData) {
          totalSkipped++;
          logger.warn({ raw: JSON.stringify(raw).slice(0, 200) }, "Skipped item — no title/name");
          continue;
        }

        const upsertResult = await upsertLead(leadData);
        if (upsertResult.ok) {
          totalNewLeads++;
        } else {
          totalErrors++;
          logger.error(
            { error: upsertResult.error, leadName: leadData.name, city: leadData.city },
            "Failed to upsert lead",
          );
        }
      }
    }

    await updateRun(run.id, {
      status: "completed",
      places_found: totalPlaces,
      new_leads: totalNewLeads,
      finished_at: new Date(),
    });

    logger.info(
      { runId: run.id, placesFound: totalPlaces, newLeads: totalNewLeads, skipped: totalSkipped, errors: totalErrors },
      "Scrape run completed",
    );

    return ok({
      runId: run.id,
      cityCount: cityQueries.length,
      placesFound: totalPlaces,
      newLeads: totalNewLeads,
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
