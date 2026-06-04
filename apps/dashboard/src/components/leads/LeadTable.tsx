"use client"

import Link from "next/link"
import type { Lead } from "@/domain/lead"
import { SEGMENT_COLOURS, SEGMENT_LABELS } from "@/domain/segment"
import { Badge } from "@/components/ui/badge"

interface LeadTableProps {
  leads: Lead[]
  loading?: boolean
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

interface ChipLinkProps {
  href: string
  label: string
  colorClass: string
  external?: boolean
}

function ChipLink({ href, label, colorClass, external }: ChipLinkProps) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`inline-flex items-center text-xs px-2 py-1 rounded font-medium ${colorClass}`}
    >
      {label}
    </a>
  )
}

export function LeadTable({ leads, loading = false }: LeadTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "City", "Segment", "Rating", "Contacts", "Website"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <p className="text-gray-500 mb-2">
          No leads yet — configure keywords and run a scrape
        </p>
        <Link
          href="/config"
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          Go to Configuration →
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Name", "City", "Segment", "Rating", "Contacts", "Website"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
              {/* Name + category */}
              <td className="px-4 py-3 max-w-[200px]">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {lead.name}
                </p>
                {lead.category && (
                  <p className="text-xs text-gray-500 truncate">{lead.category}</p>
                )}
              </td>

              {/* City */}
              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                {lead.city ?? "—"}
              </td>

              {/* Segment badge */}
              <td className="px-4 py-3 whitespace-nowrap">
                {lead.segment ? (
                  <Badge className={SEGMENT_COLOURS[lead.segment]}>
                    {SEGMENT_LABELS[lead.segment]}
                  </Badge>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>

              {/* Rating */}
              <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                {lead.rating !== null ? (
                  <span>⭐ {lead.rating.toFixed(1)}</span>
                ) : (
                  "—"
                )}
              </td>

              {/* Contacts */}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {lead.phone && (
                    <ChipLink
                      href={`tel:${lead.phone}`}
                      label="Phone"
                      colorClass="bg-gray-100 text-gray-700 hover:bg-gray-200"
                    />
                  )}
                  {lead.whatsapp && (
                    <ChipLink
                      href={lead.whatsapp}
                      label="WhatsApp"
                      colorClass="bg-green-100 text-green-700 hover:bg-green-200"
                      external
                    />
                  )}
                  {lead.email && (
                    <ChipLink
                      href={`mailto:${lead.email}`}
                      label="Email"
                      colorClass="bg-blue-100 text-blue-700 hover:bg-blue-200"
                    />
                  )}
                  {lead.instagram && (
                    <ChipLink
                      href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`}
                      label="IG"
                      colorClass="bg-pink-100 text-pink-700 hover:bg-pink-200"
                      external
                    />
                  )}
                  {lead.maps_url && (
                    <ChipLink
                      href={lead.maps_url}
                      label="Maps"
                      colorClass="bg-purple-100 text-purple-700 hover:bg-purple-200"
                      external
                    />
                  )}
                </div>
              </td>

              {/* Website */}
              <td className="px-4 py-3 max-w-[160px]">
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate block"
                    title={lead.website}
                  >
                    {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
