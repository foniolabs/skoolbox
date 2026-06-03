import { useState } from 'react'
import { X, Mic, Key, Globe } from 'lucide-react'
import useTTSStore from '../../../stores/useTTSStore'
import type { NigerianVoice } from '../../../lib/tts/azureTTS'
import CustomDropdown from '../../shared/CustomDropdown'

const regionOptions = [
  { label: 'West Europe', value: 'westeurope' },
  { label: 'East US', value: 'eastus' },
  { label: 'South Africa North', value: 'southafricanorth' },
  { label: 'UK South', value: 'uksouth' },
  { label: 'Central US', value: 'centralus' },
  { label: 'Southeast Asia', value: 'southeastasia' },
]

export default function VoiceSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const { azureKey, azureRegion, voice, rate, setAzureKey, setAzureRegion, setVoice, setRate } = useTTSStore()

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
      >
        <Mic className="w-4 h-4" />
        Voice: {voice === 'Ezinne' ? 'Ezinne (Female)' : 'Abeo (Male)'}
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

        {/* Voice selection */}
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
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  voice === v.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="font-semibold text-text-primary">{v.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">{v.desc}</p>
              </button>
            ))}
          </div>
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

        {/* Azure API Key */}
        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" />
            Azure Speech API Key
          </label>
          <input
            type="password"
            value={azureKey}
            onChange={(e) => setAzureKey(e.target.value)}
            placeholder="Enter your Azure subscription key"
            className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          <p className="text-xs text-text-muted mt-1.5">
            Get a free key at portal.azure.com &rarr; Speech Services. Without a key, the app falls back to browser voices.
          </p>
        </div>

        {/* Azure Region */}
        <div className="mb-6">
          <label className="text-sm font-medium text-text-primary mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Azure Region
          </label>
          <CustomDropdown
            options={regionOptions}
            value={azureRegion}
            onChange={setAzureRegion}
          />
        </div>

        {/* Status indicator */}
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          azureKey ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${azureKey ? 'bg-green-500' : 'bg-amber-500'}`} />
          {azureKey
            ? 'Azure TTS configured — natural Nigerian voices active'
            : 'No API key — using browser voices as fallback'
          }
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
