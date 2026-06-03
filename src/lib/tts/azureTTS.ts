/**
 * Azure Cognitive Services Text-to-Speech
 * Uses Nigerian English voices: en-NG-AbeoNeural (male), en-NG-EzinneNeural (female)
 */

export type NigerianVoice = 'Abeo' | 'Ezinne'

interface AzureTTSConfig {
  subscriptionKey: string
  region: string // e.g. "westeurope", "eastus"
  voice: NigerianVoice
  rate?: string   // e.g. "-10%", "0%", "+10%"
  pitch?: string  // e.g. "-5%", "0%", "+5%"
}

const VOICE_MAP: Record<NigerianVoice, { name: string; gender: string }> = {
  Abeo: { name: 'en-NG-AbeoNeural', gender: 'Male' },
  Ezinne: { name: 'en-NG-EzinneNeural', gender: 'Female' },
}

// Module-level state
let currentAudio: HTMLAudioElement | null = null
let currentAbortController: AbortController | null = null

function buildSSML(text: string, config: AzureTTSConfig): string {
  const voice = VOICE_MAP[config.voice]
  const rate = config.rate || '-5%'
  const pitch = config.pitch || '0%'

  // Escape XML special chars in text
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
  xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-NG">
  <voice name="${voice.name}">
    <prosody rate="${rate}" pitch="${pitch}">
      ${escaped}
    </prosody>
  </voice>
</speak>`
}

export async function speakWithAzure(
  text: string,
  config: AzureTTSConfig,
): Promise<void> {
  // Cancel any ongoing speech
  stopAzureSpeech()

  if (!text.trim() || !config.subscriptionKey) {
    // Fallback to browser TTS if no Azure key configured
    return fallbackBrowserTTS(text)
  }

  const abortController = new AbortController()
  currentAbortController = abortController

  const endpoint = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`
  const ssml = buildSSML(text, config)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'SkoolBox-AI-Tutor',
      },
      body: ssml,
      signal: abortController.signal,
    })

    if (!response.ok) {
      console.warn(`Azure TTS error ${response.status}, falling back to browser TTS`)
      return fallbackBrowserTTS(text)
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)

    return new Promise<void>((resolve) => {
      const audio = new Audio(audioUrl)
      currentAudio = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        resolve()
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        resolve()
      }

      audio.play().catch(() => {
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        resolve()
      })
    })
  } catch (err: any) {
    if (err.name === 'AbortError') return
    console.warn('Azure TTS failed, falling back to browser TTS:', err)
    return fallbackBrowserTTS(text)
  }
}

export function stopAzureSpeech(): void {
  // Stop audio playback
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  // Abort pending request
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }

  // Also stop browser fallback
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export function isAzureSpeaking(): boolean {
  return (currentAudio !== null && !currentAudio.paused) ||
    ('speechSynthesis' in window && window.speechSynthesis.speaking)
}

function fallbackBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text.trim()) {
      resolve()
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.lang = 'en-NG'
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}
