import { Router } from "express";
import {
  getAllCities,
  createNewCity,
  patchCity,
  removeCity,
} from "../services/city.service";

export const citiesRouter = Router();

function mapErrorToStatus(code: string): number {
  if (code === "VALIDATION_ERROR") return 400;
  if (code === "NOT_FOUND") return 404;
  return 500;
}

citiesRouter.get("/", async (_req, res) => {
  const result = await getAllCities();
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.json(result.value);
});

citiesRouter.post("/", async (req, res) => {
  const result = await createNewCity(req.body);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.status(201).json(result.value);
});

citiesRouter.patch("/:id", async (req, res) => {
  const result = await patchCity(req.params.id, req.body);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.json(result.value);
});

citiesRouter.delete("/:id", async (req, res) => {
  const result = await removeCity(req.params.id);
  if (!result.ok) {
    return void res.status(mapErrorToStatus(result.error.code)).json({ error: result.error.message });
  }
  res.status(204).send();
});
