export type LeadStatus = "scraped"|"enriched"|"classified"|"generated"|"approved"|"needs_manual";
export type Segment = "hot"|"warm"|"cold"|"drop";
export type LeadLifecycleStatus = "active"|"rejected";
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
  source_run_id: string|null; created_at: string;
}
export interface LeadFilters { segment?: Segment; city?: string; search?: string }
export interface LeadStats { total: number; hot: number; warm: number; cold: number; rejected: number; thisWeek: number }
