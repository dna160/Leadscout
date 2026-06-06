"use client"

import { useEffect, useState } from "react"
import type { KeywordSet, City, ScrapeRun } from "@/domain/config"
import type { Segment } from "@/domain/lead"
import { apiGet, apiPost } from "@/lib/api"
import { KwSetCard } from "@/components/config/KwSetCard"
import { CityChips } from "@/components/config/CityChips"
import { RunPanel } from "@/components/config/RunPanel"
import { FilterRules } from "@/components/config/FilterRules"
import { SEGMENT_LABELS } from "@/domain/segment"

const SEGMENTS: Segment[] = ["hot", "warm", "cold", "drop"]

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-gray-800 mb-3">{children}</h2>
  )
}

export default function ConfigPage() {
  const [kwSets, setKwSets] = useState<KeywordSet[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [runs, setRuns] = useState<ScrapeRun[]>([])
  const [loading, setLoading] = useState(true)

  // Add-set form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSegment, setNewSegment] = useState<Segment>("warm")
  const [newLabel, setNewLabel] = useState("")
  const [newKeywords, setNewKeywords] = useState("")
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const [kwData, cityData, runData] = await Promise.all([
          apiGet<KeywordSet[]>("/api/keyword-sets"),
          apiGet<City[]>("/api/cities"),
          apiGet<ScrapeRun[]>("/api/runs"),
        ])
        setKwSets(kwData)
        setCities(cityData)
        setRuns(runData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    void fetchAll()
  }, [])

  function handleKwUpdate(id: string, data: Partial<KeywordSet>) {
    setKwSets((prev) =>
      prev.map((kw) => (kw.id === id ? { ...kw, ...data } : kw))
    )
  }

  function handleKwDelete(id: string) {
    setKwSets((prev) => prev.filter((kw) => kw.id !== id))
  }

  function handleCityToggle(id: string, enabled: boolean) {
    setCities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    )
  }

  async function handleAddSet(e: React.FormEvent) {
    e.preventDefault()
    const trimmedLabel = newLabel.trim()
    if (!trimmedLabel) return
    const keywords = newKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

    setAddSaving(true)
    try {
      const created = await apiPost<KeywordSet>("/api/keyword-sets", {
        segment: newSegment,
        label: trimmedLabel,
        keywords,
      })
      setKwSets((prev) => [...prev, created])
      setNewLabel("")
      setNewKeywords("")
      setNewSegment("warm")
      setShowAddForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setAddSaving(false)
    }
  }

  const inputClass =
    "border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Configuration</h1>

      {/* Keyword Sets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>Keyword Sets</SectionHeading>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            {showAddForm ? "Cancel" : "Add Set"}
          </button>
        </div>

        {/* Add Set Inline Form */}
        {showAddForm && (
          <form
            onSubmit={(e) => void handleAddSet(e)}
            className="bg-white shadow-sm rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Segment</label>
              <select
                value={newSegment}
                onChange={(e) => setNewSegment(e.target.value as Segment)}
                className={inputClass}
                disabled={addSaving}
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {SEGMENT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-600">Label</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Restaurants"
                required
                disabled={addSaving}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-600">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="restaurant, cafe, bistro"
                disabled={addSaving}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={addSaving || !newLabel.trim()}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {addSaving ? "Saving…" : "Create"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white shadow-sm rounded-lg p-4 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : kwSets.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No keyword sets yet. Add one above.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kwSets.map((kw) => (
              <KwSetCard
                key={kw.id}
                kwSet={kw}
                onUpdate={handleKwUpdate}
                onDelete={handleKwDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Target Cities */}
      <section>
        <SectionHeading>Target Cities</SectionHeading>
        {loading ? (
          <div className="flex flex-wrap gap-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 bg-gray-200 rounded-full" />
            ))}
          </div>
        ) : (
          <CityChips cities={cities} onToggle={handleCityToggle} />
        )}
      </section>

      {/* Filter Rules */}
      <section>
        <SectionHeading>Filter Rules</SectionHeading>
        <FilterRules />
      </section>

      {/* Scrape */}
      <section>
        <SectionHeading>Scrape</SectionHeading>
        <RunPanel runs={runs} />
      </section>
    </div>
  )
}
