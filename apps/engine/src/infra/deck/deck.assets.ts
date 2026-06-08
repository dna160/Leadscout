/**
 * Brand asset loader for IBUKI deck generation.
 *
 * Fonts: downloaded once from GitHub on first render, cached in-process.
 * Images: read from apps/engine/assets/deck/ at runtime (committed to git).
 */

import fs from "fs";
import path from "path";
import { logger } from "../../lib/logger";

const ASSETS_DIR = path.join(process.cwd(), "assets", "deck");

const FONT_URLS = {
  regular:
    "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf",
  semibold:
    "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-SemiBold.ttf",
};

// Process-lifetime caches
let montserratRegular: Buffer | null | "failed" = null;
let montserratSemiBold: Buffer | null | "failed" = null;
const imageCache = new Map<string, Buffer | null>();

async function fetchFont(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    logger.warn({ url, err: (e as Error).message }, "Font download failed — using Helvetica fallback");
    return null;
  }
}

function loadImage(filename: string): Buffer | null {
  if (imageCache.has(filename)) return imageCache.get(filename) ?? null;
  const p = path.join(ASSETS_DIR, filename);
  const buf = fs.existsSync(p) ? fs.readFileSync(p) : null;
  imageCache.set(filename, buf);
  return buf;
}

// ── Font loaders ──────────────────────────────────────────────────────────────

export async function getMontserratRegular(): Promise<Buffer | null> {
  if (montserratRegular === "failed") return null;
  if (montserratRegular) return montserratRegular;
  const buf = await fetchFont(FONT_URLS.regular);
  montserratRegular = buf ?? "failed";
  if (buf) logger.info("Montserrat Regular loaded");
  return buf;
}

export async function getMontserratSemiBold(): Promise<Buffer | null> {
  if (montserratSemiBold === "failed") return null;
  if (montserratSemiBold) return montserratSemiBold;
  const buf = await fetchFont(FONT_URLS.semibold);
  montserratSemiBold = buf ?? "failed";
  if (buf) logger.info("Montserrat SemiBold loaded");
  return buf;
}

// ── Image loaders ─────────────────────────────────────────────────────────────

export const assets = {
  logo:        () => loadImage("ibuki-logo.png"),
  wavemotif:   () => loadImage("wave-motif.png"),
  productPlate:  () => loadImage("product-plate.png"),   // fine dining steak plate
  productRaw:    () => loadImage("product-raw.png"),     // raw A5 block, white bg
  productTrays:  () => loadImage("product-trays.png"),   // assorted cut trays
  productRetail: () => loadImage("product-retail.png"),  // Japanese retail display
  productGrill:  () => loadImage("product-grill.png"),   // yakiniku grill shot
};
