import { triageLead, type TriageVerdict } from "../infra/llm/deepseek.client";
import { logger } from "../lib/logger";

export interface TriageInput {
  leadId: string;
  name: string;
  category: string | null;
  price_level: number | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
}

export interface TriageOutcome {
  leadId: string;
  verdict: TriageVerdict;
  reason: string;
}

const CONCURRENCY = 5;

/**
 * Apply the L3 LLM triage to a batch of leads. Runs with a fixed concurrency
 * limit. When disabled, every lead is passed through with a "keep" verdict.
 */
export async function triageLeads(
  leads: TriageInput[],
  options: { enabled: boolean },
): Promise<TriageOutcome[]> {
  if (!options.enabled) {
    return leads.map((lead) => ({ leadId: lead.leadId, verdict: "keep" as const, reason: "triage disabled" }));
  }

  const results: TriageOutcome[] = [];

  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (lead): Promise<TriageOutcome> => {
        const result = await triageLead(lead);
        if (!result.ok) {
          logger.warn({ leadId: lead.leadId, error: result.error.message }, "Triage failed — keeping lead");
          return { leadId: lead.leadId, verdict: "keep", reason: result.error.message };
        }
        return { leadId: lead.leadId, verdict: result.value.verdict, reason: result.value.reason };
      }),
    );
    results.push(...settled);
  }

  return results;
}
