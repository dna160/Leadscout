/**
 * IBUKI-branded PDF deck renderer — photo-rich premium layout.
 *
 * Page 1 — Cover:      Dark left panel (logo + venue) | Product photo right half
 * Page 2 — Why A5:     Cream bg, text left | Raw wagyu beauty shot right
 * Page 3 — Cut Fit:    Photo banner top | Recommended cuts grid below
 * Page 4 — Offer/CTA:  Dark bg, grill photo strip | Offer copy + CTA + logo
 *
 * Colors: #C9A96E (gold) · #0D0D0D (dark) · #F7F4EF (cream)
 * Fonts:  Montserrat SemiBold + Regular (downloaded); Helvetica fallback
 */

import { ok, err, type Result } from "../../lib/result";
import { SEGMENT_OFFERS } from "../../domain/outreach";
import type { Lead } from "../../domain/lead";
import {
  getMontserratRegular,
  getMontserratSemiBold,
  assets,
} from "./deck.assets";

export type DeckError = { message: string };

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  gold:    "#C9A96E",
  dark:    "#0D0D0D",
  white:   "#FFFFFF",
  cream:   "#F7F4EF",
  body:    "#2A2A2A",
  muted:   "#888888",
  rule:    "#E0DDD8",
} as const;

const W = 595.28;   // A4 width in points
const H = 841.89;   // A4 height
const M = 48;       // margin

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillPage(doc: any, color: string) {
  doc.rect(0, 0, W, H).fill(color);
}

function hRule(doc: any, y: number, x1 = M, x2 = W - M, color: string = C.gold, lw = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke();
}

function vRule(doc: any, x: number, y1 = 0, y2 = H, color: string = C.gold, lw = 1.5) {
  doc.moveTo(x, y1).lineTo(x, y2).strokeColor(color).lineWidth(lw).stroke();
}

function photoPanel(doc: any, buf: Buffer, x: number, y: number, w: number, h: number) {
  try {
    doc.image(buf, x, y, { cover: [w, h], align: "center", valign: "center" });
  } catch {
    // If cover fails (older pdfkit), fall back to fit
    doc.image(buf, x, y, { fit: [w, h], align: "center", valign: "center" });
  }
}

// ── Page 1: Cover ─────────────────────────────────────────────────────────────
//
//  ┌────────────────────────────┬──────────────────────────┐
//  │  dark panel                │  product photo full-bleed│
//  │                            │                          │
//  │  [IBUKI logo]              │                          │
//  │  ─────────────             │                          │
//  │  [Venue Name]              │                          │
//  │  [city · category]         │                          │
//  │  ─────────────             │                          │
//  │  [SEGMENT BADGE]           │                          │
//  │                            │                          │
//  │  date           gold line  │                          │
//  └────────────────────────────┴──────────────────────────┘

function drawCover(doc: any, lead: Lead, segment: string, N: string, B: string) {
  const splitX = W * 0.48;

  // Right: product photo (fine dining plate)
  const photoRight = assets.productPlate();
  if (photoRight) {
    photoPanel(doc, photoRight, splitX, 0, W - splitX, H);
  }

  // Left: dark panel
  doc.rect(0, 0, splitX, H).fill(C.dark);

  // Gold vertical divider
  vRule(doc, splitX, 0, H, C.gold, 2);

  let y = 52;

  // Logo
  const logo = assets.logo();
  if (logo) {
    const lw = 90;
    doc.image(logo, (splitX - lw) / 2, y, { width: lw });
    y += 110;
  } else {
    // Fallback circle mark
    const cx = splitX / 2;
    doc.circle(cx, y + 35, 32).strokeColor(C.gold).lineWidth(1).stroke();
    doc.fontSize(14).font(B).fillColor(C.gold).text("IBUKI", 0, y + 55, { width: splitX, align: "center" });
    y += 90;
  }

  hRule(doc, y, 24, splitX - 24);
  y += 22;

  // Venue name
  doc.fontSize(22).font(B).fillColor(C.white)
    .text(lead.name, 20, y, { width: splitX - 40, align: "center", lineGap: 2 });
  const nameLines = Math.max(1, Math.ceil(lead.name.length / 18));
  y += nameLines * 28 + 8;

  // Subtitle
  const sub = [lead.city, lead.category].filter(Boolean).join("  ·  ");
  if (sub) {
    doc.fontSize(9).font(N).fillColor(C.muted)
      .text(sub, 20, y, { width: splitX - 40, align: "center" });
    y += 22;
  }

  hRule(doc, y, 24, splitX - 24);
  y += 22;

  // Segment badge
  const labels: Record<string, string> = {
    hot: "HOT CLIENT", warm: "WARM PROSPECT", cold: "NURTURE PROSPECT",
  };
  const badge = labels[segment] ?? segment.toUpperCase();
  const bw = Math.min(splitX - 48, 148), bh = 24, bx = (splitX - bw) / 2;
  doc.rect(bx, y, bw, bh).fill(C.gold);
  doc.fontSize(8).font(B).fillColor(C.dark)
    .text(badge, bx, y + 8, { width: bw, align: "center", characterSpacing: 1.2 });
  y += 42;

  // Wave motif watermark above date
  const wave = assets.wavemotif();
  if (wave) {
    try {
      doc.image(wave, 0, H - 120, { width: splitX, opacity: 0.15 });
    } catch { /* opacity may not be supported; skip */ }
  }

  // Date
  const dateStr = new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
  doc.fontSize(7).font(N).fillColor(C.muted)
    .text(dateStr, 20, H - 46, { width: splitX - 40, align: "center" });

  // Bottom gold strip
  doc.rect(0, H - 4, splitX, 4).fill(C.gold);

  // Right-panel caption overlay at bottom
  doc.rect(splitX, H - 36, W - splitX, 36).fill(C.dark + "CC");
  doc.fontSize(7).font(N).fillColor(C.muted)
    .text("A5 Wagyu — Grade Tertinggi Jepang", splitX + 8, H - 24, { width: W - splitX - 16, align: "center" });
}

