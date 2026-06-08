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
        <button
          onClick={refresh}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

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
