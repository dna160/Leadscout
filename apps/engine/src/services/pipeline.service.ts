/**
 * Phase 2 — Batch intelligence pipeline orchestrator
 *
 * Runs I2 → I3+I4 → I5+I6 over all qualified leads that haven't been processed.
 * One lead's failure never aborts the batch.
 * Persists progress in pipeline_runs table.
 *
 * Fire-and-forget pattern: the HTTP route creates a pipeline_runs record,
 * returns the run ID immediately, then calls runPipeline(runId, leads) in background.
 */

import { logger } from "../lib/logger";
import { ok, type Result } from "../lib/result";
import { getQualifiedLeads, updateLeadPhase2 } from "../repositories/lead.repository";
import { updatePipelineRun } from "../repositories/pipeline.repository";
import { enrichLead } from "./enrich.service";
import { classifyLead } from "./classify.service";
import { generateLeadAssets } from "./generate.service";
import type { Lead, Segment } from "../domain/lead";

export type PipelineError = { message: string };

export interface PipelineResult {
  runId: string;
  leadsTotal: number;
  leadsEnriched: number;
  leadsClassified: number;
  leadsGenerated: number;
  leadsFailed: number;
  durationMs: number;
}

/** Process a single lead through all pipeline stages. Returns which stages succeeded. */
async function processOneLead(lead: Lead): Promise<{
  enriched: boolean;
  classified: boolean;
  generated: boolean;
}> {
  let enriched = false;
  let classified = false;
  let generated = false;

  // I2 — Enrich
  try {
    const enrichResult = await enrichLead(lead);
    if (enrichResult.ok) {
      enriched = true;
      const updatedEnrich = {
        ...lead,
        enrichment_status: enrichResult.value.enrichmentStatus as "enriched" | "no_context",
      };

      // I3+I4 — Classify (even with no_context, attempt with Apify facts)
      try {
        const classifyResult = await classifyLead(updatedEnrich);
        if (classifyResult.ok && classifyResult.value.segment !== "drop") {
          classified = true;
          const seg = classifyResult.value.segment as Segment;

          // I5+I6 — Generate (only for non-drop segments)
          if (seg === "hot" || seg === "warm" || seg === "cold") {
            try {
              const updatedLead = {
                ...updatedEnrich,
                segment: seg,
                segment_confidence: classifyResult.value.confidence,
              };
              const generateResult = await generateLeadAssets(updatedLead, seg);
              if (generateResult.ok) {
                generated = true;
                await updateLeadPhase2(lead.id, { enrichment_status: "enriched" });
              }
            } catch (e) {
              logger.warn({ leadId: lead.id, stage: "generate", error: (e as Error).message }, "Stage failed");
            }
          }
        }
      } catch (e) {
        logger.warn({ leadId: lead.id, stage: "classify", error: (e as Error).message }, "Stage failed");
      }
    }
  } catch (e) {
    logger.warn({ leadId: lead.id, stage: "enrich", error: (e as Error).message }, "Stage failed");
  }

  return { enriched, classified, generated };
}

/**
 * Run the full intelligence pipeline.
 *
 * Called by the route with a pre-created runId and pre-fetched leads (fire-and-forget).
 * The run record already exists — this function only updates it as work progresses.
 */
export async function runPipeline(
  runId: string,
  leads: Lead[],
): Promise<Result<PipelineResult, PipelineError>> {
  const startedAt = Date.now();

  logger.info({ runId, leadsTotal: leads.length }, "Pipeline started");

  let leadsEnriched = 0;
  let leadsClassified = 0;
  let leadsGenerated = 0;
  let leadsFailed = 0;

  const CONCURRENCY = 3;
  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(l => processOneLead(l)));

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.enriched) leadsEnriched++;
        if (result.value.classified) leadsClassified++;
        if (result.value.generated) leadsGenerated++;
        if (!result.value.enriched && !result.value.classified && !result.value.generated) {
          leadsFailed++;
        }
      } else {
        leadsFailed++;
      }
    }

    // Update progress after every batch
    await updatePipelineRun(runId, {
      leads_enriched: leadsEnriched,
      leads_classified: leadsClassified,
      leads_generated: leadsGenerated,
      leads_failed: leadsFailed,
    });
  }

  // Finalize
  await updatePipelineRun(runId, {
    status: "done",
    leads_enriched: leadsEnriched,
    leads_classified: leadsClassified,
    leads_generated: leadsGenerated,
    leads_failed: leadsFailed,
    finished_at: new Date(),
  });

  const durationMs = Date.now() - startedAt;
  logger.info(
    { runId, leadsEnriched, leadsClassified, leadsGenerated, leadsFailed, durationMs },
    "Pipeline complete",
  );

  return ok({ runId, leadsTotal: leads.length, leadsEnriched, leadsClassified, leadsGenerated, leadsFailed, durationMs });
}

/** Re-export for convenience (used by route handler) */
export { getQualifiedLeads } from "../repositories/lead.repository";
export { createPipelineRun } from "../repositories/pipeline.repository";

/** Get runs list (for dashboard display) */
export { getPipelineRuns, getPipelineRun } from "../repositories/pipeline.repository";
