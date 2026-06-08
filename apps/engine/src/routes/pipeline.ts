import { Router } from "express";
import {
  runPipeline,
  getQualifiedLeads,
  createPipelineRun,
  getPipelineRuns,
  getPipelineRun,
} from "../services/pipeline.service";
import { updatePipelineRun } from "../repositories/pipeline.repository";
import { logger } from "../lib/logger";

export const pipelineRouter = Router();

/**
 * POST /api/pipeline/run — trigger batch I2→I3→I5→I6 pipeline
 *
 * Returns immediately with { runId, leadsTotal, status: 'running' }.
 * Pipeline runs in the background — poll GET /api/pipeline/runs/:id for status.
 */
pipelineRouter.post("/run", async (_req, res) => {
  // 1. Count qualified leads so we can return leadsTotal upfront
  const leadsResult = await getQualifiedLeads();
  if (!leadsResult.ok) {
    return void res.status(500).json({ error: leadsResult.error.message });
  }

  const leads = leadsResult.value;

  if (leads.length === 0) {
    return void res.json({
      runId: "no-op",
      leadsTotal: 0,
      leadsEnriched: 0,
      leadsClassified: 0,
      leadsGenerated: 0,
      leadsFailed: 0,
      status: "done",
      durationMs: 0,
    });
  }

  // 2. Create the pipeline_runs record immediately
  const runResult = await createPipelineRun(leads.length);
  if (!runResult.ok) {
    return void res.status(500).json({ error: runResult.error.message });
  }

  const run = runResult.value;

  // 3. Return run ID right away — don't wait for pipeline to finish
  res.json({ runId: run.id, leadsTotal: leads.length, status: "running" });

  // 4. Fire pipeline in the background
  setImmediate(() => {
    runPipeline(run.id, leads)
      .then(result => {
        if (!result.ok) {
          logger.error({ runId: run.id, error: result.error }, "Pipeline failed");
          void updatePipelineRun(run.id, {
            status: "failed",
            error: result.error.message,
            finished_at: new Date(),
          });
        }
      })
      .catch((err: unknown) => {
        logger.error({ runId: run.id, err }, "Pipeline threw unexpectedly");
        void updatePipelineRun(run.id, {
          status: "failed",
          error: (err as Error).message,
          finished_at: new Date(),
        });
      });
  });
});

/** GET /api/pipeline/runs — list recent pipeline runs */
pipelineRouter.get("/runs", async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "20");
  const result = await getPipelineRuns(limit);
  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  res.json({ runs: result.value });
});

/** GET /api/pipeline/runs/:id — single run detail (for polling) */
pipelineRouter.get("/runs/:id", async (req, res) => {
  const result = await getPipelineRun(req.params.id);
  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  if (!result.value) return void res.status(404).json({ error: "Run not found" });
  res.json(result.value);
});