// ── Page 2: Why A5 ────────────────────────────────────────────────────────────
//
//  ┌──────────────────────────────────────────────────────┐
//  │  ▌ MENGAPA A5 WAGYU?                                │
//  │                                                      │
//  │  [body text]                  [raw wagyu photo]      │
//  │                                                      │
//  │  [BMS] [A5] [Cert] stat boxes                       │
//  │                                                      │
//  │  ╔═ quote ═╗                                        │
//  └──────────────────────────────────────────────────────┘

function drawWhyA5(doc: any, N: string, B: string) {
  fillPage(doc, C.cream);

  // Left gold accent bar
  doc.rect(0, 0, 5, H).fill(C.gold);

  const textW = W * 0.56;
  let y = M + 8;

  doc.fontSize(22).font(B).fillColor(C.dark).text("Mengapa A5 Wagyu?", M + 12, y);
  y += 40;

  hRule(doc, y, M + 12, textW, C.rule);
  y += 16;

  doc.fontSize(11).font(N).fillColor(C.body)
    .text(
      "A5 adalah grade tertinggi dalam sistem penilaian Wagyu Jepang — " +
      "marbling sempurna dengan BMS 8–12, tekstur yang meleleh di mulut, " +
      "dan cita rasa umami yang tak tertandingi. Produk ini menjadi daya " +
      "tarik utama di restoran premium dan hotel berbintang.",
      M + 12, y, { width: textW - M - 12, lineGap: 4 },
    );
  y += 88;

  // Raw product photo — right column
  const rawPhoto = assets.productRaw();
  if (rawPhoto) {
    const ph = 240, px = textW + 8, pw = W - textW - 16;
    photoPanel(doc, rawPhoto, px, M + 8, pw, ph);
    hRule(doc, M + ph + 12, textW + 8, W - 8, C.rule);
  }

  // Stat boxes
  const stats = [
    { label: "Marbling Score", value: "BMS 8–12" },
    { label: "Grade Tertinggi", value: "A5" },
    { label: "Sertifikasi", value: "Japan Wagyu" },
  ];
  const bw = (textW - M - 12 - 16) / 3;
  stats.forEach((s, i) => {
    const bx = M + 12 + i * (bw + 8);
    doc.rect(bx, y, bw, 70).fill(C.dark);
    doc.rect(bx, y, bw, 3).fill(C.gold);
    doc.fontSize(16).font(B).fillColor(C.gold).text(s.value, bx, y + 14, { width: bw, align: "center" });
    doc.fontSize(8).font(N).fillColor(C.muted).text(s.label, bx, y + 48, { width: bw, align: "center" });
  });
  y += 86;

  hRule(doc, y, M + 12, textW, C.rule);
  y += 18;

  // Quote
  doc.rect(M + 12, y, 3, 54).fill(C.gold);
  doc.fontSize(13).font(B).fillColor(C.dark)
    .text(
      "“Marbling sempurna yang meleleh di lidah — pengalaman kuliner yang tak terlupakan.”",
      M + 22, y, { width: textW - M - 22, lineGap: 3 },
    );
  y += 70;

  hRule(doc, y, M + 12, textW, C.rule);
  y += 18;

  // Supply badges
  const badges = ["Impor Langsung dari Jepang", "Rantai Dingin Terjaga", "Keaslian Terjamin"];
  let bx2 = M + 12;
  badges.forEach(txt => {
    const tw = doc.widthOfString(txt, { fontSize: 9 }) + 24;
    doc.rect(bx2, y, tw, 22).fill("#E8D4A860");
    doc.circle(bx2 + 10, y + 11, 2.5).fill(C.gold);
    doc.fontSize(9).font(N).fillColor(C.body).text(txt, bx2 + 18, y + 6, { width: tw });
    bx2 += tw + 8;
  });

  // Additional product trays photo at bottom right
  const traysPhoto = assets.productTrays();
  if (traysPhoto && rawPhoto) {
    const bph = H - (M + 248 + 8) - 24;
    if (bph > 60) {
      const px2 = textW + 8, pw2 = W - textW - 16;
      photoPanel(doc, traysPhoto, px2, M + 248 + 12, pw2, bph);
    }
  }
}

