import { Pause, Play, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'

interface TeacherControlsProps {
  isPlaying: boolean
  currentStep: number
  totalSteps: number
  modeName: string
  isMuted: boolean
  onTogglePlay: () => void
  onPrev: () => void
  onNext: () => void
  onRepeat: () => void
  onToggleMute: () => void
  onExit: () => void
}

export default function TeacherControls({
  isPlaying, currentStep, totalSteps, modeName,
  isMuted, onTogglePlay, onPrev, onNext, onRepeat,
  onToggleMute, onExit,
}: TeacherControlsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border shadow-lg">
      <div className="mx-auto max-w-[1200px] px-6 py-3 flex items-center justify-between">
        {/* Left: playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={onPrev} disabled={currentStep === 0}
            className="w-9 h-9 rounded-lg text-text-secondary hover:bg-bg-secondary flex items-center justify-center disabled:opacity-30 transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button onClick={onNext} disabled={currentStep >= totalSteps - 1}
            className="w-9 h-9 rounded-lg text-text-secondary hover:bg-bg-secondary flex items-center justify-center disabled:opacity-30 transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
          <button onClick={onRepeat}
            className="w-9 h-9 rounded-lg text-text-secondary hover:bg-bg-secondary flex items-center justify-center transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={onToggleMute}
            className="w-9 h-9 rounded-lg text-text-secondary hover:bg-bg-secondary flex items-center justify-center transition-colors">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Center: step info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Progress dots */}
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < currentStep ? 'bg-primary' : i === currentStep ? 'bg-primary scale-125' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          <span className="text-sm text-text-secondary">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-xs text-text-muted px-2 py-1 bg-bg-secondary rounded-lg capitalize">
            {modeName}
          </span>
        </div>

        {/* Right: exit */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-card-coral hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}
