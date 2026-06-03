import { Clock, PenLine, Video, Sparkles, Presentation, Mic } from 'lucide-react'
import useTeachStore, { type PresentationMode } from '../../stores/useTeachStore'

const modeIcons: Record<PresentationMode, typeof PenLine> = {
  whiteboard: PenLine,
  video: Video,
  animation: Sparkles,
  slideshow: Presentation,
  narrated: Mic,
  auto: Sparkles,
}

const modeColors: Record<PresentationMode, string> = {
  whiteboard: 'bg-blue-50 text-blue-600',
  video: 'bg-red-50 text-red-500',
  animation: 'bg-purple-50 text-purple-600',
  slideshow: 'bg-amber-50 text-amber-600',
  narrated: 'bg-green-50 text-green-600',
  auto: 'bg-gray-50 text-gray-600',
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return 'Last week'
}

export default function RecentLessons() {
  const { recentLessons } = useTeachStore()

  return (
    <div className="bg-white rounded-[20px] shadow-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-text-secondary" />
        <h3 className="text-sm font-semibold text-text-primary">Recent Lessons</h3>
      </div>
      <div className="space-y-2">
        {recentLessons.map((lesson) => {
          const Icon = modeIcons[lesson.mode]
          const colorClass = modeColors[lesson.mode]
          return (
            <button
              key={lesson.id}
              className="w-full flex items-center gap-3 rounded-xl p-3 hover:bg-bg-secondary transition-colors text-left"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{lesson.title}</p>
                <p className="text-xs text-text-muted">{lesson.subject}</p>
              </div>
              <span className="text-xs text-text-muted flex-shrink-0">{getRelativeDate(lesson.date)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
