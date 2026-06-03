import { NavLink } from 'react-router-dom'
import { Home, BookOpen, Bot, FileQuestion, BarChart3, Settings } from 'lucide-react'

const tabs = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Subjects', icon: BookOpen, to: '/subjects' },
  { label: 'AI Tutor', icon: Bot, to: '/ai-tutor' },
  { label: 'Quizzes', icon: FileQuestion, to: '/quizzes' },
  { label: 'Progress', icon: BarChart3, to: '/progress' },
  { label: 'Settings', icon: Settings, to: '#' },
]

export default function TabBar() {
  return (
    <nav className="bg-bg-primary shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive && to !== '#'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
