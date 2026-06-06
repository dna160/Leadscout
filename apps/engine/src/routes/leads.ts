import { Router } from "express";
import Papa from "papaparse";
import {
  getLeads,
  getLeadStats,
  getAllLeadsForExport,
  getRejectedLeads,
  restoreLead,
} from "../repositories/lead.repository";
import type { Segment } from "../domain/lead";

export const leadsRouter = Router();

leadsRouter.get("/rejected", async (req, res) => {
  const { segment, city, search, limit = "500", offset = "0" } = req.query as Record<string, string>;

  const result = await getRejectedLeads({
    segment: segment as Segment | undefined,
    city,
    search,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  res.json({ leads: result.value });
});

leadsRouter.post("/:id/restore", async (req, res) => {
  const result = await restoreLead(req.params.id);
  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  if (!result.value) return void res.status(404).json({ error: `Lead ${req.params.id} not found` });
  res.json(result.value);
});

leadsRouter.get("/", async (req, res) => {
  const {
    segment,
    city,
    search,
    limit = "500",
    offset = "0",
  } = req.query as Record<string, string>;

  const [leadsR, statsR] = await Promise.all([
    getLeads({
      segment: segment as Segment | undefined,
      city,
      search,
      limit: parseInt(limit),
      offset: parseInt(offset),
    }),
    getLeadStats(),
  ]);

  if (!leadsR.ok) return void res.status(500).json({ error: leadsR.error.message });
  if (!statsR.ok) return void res.status(500).json({ error: statsR.error.message });

  res.json({ leads: leadsR.value, stats: statsR.value });
});

leadsRouter.get("/export", async (_req, res) => {
  const result = await getAllLeadsForExport();
  if (!result.ok) return void res.status(500).json({ error: result.error.message });

  const csv = Papa.unparse(
    result.value.map((l) => ({
      name: l.name,
      category: l.category ?? "",
      city: l.city ?? "",
      segment: l.segment ?? "",
      phone: l.phone ?? "",
      whatsapp: l.whatsapp ?? "",
      email: l.email ?? "",
      instagram: l.instagram ?? "",
      website: l.website ?? "",
      maps_url: l.maps_url ?? "",
      rating: l.rating ?? "",
      reviews: l.reviews ?? "",
      created_at: l.created_at.toISOString(),
    })),
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="leadscout-export-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.send(csv);
});
