/**
 * Cut-tier and offer mapping for Phase 2 generation.
 *
 * A5 Wagyu cut tiers (by margin and venue type):
 *  Primary   – ribeye, sirloin, tenderloin, chuck-eye (steakhouse, teppanyaki, premium yakiniku)
 *  Secondary – rump, short rib/karubi, brisket, chuck (yakiniku, shabu-shabu, sukiyaki, burger)
 *  Tertiary  – tongue/gyutan, harami, cheek, trim, fat (izakaya, ramen, gyudon, gyukatsu)
 */

export type CutTier = "primary" | "secondary" | "tertiary";

export interface CutSpec {
  name_en: string;
  name_id: string;
  tier: CutTier;
}

export const A5_CUTS: CutSpec[] = [
  { name_en: "ribeye",     name_id: "ribeye",      tier: "primary" },
  { name_en: "sirloin",    name_id: "sirloin",     tier: "primary" },
  { name_en: "tenderloin", name_id: "tenderloin",  tier: "primary" },
  { name_en: "chuck-eye",  name_id: "chuck-eye",   tier: "primary" },
  { name_en: "rump",       name_id: "rump",        tier: "secondary" },
  { name_en: "short rib",  name_id: "karubi",      tier: "secondary" },
  { name_en: "brisket",    name_id: "brisket",     tier: "secondary" },
  { name_en: "chuck",      name_id: "chuck",       tier: "secondary" },
  { name_en: "tongue",     name_id: "gyutan",      tier: "tertiary" },
  { name_en: "skirt",      name_id: "harami",      tier: "tertiary" },
  { name_en: "cheek",      name_id: "pipi sapi",   tier: "tertiary" },
  { name_en: "trim",       name_id: "trim",        tier: "tertiary" },
  { name_en: "fat",        name_id: "lemak wagyu", tier: "tertiary" },
];

export const CUT_NAMES_BY_TIER: Record<CutTier, string[]> = {
  primary: A5_CUTS.filter(c => c.tier === "primary").flatMap(c => [c.name_en, c.name_id]),
  secondary: A5_CUTS.filter(c => c.tier === "secondary").flatMap(c => [c.name_en, c.name_id]),
  tertiary: A5_CUTS.filter(c => c.tier === "tertiary").flatMap(c => [c.name_en, c.name_id]),
};

/** All known cut/dish tokens for grounding validation (lower-cased) */
export const ALL_CUT_TOKENS = new Set<string>(
  A5_CUTS.flatMap(c => [c.name_en.toLowerCase(), c.name_id.toLowerCase()])
);

export interface SegmentOffer {
  whatsappHook: string;
  emailSubject: string;
  cta: string;
  tiers: CutTier[];
  sampleCuts: string[];  // 2-3 representative cuts to name in copy
}

/** Offer brief per segment — injected into the generation prompt */
export const SEGMENT_OFFERS: Record<"hot" | "warm" | "cold", SegmentOffer> = {
  hot: {
    whatsappHook: "undangan sesi tasting gratis A5 Wagyu pilihan",
    emailSubject: "Undangan Eksklusif: Sesi Tasting A5 Wagyu Gratis untuk {venue}",
    cta: "Konfirmasi sesi tasting gratis Bapak/Ibu",
    tiers: ["primary", "secondary"],
    sampleCuts: ["ribeye", "sirloin", "karubi"],
  },
  warm: {
    whatsappHook: "penawaran sesi tasting A5 Wagyu eksklusif + daftar harga",
    emailSubject: "Peluang Premium: A5 Wagyu untuk Menu {venue}",
    cta: "Dapatkan sesi tasting gratis + daftar harga",
    tiers: ["primary", "secondary"],
    sampleCuts: ["ribeye", "sirloin", "karubi"],
  },
  cold: {
    whatsappHook: "penawaran sample box potongan premium wagyu (gyutan, harami)",
    emailSubject: "Sample Box Wagyu Premium untuk {venue} — Tanpa Biaya",
    cta: "Klaim sample box gratis + daftar harga potongan",
    tiers: ["tertiary"],
    sampleCuts: ["gyutan", "harami", "lemak wagyu"],
  },
};
