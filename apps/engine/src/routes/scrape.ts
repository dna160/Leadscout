import { Router } from "express";
import { z } from "zod";
import { runScrape } from "../services/scrape.service";

export const scrapeRouter = Router();

const scrapeBodySchema = z.object({
  maxPlacesPerSearch: z.number().int().min(1).max(200).optional(),
  mode: z.enum(["mock", "live"]).optional(),
});

scrapeRouter.post("/", async (req, res) => {
  const parsed = scrapeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({
      error: parsed.error.issues.map((i) => i.message).join(", "),
    });
  }

  const result = await runScrape({ maxPlacesPerSearch: 5, ...parsed.data });
  if (!result.ok) {
    const status = result.error.code === "NO_KEYWORDS" || result.error.code === "NO_CITIES" ? 422 : 500;
    return void res.status(status).json({ error: result.error.message, code: result.error.code });
  }

  res.json(result.value);
});
