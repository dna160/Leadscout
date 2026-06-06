"use client"

import { useEffect, useState } from "react"
import type { FilterRule, FilterRuleType } from "@/domain/config"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api"

const RULE_TYPES: { value: FilterRuleType; label: string }[] = [
  { value: "category_block", label: "Block category" },
  { value: "name_block", label: "Block name" },
  { value: "price_min", label: "Min price level" },
  { value: "rating_min", label: "Min rating" },
  { value: "reviews_min", label: "Min reviews" },
]

const TYPE_LABEL: Record<FilterRuleType, string> = {
  category_block: "Block category",
  name_block: "Block name",
  price_min: "Min price level",
  rating_min: "Min rating",
  reviews_min: "Min reviews",
}

export function FilterRules() {
  const [rules, setRules] = useState<FilterRule[]>([])
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState<FilterRuleType>("category_block")
  const [newValue, setNewValue] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await apiGet<FilterRule[]>("/api/filter-rules")
        setRules(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  async function handleToggle(rule: FilterRule) {
    try {
      const updated = await apiPatch<FilterRule>(`/api/filter-rules/${rule.id}`, {
        enabled: !rule.enabled,
      })
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/filter-rules/${id}`)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const value = newValue.trim()
    if (!value) return
    setSaving(true)
    try {
      const created = await apiPost<FilterRule>("/api/filter-rules", {
        type: newType,
        value,
      })
      setRules((prev) => [...prev, created])
      setNewValue("")
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => void handleAdd(e)} className="bg-white shadow-sm rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Rule type</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as FilterRuleType)}
            className={inputClass}
            disabled={saving}
          >
            {RULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600">Value</label>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={newType.endsWith("_block") ? "e.g. convenience store" : "e.g. 3.5"}
            disabled={saving}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !newValue.trim()}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {saving ? "Saving…" : "Add Rule"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400 italic">Loading filter rules…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No filter rules yet.</p>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Type", "Value", "Enabled", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{TYPE_LABEL[rule.type]}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.value}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void handleToggle(rule)}
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        rule.enabled
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {rule.enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void handleDelete(rule.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
