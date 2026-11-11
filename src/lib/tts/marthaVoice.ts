/**
 * Martha's classroom voice.
 *
 * In the Tauri app we speak through the system speech engine on the Rust side
 * (plays out the classroom speakers, works fully offline) — `speak()` resolves
 * when narration finishes, so the lesson can advance like a real class.
 * Where that engine isn't installed (Windows has none by default) or in a plain
 * browser (npm run dev), we fall back to the Web Speech API, which uses the
 * voices already on the computer.
 */
import { isTauri } from '../tauri/commands'
import { marthaTTS } from './browserTTS'

/** Speak through the webview's voices. Always resolves, so a lesson can never freeze on speech. */
function speakInBrowser(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve()
    }
    // Safety net for a webview with no voice that never reports the end of speech.
    const words = text.trim().split(/\s+/).length
    const timer = setTimeout(finish, Math.max(3000, words * 600 + 2000))
    try {
      marthaTTS.speak(text, 0.95, finish)
    } catch {
      finish()
    }
  })
}

export async function speak(text: string): Promise<void> {
  if (!text?.trim()) return
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      // Resolves when the offline engine finishes speaking the whole line.
      await invoke('speak_text', { text })
      return
    } catch {
      // No offline engine on this computer: use the system voices instead.
    }
  }
  return speakInBrowser(text)
}

export async function stopSpeaking(): Promise<void> {
  marthaTTS.stop()
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    try { await invoke('stop_speaking') } catch { /* ignore */ }
    return
  }
}

/** Whether an offline speech engine is available (Tauri only). */
export async function voiceAvailable(): Promise<boolean> {
  if (!isTauri) return 'speechSynthesis' in window
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    if (await invoke<boolean>('tts_available')) return true
  } catch { /* fall through to the system voices */ }
  return 'speechSynthesis' in window
}
