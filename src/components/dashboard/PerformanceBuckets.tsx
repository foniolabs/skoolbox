import { User } from 'lucide-react'
import type { ClassOverview } from '../../lib/tauri/commands'

interface BucketCardProps {
  count: number
  percentage: string
  label: string
  bgColor: string
}

function BucketCard({ count, percentage, label, bgColor }: BucketCardProps) {
  return (
    <div className={`${bgColor} rounded-[20px] shadow-card p-6 text-white relative overflow-hidden`}>
      {/* Avatar circle in top-right */}
      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        <User className="w-5 h-5 text-white/80" />
      </div>

      <p className="text-4xl font-bold mb-1">{count}</p>
      <p className="text-sm text-white/80 mb-3">{percentage} of class</p>
      <p className="text-base font-semibold">{label}</p>
    </div>
  )
}

interface PerformanceBucketsProps {
  overview: ClassOverview | null
  loading: boolean
}

export default function PerformanceBuckets({ overview, loading }: PerformanceBucketsProps) {
  const total = overview?.total_students || 1
  const mastered = overview?.mastered_count ?? 0
  const working = overview?.working_towards_count ?? 0
  const attention = overview?.needs_attention_count ?? 0

  const pct = (n: number) => `${Math.round((n / total) * 100)}%`

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${loading ? 'animate-pulse' : ''}`}>
      <BucketCard
        count={mastered}
        percentage={pct(mastered)}
        label="Mastered"
        bgColor="bg-card-green"
      />
      <BucketCard
        count={working}
        percentage={pct(working)}
        label="Working Towards"
        bgColor="bg-card-orange"
      />
      <BucketCard
        count={attention}
        percentage={pct(attention)}
        label="Needs Attention"
        bgColor="bg-card-coral"
      />
    </div>
  )
}
