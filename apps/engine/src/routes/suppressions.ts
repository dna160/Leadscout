import { Router } from "express";
import {
  getSuppressions,
  suppress,
  deleteSuppression,
  checkSuppressed,
} from "../services/suppression.service";

export const suppressionsRouter = Router();

/**
 * GET /api/suppressions
 * List all suppressed addresses.
 */
suppressionsRouter.get("/", async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "200");
  const offset = parseInt((req.query.offset as string) ?? "0");
  const r = await getSuppressions(limit, offset);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ suppressions: r.value });
});

/**
 * POST /api/suppressions
 * Manually suppress an email address.
 * Body: { value: string, reason?: "unsubscribe"|"bounce"|"complaint"|"manual" }
 */
suppressionsRouter.post("/", async (req, res) => {
  const { value, reason = "manual" } = req.body;
  if (!value) return void res.status(400).json({ error: "value required" });
  const r = await suppress(value, reason);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.status(201).json(r.value);
});

/**
 * GET /api/suppressions/check?email=x
 * Check if an email is suppressed.
 */
suppressionsRouter.get("/check", async (req, res) => {
  const email = req.query.email as string;
  if (!email) return void res.status(400).json({ error: "email query param required" });
  const r = await checkSuppressed(email);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json({ email, suppressed: r.value });
});

/**
 * DELETE /api/suppressions/:id
 * Remove a suppression by ID.
 */
suppressionsRouter.delete("/:id", async (req, res) => {
  const r = await deleteSuppression(req.params.id);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.status(204).send();
});
