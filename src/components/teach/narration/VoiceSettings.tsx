import { useState } from 'react'
import { X, Mic } from 'lucide-react'
import useTTSStore from '../../../stores/useTTSStore'

export default function VoiceSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const { rate, setRate } = useTTSStore()

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
      >
        <Mic className="w-4 h-4" />
        Voice
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">Voice Settings</h2>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-bg-secondary">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Speech rate */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 block">Speech Speed</label>
          <div className="flex gap-2">
            {[
              { value: '-15%', label: 'Slow' },
              { value: '-5%', label: 'Normal' },
              { value: '+5%', label: 'Fast' },
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => setRate(r.value)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  rate === r.value
                    ? 'bg-primary text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-green-50 text-green-700">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Offline neural voice — no internet required
        </div>

        <button
          onClick={() => setIsOpen(false)}
          className="w-full mt-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
