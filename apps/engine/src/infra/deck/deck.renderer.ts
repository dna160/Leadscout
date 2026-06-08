/**
 * IBUKI-branded PDF deck renderer.
 *
 * Layout: 4 pages
 *   1. Cover        — dark (#0D0D0D) bg, logo, venue name, segment badge
 *   2. Why A5       — cream bg, three stat boxes, brand quote
 *   3. Cut Fit      — white bg, recommended cuts for this venue
 *   4. Offer & CTA  — dark bg, bespoke offer text, next-step CTA, logo
 *
 * Colors: IBUKI_GOLD #C9A96E · dark #0D0D0D · cream #F7F4EF
 * Fonts:  Montserrat SemiBold (headings) + Regular (body) — fallback Helvetica
 */

import { ok, err, type Result } from "../../lib/result";
import { SEGMENT_OFFERS } from "../../domain/outreach";
import type { Lead } from "../../domain/lead";
import {
  getMontserratRegular,
  getMontserratSemiBold,
  getIbukiLogo,
} from "./deck.assets";

export type DeckError = { message: string };

// ── Palette ──────────────────────────────────────────────────────────────────

const C = {
  gold:      "#C9A96E",
  dark:      "#0D0D0D",
  white:     "#FFFFFF",
  cream:     "#F7F4EF",
  body:      "#2A2A2A",
  muted:     "#888888",
  rule:      "#E0DDD8",
  goldLight: "#E8D4A8",
} as const;

// A4 in pdfkit points
const W = 595.28;
const H = 841.89;
const M = 50; // margin

// ── Drawing helpers ───────────────────────────────────────────────────────────

function fillPage(doc: any, color: string) {
  doc.rect(0, 0, W, H).fill(color);
}

function rule(doc: any, y: number, x1 = M, x2 = W - M, color: string = C.gold, width = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(width).stroke();
}

function topBar(doc: any, color: string = C.gold, height = 5) {
  doc.rect(0, 0, W, height).fill(color);
}

function leftBar(doc: any, color: string = C.gold, width = 5) {
  doc.rect(0, 0, width, H).fill(color);
}

function goldDot(doc: any, x: number, y: number, r = 3) {
  doc.circle(x, y, r).fill(C.gold);
}

// Draw the IBUKI text logo (fallback when PNG not available)
function drawTextLogo(doc: any, cx: number, cy: number, font: string, size: "large" | "small") {
  const circleR = size === "large" ? 38 : 20;
  const fontSize = size === "large" ? 18 : 10;
  const subSize = size === "large" ? 9 : 5;
  const gap = size === "large" ? 14 : 8;

  doc.circle(cx, cy, circleR).strokeColor(C.gold).lineWidth(size === "large" ? 1 : 0.7).stroke();
  // Simple mountain silhouette: two overlapping triangles
  const mh = circleR * 0.4;
  const mw = circleR * 0.55;
  doc
    .moveTo(cx - mw, cy + mh * 0.3)
    .lineTo(cx - mw * 0.15, cy - mh)
    .lineTo(cx + mw * 0.45, cy + mh * 0.3)
    .strokeColor(C.gold)
    .lineWidth(size === "large" ? 1.2 : 0.7)
    .stroke();
  doc
    .moveTo(cx - mw * 0.15, cy + mh * 0.3)
    .lineTo(cx + mw * 0.35, cy - mh * 0.65)
    .lineTo(cx + mw, cy + mh * 0.3)
    .strokeColor(C.gold)
    .lineWidth(size === "large" ? 1.2 : 0.7)
    .stroke();
  // IBUKI wordmark below circle
  doc
    .fontSize(fontSize)
    .font(font)
    .fillColor(C.gold)
    .text("IBUKI", cx - circleR * 1.5, cy + circleR + gap, {
      width: circleR * 3,
      align: "center",
      characterSpacing: size === "large" ? 4 : 2,
    });
  // Tagline
  if (size === "large") {
    doc
      .fontSize(subSize)
      .fillColor(C.muted)
      .text("A5 WAGYU JAPAN", cx - circleR * 1.5, cy + circleR + gap + fontSize + 6, {
        width: circleR * 3,
        align: "center",
        characterSpacing: 2,
      });
  }
}

