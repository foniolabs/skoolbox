import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { sttAvailable, sttStart, sttStop, sttCancel } from '../../lib/tauri/commands'

const MAX_SECONDS = 30

interface Props {
  /** Receives the transcript after the recording is transcribed. */
  onTranscript: (text: string) => void
  /** Projector mode: larger mic button. */
  projector?: boolean
}

/** Push-to-activate voice input (SKILL.md Phase 4, MARTHA_PERSONA §3):
 *  spacebar (or the mic button) starts recording — pulsing mic visible on the
 *  projector — spacebar/button again stops it; 30 s hard cap. The transcript
 *  goes to `onTranscript` for on-screen preview, so the teacher confirms it
 *  before Martha responds. When voice is unavailable (engine missing or free
 *  RAM below the 6 GB budget) it shows a clear text-only message instead. */
export default function PushToTalk({ onTranscript, projector }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS)
  const [error, setError] = useState('')
  const busyRef = useRef(false)

  useEffect(() => {
    void sttAvailable().then(setAvailable).catch(() => setAvailable(false))
  }, [])

  const stop = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setRecording(false)
    setTranscribing(true)
    try {
      const text = await sttStop()
      onTranscript(text)
      setError('')
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Could not transcribe — please type instead.')
    } finally {
      setTranscribing(false)
      busyRef.current = false
    }
  }, [onTranscript])

  const start = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setError('')
    try {
      await sttStart()
      setSecondsLeft(MAX_SECONDS)
      setRecording(true)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Could not start the microphone.')
    } finally {
      busyRef.current = false
    }
  }, [])

  const toggle = useCallback(() => {
    if (transcribing) return
    void (recording ? stop() : start())
  }, [recording, transcribing, start, stop])

  // 30 s cap countdown.
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { void stop(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [recording, stop])

  // Spacebar = push-to-activate, unless the teacher is typing somewhere.
  useEffect(() => {
    if (!available) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [available, toggle])

  // Discard any in-flight recording on unmount.
  useEffect(() => () => { if (busyRef.current || recording) void sttCancel() }, [recording])

  if (available === null) return null
  if (!available) {
    return (
      <span className="text-xs text-text-muted" title="Voice needs the Whisper engine installed (scripts/setup_voice.sh --with-whisper) and at least 6 GB of free memory.">
        Voice unavailable — type instead
      </span>
    )
  }

  const size = projector ? 'h-12 w-12' : 'h-10 w-10'
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={transcribing}
        title={recording ? 'Stop recording (Space)' : 'Speak to Martha (Space)'}
        className={`${size} flex items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
          recording
            ? 'bg-red-500 border-red-500 text-white animate-pulse'
            : 'border-border text-text-secondary hover:border-primary hover:text-primary'
        }`}
      >
        {transcribing ? <Loader2 size={projector ? 22 : 17} className="animate-spin" />
          : recording ? <Square size={projector ? 20 : 15} />
          : <Mic size={projector ? 22 : 17} />}
      </button>
      {recording && (
        <span className={`font-mono ${projector ? 'text-2xl' : 'text-sm'} text-red-600`}>
          {`0:${String(secondsLeft).padStart(2, '0')}`}
        </span>
      )}
      {transcribing && <span className="text-sm text-text-secondary">Transcribing…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
