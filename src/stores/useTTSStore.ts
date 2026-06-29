import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Offline build: narration runs through the Rust-side Piper neural TTS (single
// bundled voice today — en_US-amy; a Nigerian voice is planned for v1.1). The
// old cloud Azure voices (Ezinne/Abeo) were removed for the fully-offline MVP.
interface TTSState {
  rate: string
  pitch: string
  setRate: (rate: string) => void
  setPitch: (pitch: string) => void
}

const useTTSStore = create<TTSState>()(
  persist(
    (set) => ({
      rate: '-5%',
      pitch: '0%',
      setRate: (rate) => set({ rate }),
      setPitch: (pitch) => set({ pitch }),
    }),
    { name: 'skoolbox-tts-settings' }
  )
)

export default useTTSStore
