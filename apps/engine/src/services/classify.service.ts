/**
 * Phase 2 I3+I4 — Classification (cut-tier aware) + Contact extraction
 *
 * Uses DeepSeek with the classify.v1 prompt to produce:
 *  - segment (hot/warm/cold/drop), confidence, evidence[], cut_fit[]
 *  - contact_person, contact_role
 *
 * Confidence < 0.6 → retain prior triage_verdict tag, segment_source = 'triage'
 * segment = 'drop' → mark lead rejected, skip generation
 */

import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import { env } from "../lib/env";
import type { Lead, Segment } from "../domain/lead";
import {
  CLASSIFY_SYSTEM_PROMPT,
  buildClassifyUserMessage,
  type ClassifyOutput,
} from "../infra/llm/prompts/classify.v1";
import { getLeadContext } from "../repositories/context.repository";
import { updateLeadPhase2, markLeadRejected } from "../repositories/lead.repository";

export type ClassifyError = { message: string };

const MIN_CONFIDENCE = 0.6;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callDeepSeekClassify(
  lead: Lead,
  contextSnippets: string[],
): Promise<Result<ClassifyOutput, ClassifyError>> {
  if (!env.DEEPSEEK_API_KEY) {
    return err({ message: "DEEPSEEK_API_KEY not set" });
  }

  const userMessage = buildClassifyUserMessage({
    name: lead.name,
    category: lead.category,
    city: lead.city,
    address: lead.address,
    rating: lead.rating,
    reviews: lead.reviews,
    price_level: lead.price_level,
    contextSnippets,
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (attempt < MAX_RETRIES && response.status >= 500) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        return err({ message: `DeepSeek HTTP ${response.status}: ${text}` });
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as Partial<ClassifyOutput>;

      const validSegments: Segment[] = ["hot", "warm", "cold", "drop"];
      const segment = validSegments.includes(parsed.segment as Segment)
        ? (parsed.segment as Segment)
        : "cold";

      return ok({
        segment,
        confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.4,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 4) : [],
        cut_fit: Array.isArray(parsed.cut_fit) ? parsed.cut_fit : [],
        contact_person: typeof parsed.contact_person === "string" ? parsed.contact_person : null,
        contact_role: typeof parsed.contact_role === "string" ? parsed.contact_role : null,
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      });
    } catch (e) {
      const error = e as Error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      return err({ message: error.message });
    }
  }
  return err({ message: "Max retries exceeded" });
}

export async function classifyLead(
  lead: Lead,
): Promise<Result<{ applied: boolean; segment: Segment; confidence: number }, ClassifyError>> {
  // Fetch context snippets
  const ctxResult = await getLeadContext(lead.id);
  const context = ctxResult.ok ? ctxResult.value : null;
  const contextSnippets = context
    ? [
        ...context.signals,
        ...(context.raw_text ? [context.raw_text.slice(0, 3000)] : []),
      ]
    : [];

  const classifyResult = await callDeepSeekClassify(lead, contextSnippets);
  if (!classifyResult.ok) {
    // On LLM failure: mark needs_manual, don't reject
    await updateLeadPhase2(lead.id, { enrichment_status: "needs_manual" });
    logger.warn({ leadId: lead.id, error: classifyResult.error }, "Classification failed → needs_manual");
    return err(classifyResult.error);
  }

  const output = classifyResult.value;

  // Drop leads: reject, skip generation
  if (output.segment === "drop") {
    const placeKey = lead.place_key;
    await markLeadRejected(placeKey, "P2-classify", `LLM classified as drop (confidence ${output.confidence})`);
    logger.info({ leadId: lead.id, confidence: output.confidence }, "Lead classified as DROP → rejected");
    return ok({ applied: true, segment: "drop", confidence: output.confidence });
  }

  // Low confidence: retain triage verdict as segment_source = 'triage'
  const segmentSource = output.confidence >= MIN_CONFIDENCE ? "llm" : "triage";
  const appliedSegment = output.confidence >= MIN_CONFIDENCE ? output.segment : (lead.segment ?? output.segment);

  await updateLeadPhase2(lead.id, {
    segment: appliedSegment,
    segment_confidence: output.confidence,
    segment_source: segmentSource,
    segment_evidence: output.evidence,
    cut_fit: output.cut_fit,
    contact_person: output.contact_person,
    contact_role: output.contact_role,
  });

  logger.info(
    {
      leadId: lead.id,
      segment: appliedSegment,
      confidence: output.confidence,
      source: segmentSource,
    },
    "Lead classified",
  );

  return ok({ applied: true, segment: appliedSegment as Segment, confidence: output.confidence });
}

/** Batch classify with concurrency = 6 (DeepSeek concurrent limit is generous) */
export async function classifyLeadsBatch(
  leads: Lead[],
): Promise<{ classified: number; dropped: number; failed: number }> {
  let classified = 0;
  let dropped = 0;
  let failed = 0;

  const CONCURRENCY = 6;
  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(l => classifyLead(l)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) {
        if (result.value.value.segment === "drop") dropped++;
        else classified++;
      } else {
        failed++;
      }
    }
  }

  return { classified, dropped, failed };
}
