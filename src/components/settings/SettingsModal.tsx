import { useState } from 'react'
import { X, Key, Globe, Mic, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '../../stores/useSettingsStore'
import useTTSStore from '../../stores/useTTSStore'
import CustomDropdown from '../shared/CustomDropdown'
import type { NigerianVoice } from '../../lib/tts/azureTTS'

const regionOptions = [
  { label: 'West Europe', value: 'westeurope' },
  { label: 'East US', value: 'eastus' },
  { label: 'South Africa North', value: 'southafricanorth' },
  { label: 'UK South', value: 'uksouth' },
  { label: 'Central US', value: 'centralus' },
  { label: 'Southeast Asia', value: 'southeastasia' },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    claudeApiKey, azureApiKey, azureRegion,
    setClaudeApiKey, setAzureApiKey, setAzureRegion,
  } = useSettingsStore()

  const { voice, rate, setVoice, setRate } = useTTSStore()

  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const [showAzureKey, setShowAzureKey] = useState(false)
  const [localClaudeKey, setLocalClaudeKey] = useState(claudeApiKey)
  const [localAzureKey, setLocalAzureKey] = useState(azureApiKey)
  const [saved, setSaved] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    await Promise.all([
      setClaudeApiKey(localClaudeKey),
      setAzureApiKey(localAzureKey),
    ])
    // Sync Azure key to TTS store so narration picks it up
    useTTSStore.getState().setAzureKey(localAzureKey)
    useTTSStore.getState().setAzureRegion(azureRegion)
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

        {/* Claude API Key */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" />
            Claude API Key
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
            Required for AI lesson generation and quiz creation. Get one at console.anthropic.com
          </p>
          {localClaudeKey && (
            <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
              <CheckCircle className="w-3 h-3" /> Key configured
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border my-5" />

        {/* Azure TTS Key */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" />
            Azure Speech API Key
          </label>
          <div className="relative">
            <input
              type={showAzureKey ? 'text' : 'password'}
              value={localAzureKey}
              onChange={(e) => setLocalAzureKey(e.target.value)}
              placeholder="Enter your Azure subscription key"
              className={`${inputClasses} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowAzureKey(!showAzureKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showAzureKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            For natural Nigerian voice narration. Get a free key at portal.azure.com. Without a key, the app uses browser voices.
          </p>
        </div>

        {/* Azure Region */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Azure Region
          </label>
          <CustomDropdown
            options={regionOptions}
            value={azureRegion}
            onChange={(v) => setAzureRegion(v)}
          />
        </div>

        {/* Voice Settings */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 block">Nigerian Voice</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'Ezinne' as NigerianVoice, label: 'Ezinne', desc: 'Female, warm & clear' },
              { id: 'Abeo' as NigerianVoice, label: 'Abeo', desc: 'Male, confident & calm' },
            ]).map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  voice === v.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="font-semibold text-text-primary text-sm">{v.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Speed */}
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
            {localClaudeKey ? 'Claude AI ready for lesson generation' : 'No Claude API key - AI features will use offline templates'}
          </div>
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            localAzureKey ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {localAzureKey ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {localAzureKey ? 'Azure TTS configured - natural Nigerian voices active' : 'No Azure key - using browser voices as fallback'}
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
