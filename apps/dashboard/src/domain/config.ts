export interface KeywordSet { id: string; segment: string; label: string; keywords: string[]; enabled: boolean; created_at: string }
export interface City { id: string; name: string; query: string; enabled: boolean }
export interface ScrapeRun {
  id: string; status: "running"|"completed"|"failed"; mode: "mock"|"live";
  apify_run_id: string|null; queries: string[]|null; cities: string[]|null;
  places_found: number; new_leads: number; error: string|null;
  started_at: string; finished_at: string|null;
}
