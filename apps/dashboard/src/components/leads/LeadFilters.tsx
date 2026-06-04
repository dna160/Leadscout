"use client"

import type { LeadFilters, Segment } from "@/domain/lead"

interface LeadFiltersProps {
  filters: LeadFilters
  cities: string[]
  onChange: (f: LeadFilters) => void
}

const SEGMENTS: { value: Segment | ""; label: string }[] = [
  { value: "", label: "All Segments" },
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
  { value: "drop", label: "Drop" },
]

export function LeadFilters({ filters, cities, onChange }: LeadFiltersProps) {
  const inputClass =
    "border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        type="text"
        placeholder="Search venues..."
        value={filters.search ?? ""}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        className={`${inputClass} min-w-[200px]`}
      />

      <select
        value={filters.segment ?? ""}
        onChange={(e) =>
          onChange({
            ...filters,
            segment: (e.target.value as Segment) || undefined,
          })
        }
        className={inputClass}
      >
        {SEGMENTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={filters.city ?? ""}
        onChange={(e) =>
          onChange({ ...filters, city: e.target.value || undefined })
        }
        className={inputClass}
      >
        <option value="">All Cities</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </div>
  )
}
