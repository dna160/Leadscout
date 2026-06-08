/**
 * Brand asset loader — reads committed PNGs from apps/engine/assets/deck/
 * and exposes them as base64 data URIs for HTML embedding.
 *
 * Fonts are downloaded from Google at render time via <link> in the HTML;
 * no font download needed here.
 */

import fs from "fs";
import path from "path";

// In Railway the process starts from /app (apps/engine root).
// Locally tsx runs from the package root too.
const ASSETS_DIR = path.join(process.cwd(), "assets", "deck");

const cache = new Map<string, string | null>();

function dataUri(filename: string, mime = "image/png"): string | null {
  if (cache.has(filename)) return cache.get(filename) ?? null;
  const p = path.join(ASSETS_DIR, filename);
  if (!fs.existsSync(p)) {
    cache.set(filename, null);
    return null;
  }
  const uri = `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
  cache.set(filename, uri);
  return uri;
}

export const assetUri = {
  logo:          () => dataUri("ibuki-logo.png"),
  waveMotif:     () => dataUri("wave-motif.png"),
  productPlate:  () => dataUri("product-plate.png"),   // fine dining steak plate
  productRaw:    () => dataUri("product-raw.png"),     // raw A5 block on white
  productTrays:  () => dataUri("product-trays.png"),   // assorted cut trays
  productRetail: () => dataUri("product-retail.png"),  // Japanese retail display
  productGrill:  () => dataUri("product-grill.png"),   // yakiniku grill shot
};
