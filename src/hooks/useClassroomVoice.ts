import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelListening,
  getVoiceStatus,
  startListening,
  stopAndTranscribe,
  stopSpeaking,
  type VoiceListenState,
  type VoiceStatus,
} from '../voice/classroomVoice'

/** Push-to-activate STT (spacebar) + Escape to stop speech. No Martha wiring yet. */
export function useClassroomVoice(active: boolean) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null)
  const [listenState, setListenState] = useState<VoiceListenState>('idle')
  const [transcription, setTranscription] = useState('')
  const [transcriptionError, setTranscriptionError] = useState('')
  const spaceHeldRef = useRef(false)
  const listeningRef = useRef(false)

  useEffect(() => {
    if (!active) return
    void getVoiceStatus().then(setVoiceStatus).catch(() => {})
  }, [active])

  const dismissTranscription = useCallback(() => {
    setTranscription('')
    setTranscriptionError('')
  }, [])

  useEffect(() => {
    if (!active) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        void stopSpeaking()
        void cancelListening()
        spaceHeldRef.current = false
        listeningRef.current = false
        setListenState('idle')
        return
      }

      if (e.code !== 'Space' || e.repeat) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      e.preventDefault()
      if (spaceHeldRef.current) return
      spaceHeldRef.current = true
      setTranscriptionError('')

      void startListening()
        .then(() => {
          listeningRef.current = true
          setListenState('listening')
        })
        .catch((err) => {
          spaceHeldRef.current = false
          setTranscriptionError(typeof err === 'string' ? err : 'Microphone unavailable')
        })
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (!spaceHeldRef.current) return
      spaceHeldRef.current = false
      if (!listeningRef.current) return

      listeningRef.current = false
      setListenState('transcribing')
      void stopAndTranscribe()
        .then((text) => {
          setTranscription(text)
          setListenState('idle')
        })
        .catch((err) => {
          setTranscriptionError(typeof err === 'string' ? err : 'Transcription failed')
          setListenState('idle')
        })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      void cancelListening()
    }
  }, [active])

  return {
    voiceStatus,
    listenState,
    transcription,
    transcriptionError,
    dismissTranscription,
  }
}
