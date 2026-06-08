/**
 * Brand asset loader for IBUKI deck generation.
 * Fonts are downloaded once from GitHub on first call and cached in memory.
 * Logo PNG is read from disk (apps/engine/assets/deck/ibuki-logo.png) if present.
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

// Module-level cache — downloaded once per process lifetime
let montserratRegular: Buffer | null | "failed" = null;
let montserratSemiBold: Buffer | null | "failed" = null;
let ibukiLogo: Buffer | null | "not-found" = null;

async function fetchFont(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    logger.warn({ url, err: (e as Error).message }, "Font download failed");
    return null;
  }
}

export async function getMontserratRegular(): Promise<Buffer | null> {
  if (montserratRegular === "failed") return null;
  if (montserratRegular) return montserratRegular;
  const buf = await fetchFont(FONT_URLS.regular);
  montserratRegular = buf ?? "failed";
  if (buf) logger.info("Montserrat Regular font loaded");
  return buf;
}

export async function getMontserratSemiBold(): Promise<Buffer | null> {
  if (montserratSemiBold === "failed") return null;
  if (montserratSemiBold) return montserratSemiBold;
  const buf = await fetchFont(FONT_URLS.semibold);
  montserratSemiBold = buf ?? "failed";
  if (buf) logger.info("Montserrat SemiBold font loaded");
  return buf;
}

export function getIbukiLogo(): Buffer | null {
  if (ibukiLogo === "not-found") return null;
  if (ibukiLogo) return ibukiLogo;
  const logoPath = path.join(ASSETS_DIR, "ibuki-logo.png");
  if (fs.existsSync(logoPath)) {
    ibukiLogo = fs.readFileSync(logoPath);
    logger.info("IBUKI logo loaded from disk");
    return ibukiLogo;
  }
  ibukiLogo = "not-found";
  return null;
}

export function getProductPhoto(name: string): Buffer | null {
  const filePath = path.join(ASSETS_DIR, name);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}
