/**
 * Martha's classroom voice.
 *
 * In the Tauri app we speak through the system speech engine on the Rust side
 * (plays out the classroom speakers, works fully offline) — `speak()` resolves
 * when narration finishes, so the lesson can advance like a real class.
 * In a plain browser (npm run dev) we fall back to the Web Speech API.
 */
import { isTauri } from '../tauri/commands'
import { marthaTTS } from './browserTTS'

export async function speak(text: string): Promise<void> {
  if (!text?.trim()) return
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    // Resolves when `spd-say -w` finishes speaking the whole line.
    await invoke('speak_text', { text })
    return
  }
  // Browser dev fallback.
  return new Promise<void>((resolve) => marthaTTS.speak(text, 0.95, resolve))
}

export async function stopSpeaking(): Promise<void> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    try { await invoke('stop_speaking') } catch { /* ignore */ }
    return
  }
  marthaTTS.stop()
}

/** Whether an offline speech engine is available (Tauri only). */
export async function voiceAvailable(): Promise<boolean> {
  if (!isTauri) return 'speechSynthesis' in window
  const { invoke } = await import('@tauri-apps/api/core')
  try { return await invoke<boolean>('tts_available') } catch { return false }
}