// ── Page 3: Cut Fit ───────────────────────────────────────────────────────────
//
//  ┌──────────────────────────────────────────────────────┐
//  │  [PHOTO BANNER — retail or trays]                   │
//  │══════════════════════════════════════════════════════│
//  │  ▌ REKOMENDASI POTONGAN                            │
//  │  Disesuaikan untuk [venue]                          │
//  │                                                      │
//  │  ◆ Ribeye              ◆ Sirloin                    │
//  │    Desc                  Desc                        │
//  └──────────────────────────────────────────────────────┘

function drawCutFit(
  doc: any, lead: Lead, segment: string, contextSnippets: string[], N: string, B: string,
) {
  fillPage(doc, C.white);

  // Photo banner — top 28% of page
  const bannerH = Math.round(H * 0.28);
  const retailPhoto = assets.productRetail() ?? assets.productTrays();
  if (retailPhoto) {
    photoPanel(doc, retailPhoto, 0, 0, W, bannerH);
    // Dark overlay for text readability
    doc.rect(0, 0, W, bannerH).fill("#00000055");
    // Photo caption
    doc.fontSize(9).font(N).fillColor(C.muted)
      .text("A5 Wagyu — Standar Kualitas Premium Jepang", M, bannerH - 22, { width: W - 2 * M, align: "right" });
  } else {
    doc.rect(0, 0, W, bannerH).fill(C.dark);
  }

  // Gold bottom edge of banner
  doc.rect(0, bannerH, W, 4).fill(C.gold);

  let y = bannerH + 20;

  doc.fontSize(22).font(B).fillColor(C.dark).text("Rekomendasi Potongan", M, y);
  y += 16;
  doc.fontSize(10).font(N).fillColor(C.muted).text("Disesuaikan untuk " + lead.name, M, y);
  y += 28;

  hRule(doc, y, M, W - M, C.rule);
  y += 14;

  doc.fontSize(10).font(N).fillColor(C.body)
    .text(
      `Berdasarkan konsep dan menu ${lead.name}, kami merekomendasikan potongan A5 Wagyu berikut:`,
      M, y, { width: W - 2 * M, lineGap: 2 },
    );
  y += 30;

  const offer = SEGMENT_OFFERS[segment as "hot" | "warm" | "cold"];

  const cutDetails: Record<string, { label: string; desc: string }> = {
    "ribeye":      { label: "Ribeye",             desc: "Marbling intens — ideal untuk steak premium & showcase menu." },
    "sirloin":     { label: "Sirloin",            desc: "Seimbang antara kelembutan dan rasa, andalan fine dining." },
    "tenderloin":  { label: "Tenderloin",          desc: "Paling lembut — tamu fine dining tidak akan kecewa." },
    "chuck-eye":   { label: "Chuck-eye",           desc: "Karakter kuat dengan nilai luar biasa untuk yakiniku." },
    "rump":        { label: "Rump",                desc: "Rasa intens — cocok untuk yakiniku dan shabu-shabu." },
    "karubi":      { label: "Karubi (Short Rib)",  desc: "Favorit yakiniku — juicy, berlemak, dan penuh aroma." },
    "brisket":     { label: "Brisket",             desc: "Ideal untuk hidangan slow-cook premium dan fusion." },
    "gyutan":      { label: "Gyutan (Tongue)",     desc: "Tekstur unik khas izakaya — rasa ringan dan lezat." },
    "harami":      { label: "Harami (Skirt)",      desc: "Rasa penuh, populer di yakiniku dan donburi premium." },
    "lemak wagyu": { label: "Wagyu Fat",           desc: "Sempurna untuk ramen, soba, atau nasi berbumbu wagyu." },
  };

  const cuts = offer?.sampleCuts ?? [];

  // Two-column layout for cuts
  const colW = (W - 2 * M - 16) / 2;
  const col1X = M, col2X = M + colW + 16;
  const leftCuts  = cuts.filter((_, i) => i % 2 === 0);
  const rightCuts = cuts.filter((_, i) => i % 2 === 1);

  const renderCuts = (cutList: string[], x: number, startY: number): number => {
    let cy = startY;
    cutList.forEach((cut, i) => {
      const d = cutDetails[cut.toLowerCase()];
      const label = d?.label ?? (cut.charAt(0).toUpperCase() + cut.slice(1));
      const desc  = d?.desc ?? "Potongan premium A5 Wagyu pilihan.";

      if (i > 0) {
        hRule(doc, cy - 4, x, x + colW, "#F0EFED");
      }
      doc.circle(x + 5, cy + 7, 3.5).fill(C.gold);
      doc.fontSize(12).font(B).fillColor(C.dark).text(label, x + 16, cy, { width: colW - 16 });
      cy += 18;
      doc.fontSize(9).font(N).fillColor(C.muted).text(desc, x + 16, cy, { width: colW - 16, lineGap: 2 });
      cy += 26;
    });
    return cy;
  };

  const yLeft  = renderCuts(leftCuts,  col1X, y);
  const yRight = renderCuts(rightCuts, col2X, y);
  y = Math.max(yLeft, yRight) + 8;

  // Context signals footer
  if (contextSnippets.length > 0 && y < H - 90) {
    hRule(doc, y, M, W - M, C.rule);
    y += 12;
    doc.fontSize(8).font(B).fillColor(C.muted)
      .text("APA YANG KAMI KETAHUI TENTANG " + lead.name.toUpperCase(), M, y, { characterSpacing: 0.4 });
    y += 14;
    const snippet = contextSnippets.slice(0, 2).join(" ").slice(0, 260);
    doc.fontSize(9).font(N).fillColor(C.muted)
      .text(snippet + (snippet.length >= 260 ? "…" : ""), M, y, { width: W - 2 * M, lineGap: 3 });
  }
}

