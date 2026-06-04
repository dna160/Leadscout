"use client"

import { useState } from "react"
import type { ScrapeRun } from "@/domain/config"
import { Badge } from "@/components/ui/badge"
import { apiGet, apiPost } from "@/lib/api"

interface RunPanelProps {
  runs: ScrapeRun[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: ScrapeRun["status"] }) {
  const map: Record<ScrapeRun["status"], string> = {
    running: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  }
  return <Badge className={map[status]}>{status}</Badge>
}

function ModeBadge({ mode }: { mode: ScrapeRun["mode"] }) {
  return (
    <Badge
      className={
        mode === "mock"
          ? "bg-gray-100 text-gray-600 border-gray-200"
          : "bg-blue-100 text-blue-700 border-blue-200"
      }
    >
      {mode}
    </Badge>
  )
}

export function RunPanel({ runs: initialRuns }: RunPanelProps) {
  const [runs, setRuns] = useState<ScrapeRun[]>(initialRuns)
  const [loading, setLoading] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [maxPlaces, setMaxPlaces] = useState(20)
  const [isMockMode, setIsMockMode] = useState(true)

  async function pollRuns(runId: string): Promise<void> {
    const MAX_POLLS = 200 // 200 × 3s = ~10 minutes
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 3000))
      try {
        const updated = await apiGet<ScrapeRun[]>("/api/runs")
        setRuns(updated)
        const current = updated.find((r) => r.id === runId)
        if (current && current.status !== "running") return
      } catch {
        // keep polling
      }
    }
  }

  async function handleRun() {
    setLoading(true)
    setRunError(null)
    try {
      const data = await apiPost<{
        runId: string
        cityCount: number
        placesFound: number
        newLeads: number
      }>("/api/scrape", { maxPlacesPerSearch: maxPlaces, mode: isMockMode ? "mock" : "live" })

      // Refresh run list immediately
      try {
        const refreshed = await apiGet<ScrapeRun[]>("/api/runs")
        setRuns(refreshed)
      } catch {
        // non-fatal
      }

      await pollRuns(data.runId)
    } catch (err) {
      console.error(err)
      setRunError(err instanceof Error ? err.message : "Scrape failed")
    } finally {
      setLoading(false)
    }
  }

  const recentRuns = runs.slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      {runError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Scrape failed:</strong> {runError}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white shadow-sm rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Max per search</label>
          <input
            type="number"
            min={1}
            max={200}
            value={maxPlaces}
            onChange={(e) => setMaxPlaces(Number(e.target.value))}
            disabled={loading}
            className="w-24 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={isMockMode}
            onChange={(e) => setIsMockMode(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 font-medium">Mock mode</span>
        </label>

        <button
          onClick={() => void handleRun()}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          {loading ? "Running…" : "Run Scrape"}
        </button>
      </div>

      {/* Run history */}
      {recentRuns.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Run History</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {recentRuns.map((run) => (
              <li key={run.id} className="px-4 py-3 flex flex-wrap items-start gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(run.started_at)}
                  </span>
                  <ModeBadge mode={run.mode} />
                  <StatusBadge status={run.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600">
                    {run.queries?.length ?? 0} queries · {run.places_found} found ·{" "}
                    {run.new_leads} new
                  </p>
                  {run.error && (
                    <p className="text-xs text-red-500 mt-0.5 truncate" title={run.error}>
                      {run.error}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentRuns.length === 0 && (
        <p className="text-sm text-gray-400 italic">No scrape runs yet.</p>
      )}
    </div>
  )
}
