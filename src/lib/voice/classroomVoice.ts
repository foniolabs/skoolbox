/**
 * Offline classroom voice — TTS + push-to-activate STT.
 * Independent of Martha's LLM; transcription is preview-only until wired later.
 */
import { isTauri } from '../tauri/commands'

export interface VoiceStatus {
  tts_available: boolean
  tts_engine: string
  stt_available: boolean
  stt_engine: string
  stt_listening: boolean
}

export type VoiceListenState = 'idle' | 'listening' | 'transcribing'

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: inv } = await import('@tauri-apps/api/core')
  return inv<T>(cmd, args)
}

export async function getVoiceStatus(): Promise<VoiceStatus> {
  if (!isTauri) {
    return {
      tts_available: 'speechSynthesis' in window,
      tts_engine: 'browser',
      stt_available: false,
      stt_engine: 'none',
      stt_listening: false,
    }
  }
  return invoke<VoiceStatus>('get_voice_status')
}

export async function startListening(): Promise<void> {
  if (!isTauri) throw new Error('Microphone STT requires the desktop app.')
  await invoke('stt_start_listening')
}

export async function stopAndTranscribe(): Promise<string> {
  if (!isTauri) throw new Error('Microphone STT requires the desktop app.')
  return invoke<string>('stt_stop_and_transcribe')
}

export async function cancelListening(): Promise<void> {
  if (!isTauri) return
  await invoke('stt_cancel_listening')
}

/** Re-export narration helpers (Rust TTS in Tauri, Web Speech in browser). */
export { speak, stopSpeaking, voiceAvailable } from '../tts/marthaVoice'
