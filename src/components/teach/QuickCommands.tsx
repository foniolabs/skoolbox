import { Lightbulb } from 'lucide-react'

const suggestions = [
  'Explain today\'s topic',
  'Show a video on fractions',
  'Quiz the class on Chapter 3',
  'Review last week\'s homework',
  'Introduce new topic',
  'Solve practice problems',
]

interface QuickCommandsProps {
  onSelectCommand: (command: string) => void
}

export default function QuickCommands({ onSelectCommand }: QuickCommandsProps) {
  return (
    <div className="bg-white rounded-[20px] shadow-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-card-orange" />
        <h3 className="text-sm font-semibold text-text-primary">Quick Commands</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((cmd) => (
          <button
            key={cmd}
            onClick={() => onSelectCommand(cmd)}
            className="rounded-full border border-border bg-white px-4 py-2 text-sm text-text-secondary hover:bg-primary hover:text-white hover:border-primary transition-all duration-200"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  )
}
