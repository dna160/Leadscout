import fs from "fs";
import path from "path";
import { ApifyClient } from "apify-client";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { ok, err, type Result } from "../../lib/result";

const ACTOR_ID = "nwua9Gu5YrADL7ZDj";

export interface ApifyPlace {
  placeId: string | null;
  title: string;
  categoryName: string | null;
  address: string | null;
  city: string | null;
  phoneUnformatted: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  totalScore: number | null;
  reviewsCount: number | null;
  url: string | null;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
  };
}

export interface CityQuery {
  keywords: string[];
  locationQuery: string;
  cityName: string;
  placeMinimumStars?: number;
  searchMatching?: "all" | "any";
}

export interface ApifyScrapeResult {
  items: ApifyPlace[];
  costUsd: number;
}

export type ApifyError = { code: string; message: string };

function loadFixtures(): ApifyPlace[] {
  const fixturePath = path.join(__dirname, "../../../tests/fixtures/apify-sample.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as ApifyPlace[];
}

export async function runApifyScrapeForCity(
  query: CityQuery,
  maxPlacesPerSearch = 20,
  useMock?: boolean,
): Promise<Result<ApifyScrapeResult, ApifyError>> {
  const shouldMock = useMock ?? env.APIFY_MOCK;
  if (shouldMock) {
    logger.info({ city: query.cityName, keywords: query.keywords, mode: "mock" }, "Apify mock run");
    await new Promise((r) => setTimeout(r, 300));
    const sample = loadFixtures();
    const filtered = sample.filter((p) =>
      query.keywords.some(
        (kw) =>
          (p.categoryName ?? "").toLowerCase().includes(kw.split(" ")[0].toLowerCase()) ||
          (p.city ?? "").toLowerCase().includes(query.cityName.toLowerCase()),
      ),
    );
    const items = filtered.length > 0 ? filtered : sample.slice(0, 5);
    return ok({ items, costUsd: 0 });
  }

  if (!env.APIFY_API_KEY) {
    return err({ code: "NO_API_KEY", message: "APIFY_API_KEY is not set" });
  }

  const client = new ApifyClient({ token: env.APIFY_API_KEY });

  try {
    logger.info(
      { city: query.cityName, keywords: query.keywords, maxPlacesPerSearch },
      "Starting Apify actor run",
    );

    const run = await client.actor(ACTOR_ID).call({
      searchStringsArray: query.keywords,
      locationQuery: query.locationQuery,
      maxCrawledPlacesPerSearch: maxPlacesPerSearch,
      language: "id",
      scrapeContacts: false,       // +$0.002/place — phone is in base data already
      skipClosedPlaces: true,
      scrapeSocialMediaProfiles: {  // +$0.002/place — skipping saves ~50% total cost
        instagrams: false,
        facebooks: false,
        youtubes: false,
        tiktoks: false,
        twitters: false,
      },
      maxReviews: 0,
      maxImages: 0,
      website: "allPlaces",
      searchMatching: query.searchMatching ?? "all",
      ...(query.placeMinimumStars != null ? { placeMinimumStars: query.placeMinimumStars } : {}),
    });

    logger.info({ runId: run.id, status: run.status }, "Apify run finished");

    // Cost: read from the run's usage. Defaults to 0 if undefined.
    const costUsd =
      typeof (run as { usageTotalUsd?: number }).usageTotalUsd === "number"
        ? (run as { usageTotalUsd?: number }).usageTotalUsd!
        : 0;

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return ok({ items: items as unknown as ApifyPlace[], costUsd });
  } catch (e) {
    const error = e as Error;
    logger.error({ city: query.cityName, error: error.message }, "Apify run failed");
    return err({ code: "APIFY_ERROR", message: error.message });
  }
}
