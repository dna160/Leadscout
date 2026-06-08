import { Router } from "express";
import Papa from "papaparse";
import {
  getLeads,
  getLeadStats,
  getAllLeadsForExport,
  getRejectedLeads,
  restoreLead,
  getLeadById,
  updateLeadPhase2,
} from "../repositories/lead.repository";
import { getLeadContext } from "../repositories/context.repository";
import { getLeadAssets, approveAsset, updateAssetContent } from "../repositories/asset.repository";
import { generateLeadAssets } from "../services/generate.service";
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

/** GET /api/leads/:id — full detail with context + assets */
leadsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  const [leadR, contextR, assetsR] = await Promise.all([
    getLeadById(id),
    getLeadContext(id),
    getLeadAssets(id),
  ]);
  if (!leadR.ok) return void res.status(500).json({ error: leadR.error.message });
  if (!leadR.value) return void res.status(404).json({ error: `Lead ${id} not found` });

  res.json({
    lead: leadR.value,
    context: contextR.ok ? contextR.value : null,
    assets: assetsR.ok ? assetsR.value : [],
  });
});

/** PATCH /api/leads/:id — edit segment override or approve asset */
leadsRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { segment, segment_source, contact_person, contact_role, assetId, action, content } =
    req.body as {
      segment?: string;
      segment_source?: string;
      contact_person?: string;
      contact_role?: string;
      assetId?: string;
      action?: "approve" | "edit";
      content?: string;
    };

  // Handle asset approve / edit
  if (assetId && action === "approve") {
    const r = await approveAsset(assetId);
    if (!r.ok) return void res.status(500).json({ error: r.error.message });
    return void res.json(r.value);
  }
  if (assetId && action === "edit" && content) {
    const r = await updateAssetContent(assetId, content);
    if (!r.ok) return void res.status(500).json({ error: r.error.message });
    return void res.json(r.value);
  }

  // Lead field update
  const updates: Parameters<typeof updateLeadPhase2>[1] = {};
  if (segment) { updates.segment = segment; updates.segment_source = segment_source ?? "triage"; }
  if (contact_person !== undefined) updates.contact_person = contact_person;
  if (contact_role !== undefined) updates.contact_role = contact_role;

  if (Object.keys(updates).length === 0) {
    return void res.status(400).json({ error: "No valid fields to update" });
  }

  const r = await updateLeadPhase2(id, updates);
  if (!r.ok) return void res.status(500).json({ error: r.error.message });
  res.json(r.value);
});

/** POST /api/leads/:id/generate — regenerate assets for this lead */
leadsRouter.post("/:id/generate", async (req, res) => {
  const { id } = req.params;
  const leadR = await getLeadById(id);
  if (!leadR.ok) return void res.status(500).json({ error: leadR.error.message });
  if (!leadR.value) return void res.status(404).json({ error: `Lead ${id} not found` });

  const lead = leadR.value;
  const seg = (lead.segment ?? "warm") as "hot" | "warm" | "cold";
  const safeSegment: "hot" | "warm" | "cold" = ["hot", "warm", "cold"].includes(seg) ? seg : "warm";

  const result = await generateLeadAssets(lead, safeSegment);
  if (!result.ok) return void res.status(500).json({ error: result.error.message });
  res.json(result.value);
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
