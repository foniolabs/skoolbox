import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react'
import type { VoiceListenState, VoiceStatus } from '../../lib/voice/classroomVoice'

interface VoiceBarProps {
  voiceStatus: VoiceStatus | null
  listenState: VoiceListenState
  transcription: string
  transcriptionError: string
  projectorMode?: boolean
  onDismissTranscription?: () => void
}

export default function VoiceBar({
  voiceStatus,
  listenState,
  transcription,
  transcriptionError,
  projectorMode = false,
  onDismissTranscription,
}: VoiceBarProps) {
  const shell = projectorMode
    ? 'shrink-0 border-t-2 border-slate-200 bg-slate-900 text-white px-6 py-4'
    : 'shrink-0 rounded-[16px] border border-border bg-white shadow-card p-4'

  const listening = listenState === 'listening'
  const transcribing = listenState === 'transcribing'

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-2 font-semibold ${projectorMode ? 'text-base' : 'text-sm'}`}>
          {listening ? (
            <Mic size={projectorMode ? 22 : 18} className="text-red-400 animate-pulse" />
          ) : (
            <MicOff size={projectorMode ? 22 : 18} className={projectorMode ? 'text-slate-300' : 'text-text-muted'} />
          )}
          <span>
            {listening && 'Listening… (release Space)'}
            {transcribing && 'Transcribing…'}
            {!listening && !transcribing && 'Hold Space to speak'}
          </span>
        </div>

        {voiceStatus && (
          <div className={`flex flex-wrap gap-2 text-xs ${projectorMode ? 'text-slate-300' : 'text-text-muted'}`}>
            <span className={`rounded-full px-2 py-0.5 ${voiceStatus.tts_available ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              TTS: {voiceStatus.tts_engine}
            </span>
            <span className={`rounded-full px-2 py-0.5 ${voiceStatus.stt_available ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              STT: {voiceStatus.stt_engine}
            </span>
          </div>
        )}

        {!voiceStatus?.stt_available && !projectorMode && (
          <span className="text-xs text-text-muted">Speech recognition will be ready after the voice pack installs on first launch</span>
        )}
      </div>

      {transcriptionError && (
        <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${projectorMode ? 'bg-red-950 text-red-200' : 'bg-red-50 text-red-700'}`}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{transcriptionError}</p>
        </div>
      )}

      {transcription && (
        <div className={`mt-3 rounded-xl p-4 ${projectorMode ? 'bg-slate-800' : 'bg-bg-secondary/60'}`}>
          <p className={`uppercase tracking-wider font-semibold mb-2 ${projectorMode ? 'text-slate-400 text-xs' : 'text-primary text-xs'}`}>
            <Volume2 size={14} className="inline mr-1 -mt-0.5" />
            Heard (preview — not sent to Martha yet)
          </p>
          <p className={projectorMode ? 'text-2xl md:text-3xl leading-snug' : 'text-lg leading-relaxed text-text-primary'}>
            {transcription}
          </p>
          {onDismissTranscription && (
            <button
              type="button"
              onClick={onDismissTranscription}
              className={`mt-3 text-sm underline ${projectorMode ? 'text-slate-300' : 'text-text-secondary'}`}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}
