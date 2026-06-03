import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSetting, setSetting } from '../lib/tauri/commands'

interface SettingsState {
  claudeApiKey: string
  azureApiKey: string
  azureRegion: string
  schoolName: string
  isLoaded: boolean

  loadSettings: () => Promise<void>
  setClaudeApiKey: (key: string) => Promise<void>
  setAzureApiKey: (key: string) => Promise<void>
  setAzureRegion: (region: string) => Promise<void>
  setSchoolName: (name: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      claudeApiKey: '',
      azureApiKey: '',
      azureRegion: 'westeurope',
      schoolName: 'SkoolBox Demo School',
      isLoaded: false,

      loadSettings: async () => {
        try {
          const [claudeKey, azureKey, azureRegion, schoolName] = await Promise.all([
            getSetting('claude_api_key'),
            getSetting('azure_tts_key'),
            getSetting('azure_tts_region'),
            getSetting('school_name'),
          ])
          set({
            claudeApiKey: claudeKey || '',
            azureApiKey: azureKey || '',
            azureRegion: azureRegion || 'westeurope',
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

      setAzureApiKey: async (key) => {
        set({ azureApiKey: key })
        try { await setSetting('azure_tts_key', key) } catch { /* localStorage fallback */ }
      },

      setAzureRegion: async (region) => {
        set({ azureRegion: region })
        try { await setSetting('azure_tts_region', region) } catch { /* localStorage fallback */ }
      },

      setSchoolName: async (name) => {
        set({ schoolName: name })
        try { await setSetting('school_name', name) } catch { /* localStorage fallback */ }
      },
    }),
    { name: 'skoolbox-settings' }
  )
)
