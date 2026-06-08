import { Router } from "express";
import { runPipeline } from "../services/pipeline.service";
import { getPipelineRuns, getPipelineRun } from "../repositories/pipeline.repository";

export const pipelineRouter = Router();

/** POST /api/pipeline/run — trigger batch I2→I3→I5→I6 pipeline */
pipelineRouter.post("/run", async (_req, res) => {
  // Fire pipeline in background; return immediately with a run ID
  // (pipeline.service handles all error isolation internally)
  const run = await runPipeline();

  if (!run.ok) {
    return void res.status(500).json({ error: run.error.message });
  }

  res.json(run.value);
});

/** GET /api/pipeline/runs — list recent pipeline runs */
pipelineRouter.get("/runs", async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "20");
  const result = await getPipelineRuns(limit);
  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  res.json({ runs: result.value });
});

/** GET /api/pipeline/runs/:id — single run detail */
pipelineRouter.get("/runs/:id", async (req, res) => {
  const result = await getPipelineRun(req.params.id);
  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  if (!result.value) return void res.status(404).json({ error: "Run not found" });
  res.json(result.value);
});
