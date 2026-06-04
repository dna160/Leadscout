import { Router } from "express";
import { listRuns } from "../repositories/run.repository";

export const runsRouter = Router();

runsRouter.get("/", async (_req, res) => {
  const result = await listRuns(20);
  if (!result.ok) {
    return void res.status(500).json({ error: result.error.message });
  }
  res.json(result.value);
});
