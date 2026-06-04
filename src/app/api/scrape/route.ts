export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/services/scrape.service";
import { z } from "zod";

const bodySchema = z.object({
  maxPlacesPerSearch: z.number().int().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const result = await runScrape({ maxPlacesPerSearch: parsed.data.maxPlacesPerSearch });
  if (!result.ok) {
    const status = result.error.code === "NO_KEYWORDS" || result.error.code === "NO_CITIES" ? 400 : 500;
    return NextResponse.json({ error: result.error.message, runId: result.error.runId }, { status });
  }

  return NextResponse.json(result.value, { status: 200 });
}
