/**
 * Puppeteer-based PDF renderer for the IBUKI deck.
 *
 * Strategy:
 *  - Build a self-contained HTML string with all images as base64 data URIs
 *  - Launch headless Chromium (system binary in Docker, local Chrome in dev)
 *  - Render HTML → A4 PDF with printBackground: true
 *  - Return the PDF as a base64 string for storage in lead_assets.content
 *
 * Browser singleton is kept alive between calls to avoid ~2s spawn overhead.
 */

import { ok, err, type Result } from "../../lib/result";
import { logger } from "../../lib/logger";
import type { Lead } from "../../domain/lead";
import { buildDeckHtml } from "./deck.html";

export type DeckError = { message: string };

// ── Browser singleton ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _browser: any | null = null;

function chromePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  // Alpine Linux (Railway Docker)
  return "/usr/bin/chromium-browser";
}

async function getBrowser(): Promise<any> {
  if (_browser?.connected) return _browser;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require("puppeteer-core");
  const executablePath = chromePath();

  logger.info({ executablePath }, "Launching Chromium for PDF generation");

  _browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  });

  _browser.on("disconnected", () => {
    logger.warn("Chromium disconnected — will relaunch on next render");
    _browser = null;
  });

  return _browser;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function renderDeck(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
  contextSnippets: string[],
): Promise<Result<string, DeckError>> {
  try {
    const html = buildDeckHtml(lead, segment, contextSnippets);

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 794, height: 1123 }); // A4 at 96dpi
      await page.setContent(html, { waitUntil: "networkidle2", timeout: 30_000 });

      const pdfResult = await page.pdf({
        format: "A4",
        printBackground: true,  // essential for dark backgrounds and photos
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      // puppeteer-core v21+ returns Uint8Array, not Buffer.
      // Buffer.from() handles both correctly; never call .toString('base64') on Uint8Array directly.
      const pdfBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : Buffer.from(pdfResult);

      logger.info({ leadId: lead.id, bytes: pdfBuffer.length }, "PDF rendered via Puppeteer");
      return ok(pdfBuffer.toString("base64"));
    } finally {
      await page.close();
    }
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ leadId: lead.id, err: msg }, "Puppeteer PDF render failed");
    return err({ message: `PDF render failed: ${msg}` });
  }
}
