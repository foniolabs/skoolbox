import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSetting, setSetting } from '../lib/tauri/commands'

// Cloud Azure TTS settings were removed for the fully-offline MVP — narration
// runs through the bundled Rust-side Piper neural voice. The Claude key remains
// only as an optional online dev backend; the app defaults to offline Ollama.
interface SettingsState {
  claudeApiKey: string
  schoolName: string
  isLoaded: boolean

  loadSettings: () => Promise<void>
  setClaudeApiKey: (key: string) => Promise<void>
  setSchoolName: (name: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      claudeApiKey: '',
      schoolName: 'SkoolBox Demo School',
      isLoaded: false,

      loadSettings: async () => {
        try {
          const [claudeKey, schoolName] = await Promise.all([
            getSetting('claude_api_key'),
            getSetting('school_name'),
          ])
          set({
            claudeApiKey: claudeKey || '',
            schoolName: schoolName || 'SkoolBox Demo School',
            isLoaded: true,
          })
        } catch {
          set({ isLoaded: true })
        }
      },

      setClaudeApiKey: async (key) => {
        set({ claudeApiKey: key })
        try { await setSetting('claude_api_key', key) } catch { /* localStorage fallback via persist */ }
      },

      setSchoolName: async (name) => {
        set({ schoolName: name })
        try { await setSetting('school_name', name) } catch { /* localStorage fallback */ }
      },
    }),
    { name: 'skoolbox-settings' }
  )
)
