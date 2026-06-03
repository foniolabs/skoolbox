import { Trophy } from 'lucide-react'
import type { ClassOverview } from '../../lib/tauri/commands'

interface ClassScoreCardProps {
  overview: ClassOverview | null
  loading: boolean
}

export default function ClassScoreCard({ overview, loading }: ClassScoreCardProps) {
  const score = overview?.average_score ?? 0
  const workAssigned = overview?.total_work_assigned ?? 0

  return (
    <div className="bg-white rounded-[20px] shadow-card p-8 flex flex-col sm:flex-row gap-8">
      {/* Left: Overall Class Score */}
      <div className="flex-1">
        <p className="text-text-secondary text-sm font-medium mb-1">Overall Class Score</p>
        <p className={`text-4xl font-bold text-text-primary mb-4 ${loading ? 'animate-pulse' : ''}`}>
          {score}%
        </p>

        {/* Trophy illustration */}
        <div className="w-16 h-16 rounded-full bg-primary-light/20 flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>

        <p className="text-sm text-text-secondary">
          Grade average: <span className="font-semibold text-text-primary">{Math.round(score * 1.04)}%</span>
        </p>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-gray-100" />

      {/* Right: Work Assigned */}
      <div className="flex-1">
        <p className="text-text-secondary text-sm font-medium mb-1">Work Assigned</p>
        <p className={`text-4xl font-bold text-text-primary mb-4 ${loading ? 'animate-pulse' : ''}`}>
          {workAssigned}
        </p>

        <div className="mt-8">
          <p className="text-sm text-text-secondary">
            Total students: <span className="font-semibold text-text-primary">{overview?.total_students ?? 0}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
