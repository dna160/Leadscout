"use client"

import { useState } from "react"
import type { City } from "@/domain/config"
import { apiPatch } from "@/lib/api"

interface CityChipsProps {
  cities: City[]
  onToggle: (id: string, enabled: boolean) => void
}

export function CityChips({ cities, onToggle }: CityChipsProps) {
  const [toggling, setToggling] = useState<string | null>(null)

  async function handleToggle(city: City) {
    if (toggling === city.id) return
    setToggling(city.id)
    try {
      await apiPatch<City>(`/api/cities/${city.id}`, { enabled: !city.enabled })
      onToggle(city.id, !city.enabled)
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(null)
    }
  }

  if (cities.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No cities configured.</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {cities.map((city) => (
        <button
          key={city.id}
          onClick={() => void handleToggle(city)}
          disabled={toggling === city.id}
          className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            city.enabled
              ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
          }`}
        >
          {city.name}
        </button>
      ))}
    </div>
  )
}
