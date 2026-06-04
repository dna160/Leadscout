import crypto from "crypto";
import { runApifyScrape, type ApifyPlace } from "@/infra/apify/apify.client";
import { upsertLead } from "@/repositories/lead.repository";
import { createRun, updateRun } from "@/repositories/run.repository";
import { listEnabledKeywordSets } from "@/repositories/keywordSet.repository";
import { listEnabledCities } from "@/repositories/city.repository";
import { normalisePhone, toWhatsApp } from "@/lib/phone";
import { logger } from "@/lib/logger";
import { ok, err, type Result } from "@/lib/result";
import type { Lead, Segment } from "@/domain/lead";

export interface ScrapeOptions {
  maxPlacesPerSearch?: number;
}

export interface ScrapeRunResult {
  runId: string;
  queryCount: number;
  placesFound: number;
  newLeads: number;
}

export type ScrapeError = {
  code: string;
  message: string;
  runId?: string;
};

export function buildQueryPlan(
  keywords: Array<{ segment: Segment; keywords: string[]; label: string }>,
  cities: Array<{ name: string; query: string }>,
): Array<{ query: string; segment: Segment; keyword: string; city: string }> {
  const seen = new Set<string>();
  const plan: Array<{ query: string; segment: Segment; keyword: string; city: string }> = [];

  for (const kwSet of keywords) {
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

function normalisePlaceToLead(
  place: ApifyPlace,
  segment: Segment,
  keyword: string,
  city: string,
  runId: string,
): Omit<Lead, "id" | "created_at"> {
  const placeKey =
    place.placeId ??
    crypto
      .createHash("sha1")
      .update(`${place.title}::${city}`)
      .digest("hex")
      .slice(0, 20);

  const phone = normalisePhone(place.phoneUnformatted ?? place.phone);
  const instagram =
    place.instagram ??
    place.socialMedia?.instagram?.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") ??
    null;

  return {
    place_key: placeKey,
    place_id: place.placeId ?? null,
    name: place.title,
    category: place.categoryName ?? null,
    segment,
    matched_keyword: keyword,
    city,
    address: place.address ?? null,
    phone,
    whatsapp: toWhatsApp(place.phoneUnformatted ?? place.phone),
    website: place.website ?? null,
    email: place.email ?? null,
    instagram,
    maps_url: place.url ?? null,
    rating: place.totalScore ?? null,
    reviews: place.reviewsCount ?? null,
    source_run_id: runId,
  };
}

export async function runScrape(
  options: ScrapeOptions = {},
): Promise<Result<ScrapeRunResult, ScrapeError>> {
  const kwResult = await listEnabledKeywordSets();
  if (!kwResult.ok) {
    return err({ code: "DB_ERROR", message: kwResult.error.message });
  }

  const cityResult = await listEnabledCities();
  if (!cityResult.ok) {
    return err({ code: "DB_ERROR", message: cityResult.error.message });
  }

  const kwSets = kwResult.value;
  const cities = cityResult.value;

  if (!kwSets.length) return err({ code: "NO_KEYWORDS", message: "No enabled keyword sets" });
  if (!cities.length) return err({ code: "NO_CITIES", message: "No enabled cities" });

  const plan = buildQueryPlan(kwSets, cities);
  if (!plan.length) return err({ code: "EMPTY_PLAN", message: "Query plan is empty" });

  const runResult = await createRun({
    mode: process.env.APIFY_MOCK === "true" ? "mock" : "live",
    queries: plan.map((p) => p.query),
    cities: cities.map((c) => c.name),
  });

  if (!runResult.ok) {
    return err({ code: "DB_ERROR", message: runResult.error.message });
  }

  const run = runResult.value;
  logger.info({ runId: run.id, queries: plan.length }, "Scrape run started");

  try {
    const queries = plan.map((p) => p.query);
    const apifyResult = await runApifyScrape(queries, options.maxPlacesPerSearch ?? 20);

    if (!apifyResult.ok) {
      await updateRun(run.id, {
        status: "failed",
        error: apifyResult.error.message,
        finished_at: new Date(),
      });
      return err({ code: apifyResult.error.code, message: apifyResult.error.message, runId: run.id });
    }

    const places = apifyResult.value;
    let newLeads = 0;

    for (const place of places) {
      const planEntry = plan.find(
        (p) =>
          (place.city ?? "").toLowerCase().includes(p.city.toLowerCase()) ||
          (place.categoryName ?? "").toLowerCase().includes(p.keyword.toLowerCase()),
      ) ?? plan[0];

      const leadData = normalisePlaceToLead(
        place,
        planEntry.segment,
        planEntry.keyword,
        planEntry.city,
        run.id,
      );

      const upsertResult = await upsertLead(leadData);
      if (upsertResult.ok) newLeads++;
    }

    await updateRun(run.id, {
      status: "completed",
      places_found: places.length,
      new_leads: newLeads,
      finished_at: new Date(),
    });

    logger.info({ runId: run.id, placesFound: places.length, newLeads }, "Scrape run completed");

    return ok({
      runId: run.id,
      queryCount: plan.length,
      placesFound: places.length,
      newLeads,
    });
  } catch (e) {
    const error = e as Error;
    await updateRun(run.id, {
      status: "failed",
      error: error.message,
      finished_at: new Date(),
    });
    return err({ code: "UNEXPECTED_ERROR", message: error.message, runId: run.id });
  }
}