// ── Page 1: Cover ─────────────────────────────────────────────────────────────

function drawCover(
  doc: any,
  lead: Lead,
  segment: string,
  logo: Buffer | null,
  normal: string,
  bold: string,
) {
  fillPage(doc, C.dark);

  // Subtle gold corner accent — top-right triangle
  doc
    .moveTo(W - 120, 0)
    .lineTo(W, 0)
    .lineTo(W, 120)
    .fill(C.gold + "18"); // very faint gold

  let y = 72;

  // Logo
  if (logo) {
    const lw = 110;
    doc.image(logo, (W - lw) / 2, y, { width: lw });
    y += 130;
  } else {
    drawTextLogo(doc, W / 2, y + 40, bold, "large");
    y += 120;
  }

  // Thin gold rule
  rule(doc, y, M + 60, W - M - 60, C.gold, 0.5);
  y += 28;

  // Venue name
  doc
    .fontSize(28)
    .font(bold)
    .fillColor(C.white)
    .text(lead.name, M, y, { width: W - 2 * M, align: "center", lineGap: 2 });
  // Estimate height: ~36pt per line
  const nameLines = Math.ceil(lead.name.length / 28);
  y += nameLines * 36 + 10;

  // City · Category subtitle
  const sub = [lead.city, lead.category].filter(Boolean).join("  ·  ");
  if (sub) {
    doc
      .fontSize(10)
      .font(normal)
      .fillColor(C.muted)
      .text(sub, M, y, { width: W - 2 * M, align: "center" });
    y += 28;
  }

  rule(doc, y, M + 60, W - M - 60, C.gold, 0.5);
  y += 30;

  // Segment badge
  const labels: Record<string, string> = {
    hot: "HOT CLIENT",
    warm: "WARM PROSPECT",
    cold: "NURTURE PROSPECT",
  };
  const badge = labels[segment] ?? segment.toUpperCase();
  const bw = 168;
  const bh = 26;
  const bx = (W - bw) / 2;
  doc.rect(bx, y, bw, bh).fill(C.gold);
  doc
    .fontSize(9)
    .font(bold)
    .fillColor(C.dark)
    .text(badge, bx, y + 8, { width: bw, align: "center", characterSpacing: 1.5 });
  y += 50;

  // Prepared for / date
  const dateStr = new Date().toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc
    .fontSize(8)
    .font(normal)
    .fillColor(C.muted)
    .text("Disiapkan: " + dateStr, M, H - 52, { width: W - 2 * M, align: "center" });

  // Bottom gold rule
  rule(doc, H - 36, 0, W, C.gold, 0.5);

  // Bottom tagline
  doc
    .fontSize(7)
    .font(normal)
    .fillColor(C.muted)
    .text("IBUKI  ·  A5 Wagyu Japan  ·  Distribusi Premium Indonesia", M, H - 26, {
      width: W - 2 * M,
      align: "center",
      characterSpacing: 0.5,
    });
}

// ── Page 2: Why A5 ────────────────────────────────────────────────────────────

