/**
 * IBUKI deck HTML template.
 * Returns a self-contained HTML string with all images embedded as base64
 * data URIs — no external dependencies except Google Fonts (loaded at render).
 *
 * 4 A4 pages via `page-break-after: always`:
 *   1. Cover   — dark left panel | product photo right
 *   2. Why A5  — text + stat boxes left | raw wagyu photo right
 *   3. Cut Fit — retail photo banner | two-column cuts grid
 *   4. Offer   — grill photo strip | offer copy + CTA + logo
 */

import { SEGMENT_OFFERS } from "../../domain/outreach";
import type { Lead } from "../../domain/lead";
import { assetUri } from "./deck.assets";

const G = {
  gold:  "#C9A96E",
  dark:  "#0D0D0D",
  white: "#FFFFFF",
  cream: "#F7F4EF",
  body:  "#2A2A2A",
  muted: "#888888",
  rule:  "#E0DDD8",
};

const CUT_DETAILS: Record<string, { label: string; desc: string }> = {
  "ribeye":       { label: "Ribeye",            desc: "Marbling intens — ideal untuk steak premium & showcase menu." },
  "sirloin":      { label: "Sirloin",           desc: "Seimbang kelembutan dan rasa, andalan fine dining." },
  "tenderloin":   { label: "Tenderloin",         desc: "Paling lembut — sempurna untuk tamu fine dining." },
  "chuck-eye":    { label: "Chuck-eye",          desc: "Karakter kuat, nilai luar biasa untuk yakiniku." },
  "rump":         { label: "Rump",               desc: "Rasa intens — cocok untuk yakiniku dan shabu-shabu." },
  "karubi":       { label: "Karubi (Short Rib)", desc: "Favorit yakiniku — juicy, berlemak, penuh aroma." },
  "brisket":      { label: "Brisket",            desc: "Ideal untuk slow-cook premium dan menu fusion." },
  "gyutan":       { label: "Gyutan (Tongue)",    desc: "Tekstur unik khas izakaya, rasa ringan dan lezat." },
  "harami":       { label: "Harami (Skirt)",     desc: "Rasa penuh, populer di yakiniku dan donburi premium." },
  "lemak wagyu":  { label: "Wagyu Fat",          desc: "Sempurna untuk ramen, soba, atau nasi berbumbu wagyu." },
};

const OFFER_BODY: Record<string, string> = {
  hot: `{venue} telah membuktikan komitmen dalam menyajikan pengalaman kuliner premium.
Kami mengundang Bapak/Ibu untuk sesi tasting eksklusif A5 Wagyu pilihan kami —
sepenuhnya gratis, tanpa kewajiban. Rasakan langsung marbling sempurna yang akan
membawa menu Bapak/Ibu ke level berikutnya, lengkap dengan daftar harga dan
program distribusi yang fleksibel.`,
  warm: `{venue} memiliki konsep yang sangat tepat untuk menghadirkan A5 Wagyu
sebagai premium centerpiece. Kami mengundang Bapak/Ibu untuk sesi tasting gratis,
dilengkapi daftar harga kompetitif dan panduan penyajian lengkap dari tim kami.`,
  cold: `Kami memiliki program khusus untuk venue seperti {venue}: sample box
potongan premium gyutan dan harami A5 Wagyu — tanpa biaya, lengkap dengan
daftar harga dan panduan penyajian. Eksplorasi potensi A5 Wagyu tanpa risiko.`,
};

