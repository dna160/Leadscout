import type { LeadStats } from "@/domain/lead"

interface StatCardsProps {
  stats: LeadStats
  onRejectedClick?: () => void
}

interface CardProps {
  title: string
  value: number
  valueClassName?: string
  onClick?: () => void
}

function Card({ title, value, valueClassName = "text-gray-900", onClick }: CardProps) {
  return (
    <div
      className={`bg-white shadow-sm rounded-lg p-4 ${onClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}`}
      onClick={onClick}
    >
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClassName}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export function StatCards({ stats, onRejectedClick }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      <Card title="Total Leads" value={stats.total} />
      <Card title="Hot" value={stats.hot} valueClassName="text-red-600" />
      <Card title="Warm" value={stats.warm} valueClassName="text-amber-600" />
      <Card title="Cold" value={stats.cold} valueClassName="text-blue-600" />
      <Card title="This Week" value={stats.thisWeek} />
      <Card
        title="Rejected"
        value={stats.rejected}
        valueClassName="text-gray-400"
        onClick={onRejectedClick}
      />
    </div>
  )
}