function drawWhyA5(doc: any, normal: string, bold: string) {
  fillPage(doc, C.cream);
  leftBar(doc);

  let y = M + 10;

  doc
    .fontSize(22)
    .font(bold)
    .fillColor(C.dark)
    .text("Mengapa A5 Wagyu?", M + 15, y);
  y += 42;

  rule(doc, y, M + 15, W - M, C.rule, 0.5);
  y += 18;

  doc
    .fontSize(11)
    .font(normal)
    .fillColor(C.body)
    .text(
      "A5 adalah grade tertinggi dalam sistem penilaian Wagyu Jepang — " +
        "marbling sempurna dengan BMS (Beef Marbling Standard) 8-12, " +
        "tekstur yang meleleh di mulut, dan cita rasa umami yang tak tertandingi. " +
        "Produk ini telah menjadi daya tarik utama di restoran premium dan " +
        "hotel berbintang di seluruh Asia.",
      M + 15,
      y,
      { width: W - 2 * M - 15, lineGap: 4 },
    );
  y += 90;

  // ── Three stat boxes ──
  const stats = [
    { label: "Marbling Score", value: "BMS 8–12" },
    { label: "Grade Tertinggi", value: "A5" },
    { label: "Sertifikasi", value: "Japan\nWagyu" },
  ];
  const boxW = (W - 2 * M - 15 - 20) / 3;
  const boxH = 76;

  stats.forEach((s, i) => {
    const bx = M + 15 + i * (boxW + 10);
    // Box background
    doc.rect(bx, y, boxW, boxH).fill(C.dark);
    // Gold top accent
    doc.rect(bx, y, boxW, 3).fill(C.gold);
    doc
      .fontSize(18)
      .font(bold)
      .fillColor(C.gold)
      .text(s.value, bx, y + 18, { width: boxW, align: "center" });
    doc
      .fontSize(8)
      .font(normal)
      .fillColor(C.muted)
      .text(s.label, bx, y + 52, { width: boxW, align: "center" });
  });
  y += boxH + 28;

  rule(doc, y, M + 15, W - M, C.rule, 0.5);
  y += 22;

  // Quote block
  doc.rect(M + 15, y, 3, 52).fill(C.gold);
  doc
    .fontSize(13)
    .font(bold)
    .fillColor(C.dark)
    .text(
      "“Marbling sempurna yang meleleh di lidah — pengalaman kuliner yang tak terlupakan.”",
      M + 26,
      y,
      { width: W - 2 * M - 26, lineGap: 4 },
    );
  y += 72;

  rule(doc, y, M + 15, W - M, C.rule, 0.5);
  y += 22;

  // Supply chain footer
  const pillText = ["Impor Langsung dari Jepang", "Rantai Dingin Terjaga", "Keaslian Terjamin"];
  let px = M + 15;
  pillText.forEach(text => {
    const tw = doc.widthOfString(text, { fontSize: 9 }) + 20;
    doc.rect(px, y, tw, 20).fill(C.goldLight + "60");
    goldDot(doc, px + 10, y + 10, 2.5);
    doc.fontSize(9).font(normal).fillColor(C.body).text(text, px + 18, y + 5, { width: tw - 18 });
    px += tw + 10;
  });
}

// ── Page 3: Cut Fit ───────────────────────────────────────────────────────────

