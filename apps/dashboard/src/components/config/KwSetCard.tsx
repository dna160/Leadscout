"use client"

import { useState, useRef, KeyboardEvent } from "react"
import type { KeywordSet } from "@/domain/config"
import { SEGMENT_COLOURS, SEGMENT_LABELS } from "@/domain/segment"
import { Badge } from "@/components/ui/badge"
import { apiPatch, apiDelete } from "@/lib/api"

interface KwSetCardProps {
  kwSet: KeywordSet
  onUpdate: (id: string, data: Partial<KeywordSet>) => void
  onDelete: (id: string) => void
}

export function KwSetCard({ kwSet, onUpdate, onDelete }: KwSetCardProps) {
  const [newKeyword, setNewKeyword] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function patchSet(data: Partial<KeywordSet>) {
    setSaving(true)
    try {
      await apiPatch<KeywordSet>(`/api/keyword-sets/${kwSet.id}`, data)
      onUpdate(kwSet.id, data)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEnabled() {
    await patchSet({ enabled: !kwSet.enabled })
  }

  async function handleRemoveKeyword(kw: string) {
    const keywords = kwSet.keywords.filter((k) => k !== kw)
    await patchSet({ keywords })
  }

  async function handleAddKeyword() {
    const trimmed = newKeyword.trim()
    if (!trimmed || kwSet.keywords.includes(trimmed)) {
      setNewKeyword("")
      return
    }
    const keywords = [...kwSet.keywords, trimmed]
    await patchSet({ keywords })
    setNewKeyword("")
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleAddKeyword()
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete keyword set "${kwSet.label}"?`)) return
    setSaving(true)
    try {
      await apiDelete(`/api/keyword-sets/${kwSet.id}`)
      onDelete(kwSet.id)
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  const segmentKey = kwSet.segment as keyof typeof SEGMENT_COLOURS

  return (
    <div className="bg-white shadow-sm rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={SEGMENT_COLOURS[segmentKey]}>
            {SEGMENT_LABELS[segmentKey]}
          </Badge>
          <span className="text-sm font-medium text-gray-900 truncate">
            {kwSet.label}
          </span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={kwSet.enabled}
            onChange={() => void handleToggleEnabled()}
            disabled={saving}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-500">Enabled</span>
        </label>
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap gap-1.5">
        {kwSet.keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-medium"
          >
            {kw}
            <button
              onClick={() => void handleRemoveKeyword(kw)}
              disabled={saving}
              className="text-gray-400 hover:text-red-500 transition-colors leading-none"
              aria-label={`Remove ${kw}`}
            >
              ✕
            </button>
          </span>
        ))}
        {kwSet.keywords.length === 0 && (
          <span className="text-xs text-gray-400 italic">No keywords yet</span>
        )}
      </div>

      {/* Add keyword */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add keyword..."
          disabled={saving}
          className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={() => void handleAddKeyword()}
          disabled={saving || !newKeyword.trim()}
          className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Add
        </button>
      </div>

      {/* Footer */}
      <div className="flex justify-end">
        <button
          onClick={() => void handleDelete()}
          disabled={saving}
          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors font-medium"
        >
          Delete set
        </button>
      </div>
    </div>
  )
}
