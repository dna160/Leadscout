import type { LeadStats } from "@/domain/lead"

interface StatCardsProps {
  stats: LeadStats
}

interface CardProps {
  title: string
  value: number
  valueClassName?: string
}

function Card({ title, value, valueClassName = "text-gray-900" }: CardProps) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClassName}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
      <Card title="Total Leads" value={stats.total} />
      <Card title="Hot" value={stats.hot} valueClassName="text-red-600" />
      <Card title="Warm" value={stats.warm} valueClassName="text-amber-600" />
      <Card title="Cold" value={stats.cold} valueClassName="text-blue-600" />
      <Card title="This Week" value={stats.thisWeek} />
    </div>
  )
}
