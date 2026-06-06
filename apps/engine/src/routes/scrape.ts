import { Router } from "express";
import { z } from "zod";
import { runScrape, estimateScrapeCost } from "../services/scrape.service";

export const scrapeRouter = Router();

const scrapeBodySchema = z.object({
  maxPlacesPerSearch: z.number().int().min(1).max(200).optional(),
  mode: z.enum(["mock", "live"]).optional(),
  placeMinimumStars: z.number().min(0).max(5).optional(),
});

scrapeRouter.get("/estimate", async (req, res) => {
  const maxPlaces = parseInt((req.query.maxPlaces as string) ?? "20", 10);
  const safeMax = Number.isFinite(maxPlaces) && maxPlaces > 0 ? maxPlaces : 20;
  const result = await estimateScrapeCost(safeMax);
  if (!result.ok) {
    return void res.status(500).json({ error: result.error.message });
  }
  res.json(result.value);
});

scrapeRouter.post("/", async (req, res) => {
  const parsed = scrapeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({
      error: parsed.error.issues.map((i) => i.message).join(", "),
    });
  }

  const result = await runScrape(parsed.data);
  if (!result.ok) {
    const status = result.error.code === "NO_KEYWORDS" || result.error.code === "NO_CITIES" ? 422 : 500;
    return void res.status(status).json({ error: result.error.message, code: result.error.code });
  }

  res.json(result.value);
});