const SEG_LABELS: Record<string, string> = {
  hot: "HOT CLIENT", warm: "WARM PROSPECT", cold: "NURTURE PROSPECT",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function img(uri: string | null, cls: string, alt = ""): string {
  if (!uri) return `<div class="${cls}-placeholder"></div>`;
  return `<img class="${cls}" src="${uri}" alt="${esc(alt)}" loading="eager">`;
}

export function buildDeckHtml(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
  contextSnippets: string[],
): string {
  const offer   = SEGMENT_OFFERS[segment];
  const logo    = assetUri.logo();
  const plate   = assetUri.productPlate();
  const rawWagyu = assetUri.productRaw();
  const trays   = assetUri.productTrays();
  const retail  = assetUri.productRetail();
  const grill   = assetUri.productGrill();

  const venue   = esc(lead.name);
  const sub     = esc([lead.city, lead.category].filter(Boolean).join("  ·  "));
  const badge   = esc(SEG_LABELS[segment] ?? segment.toUpperCase());
  const dateStr = new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });

  const cuts = offer?.sampleCuts ?? [];
  const leftCuts  = cuts.filter((_, i) => i % 2 === 0);
  const rightCuts = cuts.filter((_, i) => i % 2 === 1);

  const renderCut = (cut: string) => {
    const d = CUT_DETAILS[cut.toLowerCase()];
    const label = d?.label ?? (cut.charAt(0).toUpperCase() + cut.slice(1));
    const desc  = d?.desc  ?? "Potongan premium A5 Wagyu pilihan.";
    return `
      <div class="cut-item">
        <div class="cut-name"><span class="cut-dot"></span>${esc(label)}</div>
        <div class="cut-desc">${esc(desc)}</div>
      </div>`;
  };

  const ctxSnippet = contextSnippets.slice(0, 2).join(" ").slice(0, 280);
  const offerBody  = (OFFER_BODY[segment] ?? OFFER_BODY.warm)
    .replace(/{venue}/g, venue)
    .split("\n").join("<br>");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  html, body { width: 210mm; background: #fff; }
  body { font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif; }

  .page {
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    position: relative;
    page-break-after: always;
  }
  .page:last-child { page-break-after: avoid; }

  /* ── COVER ────────────────────────────────────────────────── */
  .cover { background: ${G.dark}; }

  .cover-photo {
    position: absolute; right: 0; top: 0;
    width: 55%; height: 100%;
    object-fit: cover; object-position: center;
  }
  .cover-photo-placeholder {
    position: absolute; right: 0; top: 0;
    width: 55%; height: 100%;
    background: #1a1a1a;
  }

  .cover-divider {
    position: absolute; left: 45%; top: 0;
    width: 2.5px; height: 100%;
    background: ${G.gold}; z-index: 3;
  }

  .cover-left {
    position: absolute; left: 0; top: 0;
    width: 45%; height: 100%;
    background: ${G.dark};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 36px 28px; z-index: 2;
  }

  .cover-logo { width: 96px; height: 96px; object-fit: contain; }
  .cover-logo-placeholder {
    width: 80px; height: 80px; border-radius: 50%;
    border: 1.5px solid ${G.gold};
    display: flex; align-items: center; justify-content: center;
    color: ${G.gold}; font-size: 14px; font-weight: 700;
    letter-spacing: 2px;
  }

  .cover-rule { width: 100%; height: 0.5px; background: ${G.gold}; margin: 18px 0; }

  .cover-venue {
    font-size: 21px; font-weight: 700; color: ${G.white};
    text-align: center; line-height: 1.35;
  }
  .cover-city {
    font-size: 10px; color: ${G.muted};
    text-align: center; margin-top: 9px; letter-spacing: 0.3px;
  }
  .cover-badge {
    background: ${G.gold}; color: ${G.dark};
    font-size: 9px; font-weight: 700;
    letter-spacing: 1.5px; padding: 8px 28px;
    margin-top: 18px;
  }
  .cover-date {
    position: absolute; bottom: 14px; left: 0; width: 45%;
    text-align: center; font-size: 8px; color: #555;
  }
  .cover-bottom { position: absolute; bottom: 0; left: 0; width: 45%; height: 4px; background: ${G.gold}; }
  .cover-caption {
    position: absolute; bottom: 0; right: 0; width: 55%;
    background: rgba(13,13,13,0.8); color: ${G.muted};
    font-size: 7.5px; padding: 6px 12px; text-align: center;
  }

  /* ── WHY A5 ───────────────────────────────────────────────── */
  .why { background: ${G.cream}; padding: 44px 44px 32px 52px; }
  .why-left-bar {
    position: absolute; left: 0; top: 0;
    width: 5px; height: 100%; background: ${G.gold};
  }
  .why-heading { font-size: 23px; font-weight: 700; color: ${G.dark}; margin-bottom: 12px; }
  .why-rule { height: 0.5px; background: ${G.rule}; margin-bottom: 14px; }
  .why-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .why-body { font-size: 11px; line-height: 1.75; color: ${G.body}; margin-bottom: 20px; }

  .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
  .stat-box {
    background: ${G.dark}; padding: 14px 8px 11px;
    text-align: center; position: relative;
  }
  .stat-box::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 3px; background: ${G.gold};
  }
  .stat-val { display: block; font-size: 16px; font-weight: 700; color: ${G.gold}; }
  .stat-lbl { display: block; font-size: 8px; color: ${G.muted}; margin-top: 7px; }

  .quote-block { border-left: 3px solid ${G.gold}; padding: 10px 0 10px 14px; margin-bottom: 16px; }
  .quote-text { font-size: 12.5px; font-weight: 700; color: ${G.dark}; line-height: 1.55; font-style: italic; }

  .supply-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .supply-pill {
    background: rgba(201,169,110,0.18); padding: 5px 12px;
    font-size: 9px; color: ${G.body};
    display: flex; align-items: center; gap: 6px;
  }
  .supply-pill::before {
    content: ''; width: 6px; height: 6px;
    border-radius: 50%; background: ${G.gold}; flex-shrink: 0;
  }

  .why-photos { display: flex; flex-direction: column; gap: 10px; }
  .why-raw { width: 100%; flex: 0 0 52%; object-fit: contain; background: transparent; }
  .why-raw-placeholder { width: 100%; flex: 0 0 52%; background: #e8e4df; }
  .why-trays { width: 100%; flex: 1; object-fit: cover; }
  .why-trays-placeholder { width: 100%; flex: 1; background: #dedad5; }

  /* ── CUT FIT ──────────────────────────────────────────────── */
  .cutfit { background: ${G.white}; }
  .cut-banner { display: block; width: 100%; height: 28%; object-fit: cover; object-position: center 40%; }
  .cut-banner-placeholder { width: 100%; height: 28%; background: ${G.dark}; }
  .cut-gold-bar { width: 100%; height: 4px; background: ${G.gold}; }
  .cut-body { padding: 18px 44px 20px; }
  .cut-heading { font-size: 22px; font-weight: 700; color: ${G.dark}; }
  .cut-sub { font-size: 10px; color: ${G.muted}; margin-top: 3px; margin-bottom: 10px; }
  .cut-rule { height: 0.5px; background: ${G.rule}; margin-bottom: 10px; }
  .cut-intro { font-size: 10.5px; color: ${G.body}; line-height: 1.6; margin-bottom: 14px; }
  .cut-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .cut-col { display: flex; flex-direction: column; }
  .cut-item { padding: 7px 0; border-bottom: 0.5px solid #f0efed; }
  .cut-name {
    font-size: 12px; font-weight: 700; color: ${G.dark};
    display: flex; align-items: center; gap: 8px;
  }
  .cut-dot { width: 7px; height: 7px; border-radius: 50%; background: ${G.gold}; flex-shrink: 0; }
  .cut-desc { font-size: 9px; color: ${G.muted}; line-height: 1.5; margin-top: 3px; padding-left: 15px; }
  .ctx-section { margin-top: 14px; padding-top: 10px; border-top: 0.5px solid ${G.rule}; }
  .ctx-label { font-size: 8px; font-weight: 700; color: ${G.muted}; letter-spacing: 0.5px; margin-bottom: 5px; }
  .ctx-text { font-size: 9px; color: ${G.muted}; line-height: 1.6; }

  /* ── OFFER ────────────────────────────────────────────────── */
  .offer { background: ${G.dark}; }
  .grill-photo { display: block; width: 100%; height: 24%; object-fit: cover; object-position: center; }
  .grill-placeholder { width: 100%; height: 24%; background: #1a1a1a; }
  .offer-gold-bar { width: 100%; height: 4px; background: ${G.gold}; }
  .offer-body {
    padding: 22px 48px 20px;
    height: calc(76% - 4px);
    display: flex; flex-direction: column;
    position: relative;
  }
  .offer-eyebrow {
    font-size: 9px; font-weight: 700; color: ${G.gold};
    letter-spacing: 2px; text-align: center; margin-bottom: 8px;
  }
  .offer-title {
    font-size: 23px; font-weight: 700; color: ${G.white};
    text-align: center; margin-bottom: 18px; line-height: 1.3;
  }
  .offer-hrule { height: 0.5px; background: ${G.gold}; width: calc(100% - 80px); margin: 0 auto 18px; }
  .offer-copy {
    font-size: 11.5px; color: ${G.white};
    line-height: 1.85; text-align: justify; margin-bottom: 18px; flex: 1;
  }
  .cta-box {
    border-top: 0.5px solid #333; border-bottom: 0.5px solid #333;
    padding: 14px 0; text-align: center; margin-bottom: 18px;
  }
  .cta-label { font-size: 8px; font-weight: 700; color: ${G.gold}; letter-spacing: 1.5px; margin-bottom: 7px; }
  .cta-text { font-size: 14px; font-weight: 700; color: ${G.white}; }
  .offer-contact { text-align: center; }
  .contact-name { font-size: 10px; font-weight: 700; color: #E8D4A8; margin-bottom: 4px; }
  .contact-ch { font-size: 9px; color: #555; }
  .offer-logo {
    position: absolute; bottom: 42px; right: 44px;
    width: 58px; object-fit: contain;
  }
  .offer-logo-fallback {
    position: absolute; bottom: 42px; right: 44px;
    width: 52px; height: 52px; border-radius: 50%;
    border: 1.5px solid ${G.gold};
    display: flex; align-items: center; justify-content: center;
    color: ${G.gold}; font-size: 9px; font-weight: 700; letter-spacing: 1px;
  }
  .offer-bottom-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: ${G.gold}; }
  .offer-legal {
    position: absolute; bottom: 8px; left: 0; right: 0;
    text-align: center; font-size: 7px; color: #3a3a3a;
  }
</style>
</head>
<body>

<!-- ══════════════ PAGE 1: COVER ══════════════ -->
<div class="page cover">
  ${plate
    ? `<img class="cover-photo" src="${plate}" alt="A5 Wagyu">`
    : `<div class="cover-photo-placeholder"></div>`}
  <div class="cover-divider"></div>
  <div class="cover-left">
    ${logo
      ? `<img class="cover-logo" src="${logo}" alt="IBUKI">`
      : `<div class="cover-logo-placeholder">IBUKI</div>`}
    <div class="cover-rule"></div>
    <h1 class="cover-venue">${venue}</h1>
    ${sub ? `<p class="cover-city">${sub}</p>` : ""}
    <div class="cover-rule"></div>
    <div class="cover-badge">${badge}</div>
  </div>
  <div class="cover-date">Disiapkan: ${esc(dateStr)}</div>
  <div class="cover-bottom"></div>
  <div class="cover-caption">A5 Wagyu — Grade Tertinggi Jepang</div>
</div>

<!-- ══════════════ PAGE 2: WHY A5 ══════════════ -->
<div class="page why">
  <div class="why-left-bar"></div>
  <h2 class="why-heading">Mengapa A5 Wagyu?</h2>
  <div class="why-rule"></div>
  <div class="why-grid">
    <div>
      <p class="why-body">
        A5 adalah grade tertinggi dalam sistem penilaian Wagyu Jepang — marbling sempurna
        dengan BMS 8–12, tekstur yang meleleh di mulut, dan cita rasa umami yang tak
        tertandingi. Produk ini telah menjadi daya tarik utama di restoran premium dan
        hotel berbintang di seluruh Asia.
      </p>
      <div class="stat-row">
        <div class="stat-box"><span class="stat-val">BMS 8–12</span><span class="stat-lbl">Marbling Score</span></div>
        <div class="stat-box"><span class="stat-val">A5</span><span class="stat-lbl">Grade Tertinggi</span></div>
        <div class="stat-box"><span class="stat-val">Japan</span><span class="stat-lbl">Sertifikasi Wagyu</span></div>
      </div>
      <div class="why-rule"></div>
      <div class="quote-block">
        <p class="quote-text">"Marbling sempurna yang meleleh di lidah — pengalaman kuliner yang tak terlupakan."</p>
      </div>
      <div class="why-rule"></div>
      <div class="supply-row">
        <div class="supply-pill">Impor Langsung dari Jepang</div>
        <div class="supply-pill">Rantai Dingin Terjaga</div>
        <div class="supply-pill">Keaslian Terjamin</div>
      </div>
    </div>
    <div class="why-photos">
      ${rawWagyu
        ? `<img class="why-raw" src="${rawWagyu}" alt="A5 Wagyu">`
        : `<div class="why-raw-placeholder"></div>`}
      ${trays
        ? `<img class="why-trays" src="${trays}" alt="Wagyu cuts">`
        : `<div class="why-trays-placeholder"></div>`}
    </div>
  </div>
</div>

<!-- ══════════════ PAGE 3: CUT FIT ══════════════ -->
<div class="page cutfit">
  ${retail
    ? `<img class="cut-banner" src="${retail}" alt="Wagyu display">`
    : `<div class="cut-banner-placeholder"></div>`}
  <div class="cut-gold-bar"></div>
  <div class="cut-body">
    <h2 class="cut-heading">Rekomendasi Potongan</h2>
    <p class="cut-sub">Disesuaikan untuk ${venue}</p>
    <div class="cut-rule"></div>
    <p class="cut-intro">
      Berdasarkan konsep dan menu ${venue}, kami merekomendasikan potongan A5 Wagyu berikut:
    </p>
    <div class="cut-grid">
      <div class="cut-col">${leftCuts.map(renderCut).join("")}</div>
      <div class="cut-col">${rightCuts.map(renderCut).join("")}</div>
    </div>
    ${ctxSnippet ? `
    <div class="ctx-section">
      <div class="ctx-label">APA YANG KAMI KETAHUI TENTANG ${venue.toUpperCase()}</div>
      <p class="ctx-text">${esc(ctxSnippet)}${ctxSnippet.length >= 280 ? "…" : ""}</p>
    </div>` : ""}
  </div>
</div>

<!-- ══════════════ PAGE 4: OFFER ══════════════ -->
<div class="page offer">
  ${grill
    ? `<img class="grill-photo" src="${grill}" alt="A5 Wagyu yakiniku">`
    : `<div class="grill-placeholder"></div>`}
  <div class="offer-gold-bar"></div>
  <div class="offer-body">
    <p class="offer-eyebrow">PENAWARAN EKSKLUSIF</p>
    <h2 class="offer-title">untuk ${venue}</h2>
    <div class="offer-hrule"></div>
    <p class="offer-copy">${offerBody}</p>
    <div class="cta-box">
      <div class="cta-label">LANGKAH SELANJUTNYA</div>
      <div class="cta-text">${esc(offer?.cta ?? "Konfirmasi ketersediaan Bapak/Ibu")}</div>
    </div>
    <div class="offer-contact">
      <div class="contact-name">Tim A5 Wagyu Indonesia</div>
      <div class="contact-ch">WhatsApp  ·  Email  ·  Kunjungan Langsung</div>
    </div>
    ${logo
      ? `<img class="offer-logo" src="${logo}" alt="IBUKI">`
      : `<div class="offer-logo-fallback">IBUKI</div>`}
    <div class="offer-bottom-bar"></div>
    <div class="offer-legal">Dokumen ini bersifat konfidensial dan ditujukan khusus untuk penerima yang tercantum.</div>
  </div>
</div>

</body>
</html>`;
}
