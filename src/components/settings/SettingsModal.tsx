import { useState } from 'react'
import { X, Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '../../stores/useSettingsStore'
import useTTSStore from '../../stores/useTTSStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { claudeApiKey, setClaudeApiKey } = useSettingsStore()
  const { rate, setRate } = useTTSStore()

  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const [localClaudeKey, setLocalClaudeKey] = useState(claudeApiKey)
  const [saved, setSaved] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    await setClaudeApiKey(localClaudeKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClasses =
    'w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-secondary">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Claude API Key — optional dev/online backend; the app runs fully offline on Ollama by default */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" />
            Claude API Key <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              type={showClaudeKey ? 'text' : 'password'}
              value={localClaudeKey}
              onChange={(e) => setLocalClaudeKey(e.target.value)}
              placeholder="sk-ant-..."
              className={`${inputClasses} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowClaudeKey(!showClaudeKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showClaudeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            Optional online backend for development. The app runs fully offline on the local model by default.
          </p>
          {localClaudeKey && (
            <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
              <CheckCircle className="w-3 h-3" /> Key configured
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border my-5" />

        {/* Speech speed */}
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
                  rate === r.value ? 'bg-primary text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status indicators */}
        <div className="space-y-2 mb-5">
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            localClaudeKey ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {localClaudeKey ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {localClaudeKey ? 'Online Claude backend configured' : 'Running offline on the local model (default)'}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-green-50 text-green-700">
            <CheckCircle className="w-4 h-4" />
            Offline neural voice active — no internet required
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
            saved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark'
          }`}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
