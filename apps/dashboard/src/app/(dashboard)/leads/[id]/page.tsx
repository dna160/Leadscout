"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiGet, apiPost, apiPatch } from "@/lib/api"
import type { LeadDetail, LeadAsset } from "@/domain/lead"

const SEGMENT_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-800",
  warm: "bg-amber-100 text-amber-800",
  cold: "bg-blue-100 text-blue-800",
  drop: "bg-gray-200 text-gray-600",
}

const ENRICH_COLORS: Record<string, string> = {
  enriched: "bg-green-100 text-green-700",
  no_context: "bg-yellow-100 text-yellow-700",
  needs_manual: "bg-red-100 text-red-700",
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function AssetCard({
  asset,
  onApprove,
  onEdit,
}: {
  asset: LeadAsset
  onApprove: (id: string) => void
  onEdit: (id: string, content: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(asset.content ?? "")

  const typeLabel: Record<string, string> = { whatsapp: "WhatsApp", email: "Email", deck: "Deck PDF" }
  const typeColors: Record<string, string> = {
    whatsapp: "border-green-300 bg-green-50",
    email: "border-blue-300 bg-blue-50",
    deck: "border-purple-300 bg-purple-50",
  }

  return (
    <div className={`rounded-lg border-2 p-4 ${typeColors[asset.type] ?? "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{typeLabel[asset.type] ?? asset.type}</span>
          <Pill
            label={asset.status}
            className={asset.status === "approved" ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"}
          />
        </div>
        <div className="flex gap-2">
          {asset.type !== "deck" && (
            <>
              {editing ? (
                <>
                  <button
                    onClick={() => { onEdit(asset.id, draft); setEditing(false) }}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
              )}
            </>
          )}
          {asset.status !== "approved" && (
            <button
              onClick={() => onApprove(asset.id)}
              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
            >
              Approve
            </button>
          )}
        </div>
      </div>

      {asset.type === "deck" ? (
        <div className="flex items-center gap-3">
          {asset.file_path ? (
            <>
              <a
                href={`/api/leads/${asset.lead_id}/deck`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-purple-600 text-white text-sm px-3 py-1.5 rounded hover:bg-purple-700 transition-colors font-medium"
              >
                📄 View PDF
              </a>
              <a
                href={`/api/leads/${asset.lead_id}/deck`}
                download
                className="text-sm text-purple-600 hover:text-purple-800 underline"
              >
                Download
              </a>
              <span className="text-xs text-gray-400">{asset.file_path.split(/[\\/]/).pop()}</span>
            </>
          ) : (
            <p className="text-sm text-gray-400">No deck file generated yet</p>
          )}
        </div>
      ) : editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="w-full h-40 text-sm border border-gray-300 rounded p-2 font-mono resize-y"
        />
      ) : (
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
          {asset.content ?? "(empty)"}
        </pre>
      )}

      {asset.prompt_version && (
        <p className="text-xs text-gray-400 mt-2">
          {asset.model} · {asset.prompt_version} · {new Date(asset.created_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await apiGet<LeadDetail>(`/api/leads/${id}`)
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lead")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void fetchDetail() }, [fetchDetail])

  const handleApprove = async (assetId: string) => {
    try {
      await apiPatch(`/api/leads/${id}`, { assetId, action: "approve" })
      void fetchDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve")
    }
  }

  const handleEdit = async (assetId: string, content: string) => {
    try {
      await apiPatch(`/api/leads/${id}`, { assetId, action: "edit", content })
      void fetchDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await apiPost(`/api/leads/${id}/generate`)
      void fetchDetail()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading lead detail…</div>
  if (!data) return <div className="p-6 text-red-600">{error ?? "Lead not found"}</div>

  const { lead, context, assets } = data

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 block"
      >
        ← Back to leads
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {[lead.category, lead.city, lead.address].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {lead.segment && (
                <Pill
                  label={lead.segment.toUpperCase()}
                  className={SEGMENT_COLORS[lead.segment] ?? "bg-gray-100 text-gray-600"}
                />
              )}
              {lead.segment_confidence != null && (
                <Pill
                  label={`${Math.round(lead.segment_confidence * 100)}% confidence`}
                  className="bg-gray-100 text-gray-600"
                />
              )}
              {lead.segment_source && (
                <Pill
                  label={lead.segment_source === "llm" ? "AI classified" : "Triage fallback"}
                  className="bg-indigo-100 text-indigo-700"
                />
              )}
              {lead.enrichment_status && (
                <Pill
                  label={lead.enrichment_status.replace("_", " ")}
                  className={ENRICH_COLORS[lead.enrichment_status] ?? "bg-gray-100 text-gray-600"}
                />
              )}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {generating ? "Generating…" : "↻ (Re)generate Assets"}
          </button>
        </div>

        {/* Lead facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          {lead.rating != null && (
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-lg font-bold">{lead.rating}</div>
              <div className="text-gray-500 text-xs">{lead.reviews?.toLocaleString()} reviews</div>
            </div>
          )}
          {lead.price_level != null && (
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-lg font-bold">{"$".repeat(lead.price_level)}</div>
              <div className="text-gray-500 text-xs">Price level</div>
            </div>
          )}
          {lead.phone && (
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="font-medium text-xs truncate">{lead.phone}</div>
              <div className="text-gray-500 text-xs">Phone</div>
            </div>
          )}
          {lead.contact_person && (
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="font-medium text-xs">{lead.contact_person}</div>
              <div className="text-gray-500 text-xs">{lead.contact_role ?? "Contact"}</div>
            </div>
          )}
        </div>
      </div>

      {/* Evidence + Cut fit */}
      {(lead.segment_evidence?.length || lead.cut_fit?.length) ? (
        <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">Classification Evidence</h2>
          {lead.cut_fit?.length ? (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Cut tiers:</span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {lead.cut_fit.map(tier => (
                  <Pill key={tier} label={tier} className="bg-orange-100 text-orange-700" />
                ))}
              </div>
            </div>
          ) : null}
          {lead.segment_evidence?.length ? (
            <ul className="space-y-1 mt-2">
              {lead.segment_evidence.map((ev, i) => (
                <li key={i} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-1">
                  &ldquo;{ev}&rdquo;
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Context signals */}
      {context && context.signals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">
            Web Context
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({context.sources.length} sources)
            </span>
          </h2>
          <ul className="space-y-1">
            {context.signals.slice(0, 8).map((s, i) => (
              <li key={i} className="text-sm text-gray-600">• {s}</li>
            ))}
          </ul>
          {context.menu_links.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Menu links found</p>
              {context.menu_links.slice(0, 3).map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:underline truncate"
                >
                  {link}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assets */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">
          Outreach Assets
          {assets.length === 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              — none yet. Click &ldquo;(Re)generate Assets&rdquo; above.
            </span>
          )}
        </h2>
        <div className="space-y-4">
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onApprove={handleApprove}
              onEdit={handleEdit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