function drawCutFit(
  doc: any,
  lead: Lead,
  segment: string,
  contextSnippets: string[],
  normal: string,
  bold: string,
) {
  fillPage(doc, C.white);
  topBar(doc);

  let y = M + 18;

  doc
    .fontSize(22)
    .font(bold)
    .fillColor(C.dark)
    .text("Rekomendasi Potongan", M, y);
  y += 16;
  doc
    .fontSize(11)
    .font(normal)
    .fillColor(C.muted)
    .text(`Disesuaikan untuk ${lead.name}`, M, y);
  y += 36;

  rule(doc, y, M, W - M, C.rule, 0.5);
  y += 18;

  doc
    .fontSize(11)
    .font(normal)
    .fillColor(C.body)
    .text(
      `Berdasarkan konsep dan menu ${lead.name}, kami merekomendasikan ` +
        "potongan A5 Wagyu berikut untuk memaksimalkan pengalaman tamu Bapak/Ibu:",
      M,
      y,
      { width: W - 2 * M, lineGap: 3 },
    );
  y += 48;

  const offer = SEGMENT_OFFERS[segment as "hot" | "warm" | "cold"];

  const cutDetails: Record<string, { en: string; desc: string }> = {
    ribeye:     { en: "Ribeye",              desc: "Marbling intens, cocok untuk steak premium & showcase menu." },
    sirloin:    { en: "Sirloin",             desc: "Seimbang antara kelembutan dan rasa — andalan fine dining." },
    tenderloin: { en: "Tenderloin",          desc: "Paling lembut, ideal untuk tamu yang menginginkan tekstur premium." },
    "chuck-eye":{ en: "Chuck-eye",           desc: "Karakter kuat dengan nilai luar biasa untuk yakiniku showcase." },
    rump:       { en: "Rump",                desc: "Rasa intens, sempurna untuk yakiniku dan shabu-shabu." },
    karubi:     { en: "Karubi (Short Rib)",  desc: "Favorit yakiniku — berlemak, juicy, dan sangat beraroma." },
    brisket:    { en: "Brisket",             desc: "Ideal untuk hidangan slow-cook premium dan menu fusion." },
    gyutan:     { en: "Gyutan (Tongue)",     desc: "Potongan khas izakaya — tekstur unik, rasa ringan dan lezat." },
    harami:     { en: "Harami (Skirt)",      desc: "Rasa daging penuh, populer di yakiniku dan donburi premium." },
    "lemak wagyu":{ en: "Wagyu Fat",         desc: "Sempurna untuk ramen, soba, atau nasi berbumbu wagyu." },
  };

  (offer?.sampleCuts ?? []).forEach((cut, i) => {
    const detail = cutDetails[cut.toLowerCase()];
    const label = detail?.en ?? (cut.charAt(0).toUpperCase() + cut.slice(1));
    const desc = detail?.desc ?? "Potongan premium A5 Wagyu pilihan.";

    if (i > 0) {
      rule(doc, y - 6, M, W - M, "#F0EFED", 0.5);
    }

    // Gold circle bullet
    goldDot(doc, M + 6, y + 7, 4);

    doc.fontSize(13).font(bold).fillColor(C.dark).text(label, M + 20, y, { width: W - 2 * M - 20 });
    y += 20;
    doc.fontSize(10).font(normal).fillColor(C.muted).text(desc, M + 20, y, { width: W - 2 * M - 20, lineGap: 2 });
    y += 28;
  });

  // Context signals footer (if space allows)
  if (contextSnippets.length > 0 && y < H - 130) {
    y += 8;
    rule(doc, y, M, W - M, C.rule, 0.5);
    y += 14;
    doc
      .fontSize(8)
      .font(bold)
      .fillColor(C.muted)
      .text("YANG KAMI KETAHUI TENTANG " + lead.name.toUpperCase(), M, y, {
        characterSpacing: 0.5,
      });
    y += 16;
    const snippet = contextSnippets
      .slice(0, 2)
      .join(" ")
      .slice(0, 280)
      .replace(/\n/g, " ");
    doc
      .fontSize(9)
      .font(normal)
      .fillColor(C.muted)
      .text(snippet + (snippet.length >= 280 ? "…" : ""), M, y, {
        width: W - 2 * M,
        lineGap: 3,
      });
  }
}

// ── Page 4: Offer & CTA ───────────────────────────────────────────────────────

