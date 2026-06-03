import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NigerianVoice } from '../lib/tts/azureTTS'

interface TTSState {
  azureKey: string
  azureRegion: string
  voice: NigerianVoice
  rate: string
  pitch: string
  setAzureKey: (key: string) => void
  setAzureRegion: (region: string) => void
  setVoice: (voice: NigerianVoice) => void
  setRate: (rate: string) => void
  setPitch: (pitch: string) => void
}

const useTTSStore = create<TTSState>()(
  persist(
    (set) => ({
      azureKey: '',
      azureRegion: 'westeurope',
      voice: 'Ezinne', // Default to female Nigerian voice
      rate: '-5%',
      pitch: '0%',
      setAzureKey: (key) => set({ azureKey: key }),
      setAzureRegion: (region) => set({ azureRegion: region }),
      setVoice: (voice) => set({ voice }),
      setRate: (rate) => set({ rate }),
      setPitch: (pitch) => set({ pitch }),
    }),
    { name: 'skoolbox-tts-settings' }
  )
)

export default useTTSStore
