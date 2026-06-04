import { Router } from "express";
import {
  getAllKeywordSets,
  createNewKeywordSet,
  patchKeywordSet,
  removeKeywordSet,
} from "../services/keywordSet.service";

export const keywordSetsRouter = Router();

function mapErrorToStatus(code: string): number {
  if (code === "VALIDATION_ERROR") return 400;
  if (code === "NOT_FOUND") return 404;
  return 500;
}

keywordSetsRouter.get("/", async (_req, res) => {
  const result = await getAllKeywordSets();
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.json(result.value);
});

keywordSetsRouter.post("/", async (req, res) => {
  const result = await createNewKeywordSet(req.body);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.status(201).json(result.value);
});

keywordSetsRouter.patch("/:id", async (req, res) => {
  const result = await patchKeywordSet(req.params.id, req.body);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.json(result.value);
});

keywordSetsRouter.delete("/:id", async (req, res) => {
  const result = await removeKeywordSet(req.params.id);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.status(204).send();
});
