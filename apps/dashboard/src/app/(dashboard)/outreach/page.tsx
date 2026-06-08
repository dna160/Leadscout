"use client"

/**
 * WhatsApp / Instagram outreach queue — HUMAN-GATED.
 *
 * This page shows approved leads that have WhatsApp or Instagram contacts.
 * Each card has a one-tap pre-filled link — a human must press Send.
 * NO automation, NO browser-agent clicking. Per PRD policy.
 */

import { useEffect, useState, useCallback } from "react"
import { apiGet } from "@/lib/api"
import type { Lead } from "@/domain/lead"

type Channel = "whatsapp" | "ig" | "all"

interface OutreachLead extends Lead {
  pipeline_stage?: string
}

const WHATSAPP_TEMPLATE = (name: string) =>
  `Halo, saya Johannes dari IBUKI A5 Wagyu Indonesia.\n\nApakah ${name} tertarik untuk mengetahui lebih lanjut mengenai A5 Wagyu premium kami? Kami menyediakan grade A4–A5 dengan marbling score 8–12, langsung dari Jepang.\n\nSaya bisa kirimkan informasi lebih detail dan harga jika berminat. 🙏`

const IG_DM_TEMPLATE = (name: string) =>
  `Halo ${name}! Saya Johannes dari IBUKI A5 Wagyu Indonesia — kami spesialis A5 Wagyu premium langsung dari Jepang. Apakah boleh saya bagikan informasi mengenai produk kami?`

export default function OutreachPage() {
  const [leads, setLeads] = useState<OutreachLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel>("all")
  const [search, setSearch] = useState("")

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ leads: OutreachLead[] }>("/api/leads?limit=1000")
      // Only show approved leads that have WA or IG contact
      const queue = data.leads.filter(
        (l) =>
          (l.pipeline_stage === "approved" || l.pipeline_stage === "sent" || !l.pipeline_stage) &&
          (l.whatsapp || l.instagram)
      )
      setLeads(queue)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchLeads() }, [fetchLeads])

  const filtered = leads.filter((l) => {
    if (channel === "whatsapp" && !l.whatsapp) return false
    if (channel === "ig" && !l.instagram) return false
    if (search) {
      const q = search.toLowerCase()
      return [l.name, l.city, l.category].some((s) => s?.toLowerCase().includes(q))
    }
    return true
  })

  function segBadge(seg: string | null) {
    const c: Record<string, string> = { hot: "text-red-600 bg-red-50", warm: "text-orange-600 bg-orange-50", cold: "text-blue-600 bg-blue-50" }
    return seg ? <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c[seg] ?? "text-gray-500"}`}>{seg}</span> : null
  }

  if (loading) return <div className="p-8 text-gray-500">Loading outreach queue…</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">WhatsApp / IG Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Human-gated — tap a button to open pre-filled message. <strong>You</strong> press Send.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex border rounded overflow-hidden">
          {(["all", "whatsapp", "ig"] as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                channel === c ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c === "all" ? "All" : c === "whatsapp" ? "WhatsApp" : "Instagram"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search venue…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-48"
        />
        <span className="text-sm text-gray-500 self-center">{filtered.length} venues</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((lead) => {
          const waLink = lead.whatsapp
            ? `https://wa.me/${lead.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(WHATSAPP_TEMPLATE(lead.name))}`
            : null
          const igLink = lead.instagram
            ? `https://instagram.com/${lead.instagram.replace("@", "")}`
            : null

          return (
            <div key={lead.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{lead.name}</p>
                {segBadge(lead.segment)}
              </div>
              {lead.city && <p className="text-xs text-gray-500 mb-1">{lead.city}</p>}
              {lead.category && <p className="text-xs text-gray-400 mb-3">{lead.category}</p>}

              {/* Cut fit chips */}
              {lead.cut_fit && lead.cut_fit.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {lead.cut_fit.map((cut) => (
                    <span key={cut} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                      {cut}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded font-medium hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.557 4.116 1.532 5.847L.057 23.882l6.194-1.624A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.666-.496-5.201-1.363l-.373-.22-3.866 1.014 1.032-3.77-.241-.387A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                )}
                {igLink && (
                  <a
                    href={igLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition-opacity"
                  >
                    Instagram
                  </a>
                )}
              </div>

              {/* IG DM copy helper */}
              {igLink && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">IG DM template ▾</summary>
                  <p className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">
                    {IG_DM_TEMPLATE(lead.name)}
                  </p>
                </details>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          No leads in queue. Run the intelligence pipeline first to generate approved leads.
        </div>
      )}
    </div>
  )
}
