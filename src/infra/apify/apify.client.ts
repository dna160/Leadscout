import { env } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http";
import { logger } from "@/lib/logger";
import { ok, err, type Result } from "@/lib/result";
import apifySample from "../../../tests/fixtures/apify-sample.json";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "compass/crawler-google-places";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_MS = 8 * 60 * 1_000;

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
  socialMedia?: { instagram?: string };
}

export type ApifyError = { code: string; message: string };

export async function runApifyScrape(
  queries: string[],
  maxPlacesPerSearch = 20,
): Promise<Result<ApifyPlace[], ApifyError>> {
  if (env.APIFY_MOCK) {
    logger.info({ queries, mode: "mock" }, "Apify mock run");
    await new Promise((r) => setTimeout(r, 500));
    const filtered = (apifySample as ApifyPlace[]).filter((p) =>
      queries.some(
        (q) =>
          p.title.toLowerCase().includes(q.split(" ")[0].toLowerCase()) ||
          (p.categoryName ?? "").toLowerCase().includes(q.split(" ")[0].toLowerCase()) ||
          (p.city ?? "").toLowerCase().includes(q.split(" ").pop()?.toLowerCase() ?? ""),
      ),
    );
    return ok(filtered.length > 0 ? filtered : (apifySample as ApifyPlace[]));
  }

  if (!env.APIFY_API_KEY) {
    return err({ code: "NO_API_KEY", message: "APIFY_API_KEY is not set" });
  }

  try {
    const runRes = await fetchWithTimeout(
      `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${env.APIFY_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: queries.map((q) => ({
            url: `https://www.google.com/maps/search/${encodeURIComponent(q)}`,
          })),
          language: "id",
          maxCrawledPlacesPerSearch: maxPlacesPerSearch,
          scrapeContacts: true,
          skipClosedPlaces: true,
        }),
        timeoutMs: 30_000,
      },
    );

    if (!runRes.ok) {
      const text = await runRes.text();
      return err({ code: "APIFY_START_FAILED", message: text });
    }

    const runData = (await runRes.json()) as { data: { id: string; status: string } };
    const runId = runData.data.id;
    logger.info({ runId }, "Apify run started");

    const deadline = Date.now() + MAX_POLL_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetchWithTimeout(
        `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs/${runId}?token=${env.APIFY_API_KEY}`,
        { timeoutMs: 10_000 },
      );
      const statusData = (await statusRes.json()) as { data: { status: string } };
      const status = statusData.data.status;
      logger.info({ runId, status }, "Apify run status");

      if (status === "SUCCEEDED") {
        const itemsRes = await fetchWithTimeout(
          `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs/${runId}/dataset/items?token=${env.APIFY_API_KEY}&format=json`,
          { timeoutMs: 30_000 },
        );
        const items = (await itemsRes.json()) as ApifyPlace[];
        return ok(items);
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        return err({ code: "APIFY_RUN_FAILED", message: `Run ${runId} ended with status ${status}` });
      }
    }

    return err({ code: "APIFY_TIMEOUT", message: "Polling timed out after 8 minutes" });
  } catch (e) {
    const error = e as Error;
    return err({ code: "APIFY_NETWORK_ERROR", message: error.message });
  }
}
