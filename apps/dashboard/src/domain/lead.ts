export type LeadStatus = "scraped"|"enriched"|"classified"|"generated"|"approved"|"needs_manual";
export type Segment = "hot"|"warm"|"cold"|"drop";
export type LeadLifecycleStatus = "active"|"rejected";
export type SegmentSource = "llm"|"triage";
export type EnrichmentStatus = "enriched"|"no_context"|"needs_manual";

export interface Lead {
  id: string; place_key: string; place_id: string|null; name: string;
  category: string|null; segment: Segment|null; matched_keyword: string|null;
  matched_keywords?: string[];
  city: string|null; address: string|null; phone: string|null; whatsapp: string|null;
  website: string|null; email: string|null; instagram: string|null;
  maps_url: string|null; rating: number|null; reviews: number|null;
  price_level?: number|null;
  status?: LeadLifecycleStatus;
  reject_layer?: string|null; reject_reason?: string|null; triage_verdict?: string|null;
  // Phase 2
  segment_confidence?: number|null;
  segment_source?: SegmentSource|null;
  segment_evidence?: string[];
  cut_fit?: string[];
  contact_person?: string|null;
  contact_role?: string|null;
  enrichment_status?: EnrichmentStatus|null;
  source_run_id: string|null; created_at: string;
}

export interface LeadContext {
  id: string; lead_id: string;
  signals: string[]; menu_links: string[]; raw_text: string|null;
  sources: string[]; fetched_at: string;
}

export interface LeadAsset {
  id: string; lead_id: string; type: "whatsapp"|"email"|"deck";
  content: string|null; file_path: string|null;
  model: string|null; prompt_version: string|null;
  status: "draft"|"approved"; created_at: string;
}

export interface LeadDetail {
  lead: Lead; context: LeadContext|null; assets: LeadAsset[];
}

export interface LeadFilters { segment?: Segment; city?: string; search?: string }
export interface LeadStats { total: number; hot: number; warm: number; cold: number; rejected: number; thisWeek: number }
