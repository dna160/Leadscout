"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import type { Lead, LeadFilters, LeadStats } from "@/domain/lead"
import { apiGet, apiPost, engineUrl } from "@/lib/api"
import { StatCards } from "@/components/leads/StatCards"
import { LeadFilters as LeadFiltersBar } from "@/components/leads/LeadFilters"
import { LeadTable } from "@/components/leads/LeadTable"
import { RejectedTable } from "@/components/leads/RejectedTable"

const DEFAULT_STATS: LeadStats = { total: 0, hot: 0, warm: 0, cold: 0, rejected: 0, thisWeek: 0 }

type Tab = "leads" | "rejected"

export default function LeadsPage() {
  const [tab, setTab] = useState<Tab>("leads")
  const [leads, setLeads] = useState<Lead[]>([])
  const [rejected, setRejected] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LeadFilters>({})
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineResult, setPipelineResult] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ leads: Lead[]; stats: LeadStats }>("/api/leads")
      setLeads(data.leads)
      setStats(data.stats)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to load leads")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRejected = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ leads: Lead[] }>("/api/leads/rejected")
      setRejected(data.leads)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to load rejected leads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "leads") void fetchLeads()
    else void fetchRejected()
  }, [tab, fetchLeads, fetchRejected])

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await apiPost(`/api/leads/${id}/restore`)
        setRejected((prev) => prev.filter((l) => l.id !== id))
        void fetchLeads()
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Failed to restore lead")
      }
    },
    [fetchLeads],
  )

  const cities = useMemo<string[]>(() => {
    const unique = [...new Set(leads.map((l) => l.city).filter((c): c is string => c !== null))]
    return unique.sort()
  }, [leads])

  const filteredLeads = useMemo<Lead[]>(() => {
    return leads.filter((lead) => {
      if (filters.segment && lead.segment !== filters.segment) return false
      if (filters.city && lead.city !== filters.city) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const haystack = [lead.name, lead.category, lead.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [leads, filters])

  const runPipeline = useCallback(async () => {
    setPipelineRunning(true)
    setPipelineResult(null)
    setError(null)
    try {
      // POST returns immediately with { runId, leadsTotal, status: 'running' }
      const started = await apiPost<{
        runId: string; leadsTotal: number; status: string;
        leadsEnriched?: number; leadsClassified?: number; leadsGenerated?: number; leadsFailed?: number; durationMs?: number
      }>("/api/pipeline/run")

      if (started.status === "done" || started.runId === "no-op") {
        // No qualified leads — already done
        setPipelineResult(`No qualified leads to process`)
        setPipelineRunning(false)
        return
      }

      setPipelineResult(`Pipeline running — ${started.leadsTotal} leads queued…`)

      // Poll for completion every 5 seconds
      const poll = async () => {
        try {
          const run = await apiGet<{
            status: string; leads_total: number; leads_enriched: number;
            leads_classified: number; leads_generated: number; leads_failed: number;
            finished_at: string | null
          }>(`/api/pipeline/runs/${started.runId}`)

          if (run.status === "done" || run.status === "failed") {
            setPipelineResult(
              run.status === "done"
                ? `Pipeline done: ${run.leads_generated}/${run.leads_total} generated, ` +
                  `${run.leads_classified} classified, ${run.leads_failed} failed`
                : `Pipeline failed — check engine logs`
            )
            setPipelineRunning(false)
            void fetchLeads()
          } else {
            // Still running — show progress and poll again
            setPipelineResult(
              `Pipeline running: enriched ${run.leads_enriched}, ` +
              `classified ${run.leads_classified}, generated ${run.leads_generated} / ${run.leads_total}`
            )
            setTimeout(() => void poll(), 5000)
          }
        } catch {
          // Poll error — keep trying
          setTimeout(() => void poll(), 5000)
        }
      }

      setTimeout(() => void poll(), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed")
      setPipelineRunning(false)
    }
  }, [fetchLeads])

  function refresh() {
    if (tab === "leads") void fetchLeads()
    else void fetchRejected()
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void runPipeline()}
            disabled={pipelineRunning || loading}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
          >
            {pipelineRunning ? "Running pipeline…" : "▶ Run Intelligence Pipeline"}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {pipelineResult && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ {pipelineResult}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        <button className={tabClass(tab === "leads")} onClick={() => setTab("leads")}>
          Leads
        </button>
        <button className={tabClass(tab === "rejected")} onClick={() => setTab("rejected")}>
          Rejected
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {tab === "leads" ? (
        <>
          <StatCards stats={stats} onRejectedClick={() => setTab("rejected")} />

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <LeadFiltersBar filters={filters} cities={cities} onChange={setFilters} />
            <a
              href={engineUrl("/api/leads/export")}
              download
              className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Export CSV
            </a>
          </div>

          <LeadTable leads={filteredLeads} loading={loading} />
        </>
      ) : (
        <RejectedTable leads={rejected} loading={loading} onRestore={handleRestore} />
      )}
    </div>
  )
}
