"use client"

import { useState } from "react"
import type { Lead } from "@/domain/lead"
import { Badge } from "@/components/ui/badge"

interface RejectedTableProps {
  leads: Lead[]
  loading?: boolean
  onRestore: (id: string) => Promise<void>
}

export function RejectedTable({ leads, loading = false, onRestore }: RejectedTableProps) {
  const [restoring, setRestoring] = useState<string | null>(null)

  async function handleRestore(id: string) {
    setRestoring(id)
    try {
      await onRestore(id)
    } finally {
      setRestoring(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center text-gray-400">
        Loading…
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <p className="text-gray-500">No rejected leads.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Name", "City", "Layer", "Reason", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 max-w-[220px]">
                <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                {lead.category && (
                  <p className="text-xs text-gray-500 truncate">{lead.category}</p>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                {lead.city ?? "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {lead.reject_layer ? (
                  <Badge
                    className={
                      lead.reject_layer === "L3"
                        ? "bg-purple-100 text-purple-700 border-purple-200"
                        : "bg-orange-100 text-orange-700 border-orange-200"
                    }
                  >
                    {lead.reject_layer}
                  </Badge>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3 max-w-[320px]">
                <p className="text-xs text-gray-600 truncate" title={lead.reject_reason ?? ""}>
                  {lead.reject_reason ?? "—"}
                </p>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => void handleRestore(lead.id)}
                  disabled={restoring === lead.id}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {restoring === lead.id ? "Restoring…" : "Restore"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