// ── Page 4: Offer & CTA ───────────────────────────────────────────────────────
//
//  ┌──────────────────────────────────────────────────────┐
//  │  [YAKINIKU GRILL PHOTO STRIP — top 22%]             │
//  │══════════════════════════════════════════════════════│
//  │  PENAWARAN EKSKLUSIF                                │
//  │  untuk [VENUE]                                      │
//  │                                                      │
//  │  [offer body copy]                                  │
//  │                                                      │
//  │  ══════════════ LANGKAH SELANJUTNYA ═══════════════ │
//  │  [CTA text]                                         │
//  │                                          [logo]     │
//  └──────────────────────────────────────────────────────┘

function drawOffer(doc: any, lead: Lead, segment: string, N: string, B: string) {
  fillPage(doc, C.dark);

  // Grill photo strip — top 24%
  const stripH = Math.round(H * 0.24);
  const grillPhoto = assets.productGrill();
  if (grillPhoto) {
    photoPanel(doc, grillPhoto, 0, 0, W, stripH);
    // Gradient-like dark overlay from bottom of strip
    doc.rect(0, stripH - 40, W, 40).fill("#0D0D0DAA");
  } else {
    doc.rect(0, 0, W, stripH).fill("#1A1A1A");
  }

  // Gold bar below strip
  doc.rect(0, stripH, W, 4).fill(C.gold);

  let y = stripH + 22;

  // Eyebrow
  doc.fontSize(9).font(B).fillColor(C.gold)
    .text("PENAWARAN EKSKLUSIF", M, y, { width: W - 2 * M, align: "center", characterSpacing: 2 });
  y += 20;

  // Venue name
  doc.fontSize(24).font(B).fillColor(C.white)
    .text("untuk " + lead.name, M, y, { width: W - 2 * M, align: "center" });
  y += 44;

  hRule(doc, y, M + 40, W - M - 40);
  y += 22;

  // Offer copy
  const copies: Record<string, string> = {
    hot:
      `${lead.name} telah membuktikan komitmen dalam menyajikan pengalaman kuliner premium. ` +
      "Kami mengundang Bapak/Ibu untuk sesi tasting eksklusif A5 Wagyu pilihan — " +
      "sepenuhnya gratis, tanpa kewajiban. Rasakan langsung marbling sempurna yang akan " +
      "membawa menu Bapak/Ibu ke level berikutnya, lengkap dengan daftar harga dan program distribusi.",
    warm:
      `${lead.name} memiliki konsep yang tepat untuk menghadirkan A5 Wagyu sebagai premium ` +
      "centerpiece. Kami mengundang Bapak/Ibu untuk sesi tasting gratis, dilengkapi daftar " +
      "harga kompetitif dan panduan penyajian dari tim kami.",
    cold:
      "Kami memiliki program khusus untuk venue seperti " +
      `${lead.name}: sample box potongan premium gyutan dan harami A5 Wagyu — tanpa biaya, ` +
      "lengkap dengan daftar harga dan panduan penyajian. Eksplorasi potensi A5 Wagyu tanpa risiko.",
  };
  doc.fontSize(11.5).font(N).fillColor(C.white)
    .text(copies[segment] ?? copies.warm, M, y, {
      width: W - 2 * M, lineGap: 5, align: "justify",
    });
  y += 112;

  hRule(doc, y, M + 40, W - M - 40);
  y += 22;

  // CTA section
  doc.fontSize(8).font(B).fillColor(C.gold)
    .text("LANGKAH SELANJUTNYA", M, y, { width: W - 2 * M, align: "center", characterSpacing: 1.5 });
  y += 18;

  const offer = SEGMENT_OFFERS[segment as "hot" | "warm" | "cold"];
  doc.fontSize(14).font(B).fillColor(C.white)
    .text(offer?.cta ?? "Konfirmasi ketersediaan Bapak/Ibu", M, y, { width: W - 2 * M, align: "center" });
  y += 44;

  hRule(doc, y, M + 40, W - M - 40);
  y += 22;

  // Contact
  doc.fontSize(10).font(B).fillColor("#E8D4A8").text("Tim A5 Wagyu Indonesia", M, y, { width: W - 2 * M, align: "center" });
  y += 16;
  doc.fontSize(9).font(N).fillColor(C.muted)
    .text("WhatsApp  ·  Email  ·  Kunjungan Langsung", M, y, { width: W - 2 * M, align: "center" });

  // Logo bottom right
  const logo = assets.logo();
  const lw = 56;
  const lx = W - M - lw;
  const ly = H - M - lw - 10;
  if (logo) {
    doc.image(logo, lx, ly, { width: lw });
  } else {
    doc.circle(lx + lw / 2, ly + lw / 2, 24).strokeColor(C.gold).lineWidth(0.8).stroke();
    doc.fontSize(10).font(B).fillColor(C.gold).text("IBUKI", lx, ly + lw / 2 + 8, { width: lw, align: "center" });
  }

  // Bottom strip
  doc.rect(0, H - 4, W, 4).fill(C.gold);
  doc.fontSize(7).font(N).fillColor(C.muted)
    .text(
      "Dokumen ini bersifat konfidensial dan ditujukan khusus untuk penerima yang tercantum.",
      M, H - 22, { width: W - 2 * M, align: "center" },
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
    return err({ message: "pdfkit not installed" });
  }

  const [regularFont, semiBoldFont] = await Promise.all([
    getMontserratRegular(),
    getMontserratSemiBold(),
  ]);

  const N = regularFont  ? "MontserratRegular"  : "Helvetica";
  const B = semiBoldFont ? "MontserratSemiBold" : "Helvetica-Bold";

  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];

      doc.on("data",  (chunk: Buffer) => chunks.push(chunk));
      doc.on("end",   () => resolve(Buffer.concat(chunks).toString("base64")));
      doc.on("error", reject);

      if (regularFont)  doc.registerFont("MontserratRegular",  regularFont);
      if (semiBoldFont) doc.registerFont("MontserratSemiBold", semiBoldFont);
      doc.font(N);

      // Page 1 — Cover
      drawCover(doc, lead, segment, N, B);

      // Page 2 — Why A5
      doc.addPage();
      drawWhyA5(doc, N, B);

      // Page 3 — Cut fit
      doc.addPage();
      drawCutFit(doc, lead, segment, contextSnippets, N, B);

      // Page 4 — Offer & CTA
      doc.addPage();
      drawOffer(doc, lead, segment, N, B);

      doc.end();
    });

    return ok(base64);
  } catch (e) {
    return err({ message: `PDF render error: ${(e as Error).message}` });
  }
}
