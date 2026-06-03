import { useEffect } from 'react'
import { Bot } from 'lucide-react'
import TeachCommandBar from '../components/teach/TeachCommandBar'
import QuickCommands from '../components/teach/QuickCommands'
import RecentLessons from '../components/teach/RecentLessons'
import useTeachStore from '../stores/useTeachStore'

export default function TeachPage() {
  const { setCommand, loadRecentLessons } = useTeachStore()

  useEffect(() => {
    loadRecentLessons()
  }, [loadRecentLessons])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Teaching Assistant</h1>
          <p className="text-sm text-text-secondary">Type a command and let AI deliver the lesson</p>
        </div>
      </div>

      {/* Command bar */}
      <TeachCommandBar />

      {/* Quick commands + Recent lessons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickCommands onSelectCommand={setCommand} />
        <RecentLessons />
      </div>
    </div>
  )
}