function drawOffer(
  doc: any,
  lead: Lead,
  segment: string,
  logo: Buffer | null,
  normal: string,
  bold: string,
) {
  fillPage(doc, C.dark);

  // Top gold bar
  doc.rect(0, 0, W, 4).fill(C.gold);

  let y = M + 22;

  // Eyebrow label
  doc
    .fontSize(9)
    .font(bold)
    .fillColor(C.gold)
    .text("PENAWARAN EKSKLUSIF", M, y, { width: W - 2 * M, align: "center", characterSpacing: 2 });
  y += 22;

  doc
    .fontSize(24)
    .font(bold)
    .fillColor(C.white)
    .text(`untuk ${lead.name}`, M, y, { width: W - 2 * M, align: "center" });
  y += 48;

  rule(doc, y, M + 50, W - M - 50);
  y += 28;

  // Offer body copy
  const bodies: Record<string, string> = {
    hot:
      `${lead.name} telah membuktikan komitmen dalam menyajikan pengalaman kuliner premium. ` +
      "Kami mengundang Bapak/Ibu untuk sesi tasting eksklusif A5 Wagyu pilihan kami — " +
      "sepenuhnya gratis, tanpa kewajiban. Rasakan langsung marbling dan kelembutan yang akan " +
      "membawa menu Bapak/Ibu ke level berikutnya, lengkap dengan daftar harga dan " +
      "program distribusi fleksibel.",
    warm:
      `${lead.name} memiliki konsep yang sangat tepat untuk menghadirkan A5 Wagyu sebagai ` +
      "premium centerpiece. Kami mengundang Bapak/Ibu untuk sesi tasting gratis, " +
      "dilengkapi daftar harga kompetitif dan panduan penyajian dari tim kami.",
    cold:
      "Kami memiliki program khusus untuk venue seperti " +
      `${lead.name}: sample box potongan premium gyutan dan harami A5 Wagyu — ` +
      "tanpa biaya, lengkap dengan daftar harga dan panduan penyajian. " +
      "Kesempatan terbaik untuk mengeksplorasi potensi A5 Wagyu bagi menu Bapak/Ibu.",
  };
  doc
    .fontSize(12)
    .font(normal)
    .fillColor(C.white)
    .text(bodies[segment] ?? bodies.warm, M, y, {
      width: W - 2 * M,
      lineGap: 5,
      align: "justify",
    });
  y += 130;

  rule(doc, y, M + 50, W - M - 50);
  y += 28;

  // CTA section
  doc
    .fontSize(9)
    .font(bold)
    .fillColor(C.gold)
    .text("LANGKAH SELANJUTNYA", M, y, { width: W - 2 * M, align: "center", characterSpacing: 1.5 });
  y += 20;

  const offer = SEGMENT_OFFERS[segment as "hot" | "warm" | "cold"];
  doc
    .fontSize(14)
    .font(bold)
    .fillColor(C.white)
    .text(offer?.cta ?? "Konfirmasi ketersediaan Bapak/Ibu", M, y, {
      width: W - 2 * M,
      align: "center",
    });
  y += 50;

  rule(doc, y, M + 50, W - M - 50);
  y += 26;

  // Contact details
  doc
    .fontSize(10)
    .font(bold)
    .fillColor(C.goldLight)
    .text("Tim A5 Wagyu Indonesia", M, y, { width: W - 2 * M, align: "center" });
  y += 18;
  doc
    .fontSize(9)
    .font(normal)
    .fillColor(C.muted)
    .text("WhatsApp  ·  Email  ·  Kunjungan Langsung", M, y, {
      width: W - 2 * M,
      align: "center",
    });

  // Logo bottom-right corner
  const logoSize = 52;
  const logoX = W - M - logoSize;
  const logoY = H - M - logoSize - 18;
  if (logo) {
    doc.image(logo, logoX, logoY, { width: logoSize });
  } else {
    drawTextLogo(doc, logoX + logoSize / 2, logoY + logoSize / 2 - 6, bold, "small");
  }

  // Bottom gold rule + legal line
  rule(doc, H - 36, 0, W, C.gold, 0.5);
  doc
    .fontSize(7)
    .font(normal)
    .fillColor(C.muted)
    .text(
      "Dokumen ini bersifat konfidensial dan ditujukan khusus untuk penerima yang tercantum.",
      M,
      H - 26,
      { width: W - 2 * M, align: "center" },
    );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function renderDeck(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
  contextSnippets: string[],
): Promise<Result<string, DeckError>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let PDFDocument: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    PDFDocument = require("pdfkit");
  } catch {
    return err({ message: "pdfkit not installed — deck generation skipped" });
  }

  const [regularFont, semiBoldFont, logo] = await Promise.all([
    getMontserratRegular(),
    getMontserratSemiBold(),
    Promise.resolve(getIbukiLogo()),
  ]);

  const normal = "Helvetica";
  const bold   = "Helvetica-Bold";

  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end",  () => resolve(Buffer.concat(chunks).toString("base64")));
      doc.on("error", reject);

      // Register Montserrat if downloaded successfully
      if (regularFont)  doc.registerFont("MontserratRegular",  regularFont);
      if (semiBoldFont) doc.registerFont("MontserratSemiBold", semiBoldFont);

      const bodyFont    = regularFont  ? "MontserratRegular"  : normal;
      const headingFont = semiBoldFont ? "MontserratSemiBold" : bold;

      // Set default
      doc.font(bodyFont);

      // Page 1 — Cover
      drawCover(doc, lead, segment, logo, bodyFont, headingFont);

      // Page 2 — Why A5
      doc.addPage();
      drawWhyA5(doc, bodyFont, headingFont);

      // Page 3 — Cut fit for this lead
      doc.addPage();
      drawCutFit(doc, lead, segment, contextSnippets, bodyFont, headingFont);

      // Page 4 — Offer & CTA
      doc.addPage();
      drawOffer(doc, lead, segment, logo, bodyFont, headingFont);

      doc.end();
    });

    return ok(base64);
  } catch (e) {
    return err({ message: `PDF render error: ${(e as Error).message}` });
  }
}
