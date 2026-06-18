"use client"

import { useEffect, useState, useCallback } from "react"
import { apiGet, apiPost } from "@/lib/api"

interface Reply {
  id: string
  lead_id: string | null
  message_id: string
  in_reply_to: string | null
  from_addr: string | null
  subject: string | null
  body: string | null
  received_at: string | null
  created_at: string
}

export default function InboxPage() {
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollResult, setPollResult] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchReplies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ replies: Reply[] }>("/api/inbox")
      setReplies(data.replies)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchReplies() }, [fetchReplies])

  const pollNow = useCallback(async () => {
    setPolling(true)
    setPollResult(null)
    try {
      const r = await apiPost<{ fetched: number; new: number; optOuts: number; errors: number }>(
        "/api/inbox/poll"
      )
      setPollResult(`Fetched ${r.fetched}, ${r.new} new, ${r.optOuts} opt-outs`)
      void fetchReplies()
    } catch (err) {
      setPollResult(err instanceof Error ? err.message : "Poll failed")
    } finally {
      setPolling(false)
    }
  }, [fetchReplies])

  function timeAgo(iso: string | null) {
    if (!iso) return ""
    const d = new Date(iso)
    const mins = Math.floor((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  if (loading) return <div className="p-8 text-gray-500">Loading inbox…</div>

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reply Inbox</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Replies received on the Hostinger business inbox — threaded to leads.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pollResult && (
            <span className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded">
              {pollResult}
            </span>
          )}
          <button
            onClick={() => void pollNow()}
            disabled={polling}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {polling ? "Polling…" : "Poll Now"}
          </button>
          <button
            onClick={() => void fetchReplies()}
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

      {replies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📬</p>
          <p>No replies yet. Press &ldquo;Poll Now&rdquo; to check the inbox.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === reply.id ? null : reply.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {reply.from_addr ?? "(unknown sender)"}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {reply.subject ?? "(no subject)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {reply.lead_id ? (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">
                        threaded
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded">
                        unthreaded
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{timeAgo(reply.received_at)}</span>
                    <span className="text-gray-400">{expanded === reply.id ? "▲" : "▼"}</span>
                  </div>
                </div>
              </button>

              {expanded === reply.id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3 text-xs text-gray-500 space-y-1 mb-3">
                    <p><span className="font-medium">From:</span> {reply.from_addr}</p>
                    <p><span className="font-medium">Subject:</span> {reply.subject}</p>
                    <p><span className="font-medium">Received:</span> {reply.received_at ? new Date(reply.received_at).toLocaleString() : "—"}</p>
                    {reply.lead_id && (
                      <p><span className="font-medium">Lead ID:</span> {reply.lead_id}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {reply.body ?? "(empty body)"}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
