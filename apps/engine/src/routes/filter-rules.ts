import { Router } from "express";
import {
  getAllFilterRules,
  createNewFilterRule,
  patchFilterRule,
  removeFilterRule,
} from "../services/filterRule.service";

export const filterRulesRouter = Router();

function mapErrorToStatus(code: string): number {
  if (code === "VALIDATION_ERROR") return 400;
  if (code === "NOT_FOUND") return 404;
  return 500;
}

filterRulesRouter.get("/", async (_req, res) => {
  const result = await getAllFilterRules();
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.json(result.value);
});

filterRulesRouter.post("/", async (req, res) => {
  const result = await createNewFilterRule(req.body);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.status(201).json(result.value);
});

filterRulesRouter.patch("/:id", async (req, res) => {
  const result = await patchFilterRule(req.params.id, req.body);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.json(result.value);
});

filterRulesRouter.delete("/:id", async (req, res) => {
  const result = await removeFilterRule(req.params.id);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.status(204).send();
});
