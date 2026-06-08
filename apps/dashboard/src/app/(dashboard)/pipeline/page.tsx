"use client"

import { useEffect, useState, useCallback } from "react"
import { apiGet, apiPost } from "@/lib/api"
import type { Lead } from "@/domain/lead"

type PipelineStage =
  | "new" | "approved" | "queued" | "sent" | "replied"
  | "meeting" | "won" | "lost" | "suppressed"

const STAGE_ORDER: PipelineStage[] = [
  "approved", "queued", "sent", "replied", "meeting", "won",
]

const STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New", approved: "Approved", queued: "Queued",
  sent: "Sent", replied: "Replied", meeting: "Meeting",
  won: "Won", lost: "Lost", suppressed: "Suppressed",
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  new: "bg-gray-100 border-gray-300",
  approved: "bg-blue-50 border-blue-300",
  queued: "bg-yellow-50 border-yellow-300",
  sent: "bg-indigo-50 border-indigo-300",
  replied: "bg-green-50 border-green-300",
  meeting: "bg-purple-50 border-purple-300",
  won: "bg-emerald-50 border-emerald-300",
  lost: "bg-red-50 border-red-300",
  suppressed: "bg-gray-50 border-gray-200",
}

interface PipelineLead extends Lead {
  pipeline_stage: PipelineStage
  last_contacted_at?: string | null
  replied_at?: string | null
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<PipelineLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queuing, setQueuing] = useState<string | null>(null)
  const [queueResult, setQueueResult] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch all leads with approved/queued/sent/replied/meeting/won/lost/suppressed stages
      const data = await apiGet<{ leads: PipelineLead[] }>("/api/leads?limit=1000")
      // Filter to only leads that have been through Phase 2 (have pipeline_stage set)
      const pipelineLeads = data.leads.filter(
        (l) => l.pipeline_stage && l.pipeline_stage !== "new"
      ) as PipelineLead[]
      setLeads(pipelineLeads)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchLeads() }, [fetchLeads])

  const queueForOutreach = useCallback(async (leadId: string) => {
    setQueuing(leadId)
    setQueueResult(null)
    try {
      const r = await apiPost<{ queued: number; failed: number }>(
        "/api/send/queue",
        { leadIds: [leadId] },
      )
      setQueueResult(r.queued > 0 ? "Queued for outreach ✓" : "Could not queue — check suppression or email")
      void fetchLeads()
    } catch (err) {
      setQueueResult(err instanceof Error ? err.message : "Queue failed")
    } finally {
      setQueuing(null)
    }
  }, [fetchLeads])

  const byStage = (stage: PipelineStage) =>
    leads.filter((l) => l.pipeline_stage === stage)

  function segmentBadge(seg: string | null) {
    const colors: Record<string, string> = {
      hot: "bg-red-100 text-red-700",
      warm: "bg-orange-100 text-orange-700",
      cold: "bg-blue-100 text-blue-700",
    }
    return seg ? (
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[seg] ?? "bg-gray-100 text-gray-600"}`}>
        {seg}
      </span>
    ) : null
  }

  function dateAgo(iso: string | null | undefined) {
    if (!iso) return null
    const d = new Date(iso)
    const days = Math.floor((Date.now() - d.getTime()) / 86400000)
    return days === 0 ? "today" : `${days}d ago`
  }

  if (loading) return <div className="p-8 text-gray-500">Loading pipeline…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">CRM Pipeline</h1>
        <div className="flex gap-3 items-center">
          {queueResult && (
            <span className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded">
              {queueResult}
            </span>
          )}
          <button
            onClick={() => void fetchLeads()}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map((stage) => {
          const stageLeads = byStage(stage)
          return (
            <div key={stage} className="flex-shrink-0 w-72">
              <div className={`rounded-lg border-2 ${STAGE_COLORS[stage]} p-3 min-h-64`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-700">{STAGE_LABELS[stage]}</h3>
                  <span className="text-xs bg-white border rounded-full px-2 py-0.5 text-gray-500 font-medium">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="bg-white rounded border border-gray-200 p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{lead.name}</p>
                        {segmentBadge(lead.segment)}
                      </div>
                      {lead.city && (
                        <p className="text-xs text-gray-500 mb-1">{lead.city}</p>
                      )}
                      {lead.email && (
                        <p className="text-xs text-gray-400 mb-2 truncate">{lead.email}</p>
                      )}
                      {lead.last_contacted_at && (
                        <p className="text-xs text-gray-400 mb-2">
                          Contacted {dateAgo(lead.last_contacted_at)}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {stage === "approved" && lead.email && (
                          <button
                            onClick={() => void queueForOutreach(lead.id)}
                            disabled={queuing === lead.id}
                            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {queuing === lead.id ? "…" : "Queue Email"}
                          </button>
                        )}
                        {lead.whatsapp && (
                          <a
                            href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Halo, saya Johannes dari IBUKI A5 Wagyu Indonesia. Apakah ${lead.name} tertarik untuk mengetahui lebih lanjut mengenai A5 Wagyu premium kami?`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                          >
                            WA
                          </a>
                        )}
                        {lead.instagram && (
                          <a
                            href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-pink-600 text-white px-2 py-1 rounded hover:bg-pink-700"
                          >
                            IG
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageLeads.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Empty</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats footer */}
      <div className="mt-6 flex gap-6 text-sm text-gray-500">
        <span>Total in pipeline: <strong className="text-gray-800">{leads.length}</strong></span>
        <span>Won: <strong className="text-emerald-600">{byStage("won").length}</strong></span>
        <span>Suppressed: <strong className="text-gray-500">{byStage("suppressed").length}</strong></span>
      </div>
    </div>
  )
}
