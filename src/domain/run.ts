// Re-export shared types used by both API and UI layers
export type { RunStatus, RunMode } from "@/repositories/run.repository"
export type { KeywordSet } from "@/repositories/keywordSet.repository"
export type { City } from "@/repositories/city.repository"

import type { RunStatus, RunMode } from "@/repositories/run.repository"

/**
 * UI-facing ScrapeRun — dates come as ISO strings from JSON serialization.
 */
export interface ScrapeRun {
  id: string
  status: RunStatus
  mode: RunMode
  apify_run_id: string | null
  queries: string[] | null
  cities: string[] | null
  places_found: number
  new_leads: number
  error: string | null
  started_at: string
  finished_at: string | null
}
