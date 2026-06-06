export type LeadStatus = "scraped" | "enriched" | "classified" | "generated" | "approved" | "needs_manual";

export type Segment = "hot" | "warm" | "cold" | "drop";

export type SegmentSource = "keyword" | "llm";

export type LeadLifecycleStatus = "active" | "rejected";

export interface Lead {
  id: string;
  place_key: string;
  place_id: string | null;
  name: string;
  category: string | null;
  segment: Segment | null;
  matched_keyword: string | null;
  matched_keywords: string[];
  city: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  maps_url: string | null;
  rating: number | null;
  reviews: number | null;
  price_level: number | null;
  status: LeadLifecycleStatus;
  reject_layer: string | null;
  reject_reason: string | null;
  triage_verdict: string | null;
  first_seen_run: string | null;
  last_seen_run: string | null;
  source_run_id: string | null;
  created_at: Date;
}

export interface LeadRow {
  id: string;
  place_key: string;
  place_id: string | null;
  name: string;
  category: string | null;
  segment: string | null;
  matched_keyword: string | null;
  matched_keywords: string[] | string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  maps_url: string | null;
  rating: string | null;
  reviews: number | null;
  price_level: number | null;
  status: string;
  reject_layer: string | null;
  reject_reason: string | null;
  triage_verdict: string | null;
  first_seen_run: string | null;
  last_seen_run: string | null;
  source_run_id: string | null;
  created_at: Date;
}

function parseMatchedKeywords(value: string[] | string | null | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rowToLead(row: LeadRow): Lead {
  return {
    ...row,
    segment: (row.segment as Segment) ?? null,
    matched_keywords: parseMatchedKeywords(row.matched_keywords),
    rating: row.rating != null ? parseFloat(row.rating) : null,
    status: (row.status as LeadLifecycleStatus) ?? "active",
  };
}

export interface LeadFilters {
  segment?: Segment;
  city?: string;
  search?: string;
  status?: LeadLifecycleStatus;
  limit?: number;
  offset?: number;
}

export interface LeadStats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  thisWeek: number;
}
