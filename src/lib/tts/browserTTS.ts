/**
 * Browser SpeechSynthesis TTS engine for Martha (student AI tutor).
 * Uses the built-in Web Speech API — no external keys needed.
 */

class BrowserTTSEngine {
  private synth: SpeechSynthesis
  private utterance: SpeechSynthesisUtterance | null = null
  private _onEnd: (() => void) | null = null

  constructor() {
    this.synth = window.speechSynthesis
  }

  /** Strip markdown formatting before speaking */
  private cleanText(text: string): string {
    return text
      .replace(/#{1,6}\s+/g, '') // headings
      .replace(/\*\*(.*?)\*\*/g, '$1') // bold
      .replace(/\*(.*?)\*/g, '$1') // italic
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/^\s*[-*+]\s+/gm, '') // list markers
      .replace(/^\s*\d+\.\s+/gm, '') // numbered lists
      .replace(/\$\$?[^$]*\$?\$/g, 'math expression') // latex
      .replace(/\n{2,}/g, '. ') // double newlines → pause
      .replace(/\n/g, ' ')
      .trim()
  }

  speak(text: string, rate: number = 0.95, onEnd?: () => void) {
    this.stop()
    const cleaned = this.cleanText(text)
    if (!cleaned) return

    this.utterance = new SpeechSynthesisUtterance(cleaned)
    this.utterance.rate = rate
    this.utterance.pitch = 1.05
    this.utterance.lang = 'en-NG'

    // Try to find a good English voice
    const voices = this.synth.getVoices()
    const nigerianVoice = voices.find((v) => v.lang === 'en-NG')
    const femaleVoice = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'),
    )
    const englishVoice = voices.find((v) => v.lang.startsWith('en'))
    this.utterance.voice = nigerianVoice || femaleVoice || englishVoice || null

    this._onEnd = onEnd || null
    this.utterance.onend = () => {
      this._onEnd?.()
      this._onEnd = null
    }
    this.utterance.onerror = () => {
      this._onEnd?.()
      this._onEnd = null
    }

    this.synth.speak(this.utterance)
  }

  pause() {
    this.synth.pause()
  }

  resume() {
    this.synth.resume()
  }

  stop() {
    this.synth.cancel()
    this._onEnd = null
  }

  get speaking(): boolean {
    return this.synth.speaking
  }

  get paused(): boolean {
    return this.synth.paused
  }
}

export const marthaTTS = new BrowserTTSEngine()
