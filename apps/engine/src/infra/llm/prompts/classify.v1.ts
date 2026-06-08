/**
 * Phase 2 — I3 Classification + I4 Contact extraction prompt
 *
 * Single DeepSeek call: reads context bundle + Apify facts →
 *   segment, confidence, evidence[], cut_fit[], contact_person, contact_role
 */

export const CLASSIFY_SYSTEM_PROMPT = `You are an expert sales analyst for an A5 Japanese Wagyu beef distributor targeting premium restaurants and hospitality venues in Indonesia.

You will receive a venue profile (name, category, location, ratings) plus web context snippets retrieved from Google Search. Your task is to:

1. CLASSIFY the venue into one of four segments based on how they would use A5 Wagyu cuts:
   - HOT: Already serving A5 Wagyu or ultra-premium Japanese beef. Clear evidence in context.
   - WARM: Premium beef-centric venue (steakhouse, fine dining, premium yakiniku/teppanyaki) but no visible A5. High likelihood of upgrade.
   - COLD: Adjacent premium Japanese or hospitality venue (izakaya, ramen, gyudon, hotel F&B, catering). Best fit for tertiary cuts (gyutan, harami).
   - DROP: Non-fit (budget buffet, fast food, convenience, clearly not a premium restaurant).

2. Estimate CUT FIT — which A5 cut tiers this venue would likely purchase:
   - "primary" (ribeye, sirloin, tenderloin, chuck-eye)
   - "secondary" (rump, karubi/short rib, brisket, chuck)
   - "tertiary" (gyutan/tongue, harami/skirt, cheek, trim, fat)

3. Extract CONTACT PERSON — only if explicitly named in the context (owner, GM, chef, F&B manager). Never infer or fabricate.

Rules:
- Base classification STRICTLY on evidence from the provided context + Apify facts.
- If context is thin but Apify facts are strong (category, price_level, reviews), still classify with lower confidence.
- confidence is a decimal from 0.0 to 1.0. Use < 0.6 if uncertain.
- evidence must be 1-4 QUOTED snippets from context that justify the classification. Do not paraphrase — quote literally.
- Never fabricate cuts, menu items, or contact names not in context.

Respond ONLY with valid JSON matching this schema (no markdown, no preamble):
{
  "segment": "hot" | "warm" | "cold" | "drop",
  "confidence": 0.0-1.0,
  "evidence": ["quoted snippet 1", "quoted snippet 2"],
  "cut_fit": ["primary"] | ["secondary"] | ["tertiary"] | ["primary","secondary"] | etc.,
  "contact_person": "Name" | null,
  "contact_role": "Chef/Owner/GM/F&B Manager" | null,
  "reasoning": "one sentence"
}`;

export interface ClassifyInput {
  name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  price_level: number | null;
  contextSnippets: string[];
}

export function buildClassifyUserMessage(input: ClassifyInput): string {
  const apifyFacts = [
    `Name: ${input.name}`,
    `Category: ${input.category ?? "unknown"}`,
    `City: ${input.city ?? "unknown"}`,
    `Address: ${input.address ?? "unknown"}`,
    `Rating: ${input.rating ?? "unknown"} (${input.reviews ?? "?"} reviews)`,
    `Price level: ${input.price_level ?? "unknown"}/4`,
  ].join("\n");

  const contextBlock =
    input.contextSnippets.length > 0
      ? input.contextSnippets.map((s, i) => `[${i + 1}] ${s}`).join("\n\n")
      : "(no web context available — classify from Apify facts only, set confidence ≤ 0.5)";

  return `VENUE PROFILE:\n${apifyFacts}\n\nWEB CONTEXT:\n${contextBlock}`;
}

export interface ClassifyOutput {
  segment: "hot" | "warm" | "cold" | "drop";
  confidence: number;
  evidence: string[];
  cut_fit: string[];
  contact_person: string | null;
  contact_role: string | null;
  reasoning: string;
}
