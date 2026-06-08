/**
 * Phase 2 — Batch intelligence pipeline orchestrator
 *
 * Runs I2 → I3+I4 → I5+I6 over all qualified leads that haven't been processed.
 * One lead's failure never aborts the batch.
 * Persists progress in pipeline_runs table.
 */

import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import { getQualifiedLeads, updateLeadPhase2 } from "../repositories/lead.repository";
import { createPipelineRun, updatePipelineRun } from "../repositories/pipeline.repository";
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
      // Reload lead with updated enrichment_status
      const updatedEnrich = { ...lead, enrichment_status: enrichResult.value.enrichmentStatus as "enriched" | "no_context" };

      // I3+I4 — Classify (even if no_context, we still attempt with Apify facts)
      try {
        const classifyResult = await classifyLead(updatedEnrich);
        if (classifyResult.ok && classifyResult.value.segment !== "drop") {
          classified = true;
          const seg = classifyResult.value.segment as Segment;

          // I5+I6 — Generate (only for non-drop segments)
          if (seg === "hot" || seg === "warm" || seg === "cold") {
            try {
              // Reload lead with updated segment info for generation
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
          } else {
            // Drop — already handled in classifyLead
            classified = false;
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

export async function runPipeline(): Promise<Result<PipelineResult, PipelineError>> {
  const startedAt = Date.now();

  // Fetch qualified leads
  const leadsResult = await getQualifiedLeads();
  if (!leadsResult.ok) {
    return err({ message: `Failed to fetch qualified leads: ${leadsResult.error.message}` });
  }

  const leads = leadsResult.value;
  if (leads.length === 0) {
    logger.info("Pipeline: no qualified leads to process");
    return ok({
      runId: "no-op",
      leadsTotal: 0,
      leadsEnriched: 0,
      leadsClassified: 0,
      leadsGenerated: 0,
      leadsFailed: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  // Create pipeline_runs record
  const runResult = await createPipelineRun(leads.length);
  if (!runResult.ok) {
    return err({ message: `Failed to create pipeline run: ${runResult.error.message}` });
  }
  const run = runResult.value;

  logger.info({ runId: run.id, leadsTotal: leads.length }, "Pipeline started");

  let leadsEnriched = 0;
  let leadsClassified = 0;
  let leadsGenerated = 0;
  let leadsFailed = 0;

  // Process with bounded concurrency (3 leads at once — each has internal concurrency)
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

    // Update progress every batch
    await updatePipelineRun(run.id, {
      leads_enriched: leadsEnriched,
      leads_classified: leadsClassified,
      leads_generated: leadsGenerated,
      leads_failed: leadsFailed,
    });
  }

  // Finalize run
  await updatePipelineRun(run.id, {
    status: "done",
    leads_enriched: leadsEnriched,
    leads_classified: leadsClassified,
    leads_generated: leadsGenerated,
    leads_failed: leadsFailed,
    finished_at: new Date(),
  });

  const durationMs = Date.now() - startedAt;
  logger.info(
    { runId: run.id, leadsEnriched, leadsClassified, leadsGenerated, leadsFailed, durationMs },
    "Pipeline complete",
  );

  return ok({
    runId: run.id,
    leadsTotal: leads.length,
    leadsEnriched,
    leadsClassified,
    leadsGenerated,
    leadsFailed,
    durationMs,
  });
}

/** Get runs list (for dashboard display) */
export { getPipelineRuns, getPipelineRun } from "../repositories/pipeline.repository";
