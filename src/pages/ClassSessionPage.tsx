import { useState, useEffect, useRef, useCallback } from 'react'
import { GraduationCap, Loader2, Sparkles, Send, CheckCircle, XCircle, RotateCcw, Volume2, Pause, Play, SkipForward, X, Package, Zap, Monitor, MonitorOff } from 'lucide-react'
import WhiteboardCanvas from '../components/teach/whiteboard/WhiteboardCanvas'
import VoiceBar from '../components/teach/VoiceBar'
import CustomDropdown from '../components/shared/CustomDropdown'
import Button from '../components/shared/Button'
import { useClassroomVoice } from '../hooks/useClassroomVoice'
import { speak, stopSpeaking } from '../lib/tts/marthaVoice'
import { buildOpeningGreeting } from '../lib/classroom/openingGreeting'
import {
  classroomPlanLesson, classroomTeachSegment, classroomEvaluateAnswer,
  getGeneratedLesson, bakeLesson,
  type LessonPlan, type TeachingSegment, type AnswerEvaluation, type GeneratedLesson,
} from '../lib/tauri/commands'
import type { LessonStep } from '../lib/ai/teachingAssistant'

const classLevelOptions = [
  { label: 'Pry 5', value: 'Pry 5' }, { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' }, { label: 'JSS2', value: 'JSS2' }, { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' }, { label: 'SS2', value: 'SS2' }, { label: 'SS3', value: 'SS3' },
]

type Phase = 'setup' | 'loading' | 'greeting' | 'teaching' | 'question' | 'done'

const VALID_ACTIONS = ['write', 'equation', 'highlight', 'heading', 'diagram']

// Does this board content contain a maths expression? (The 3B often mislabels
// the action, e.g. "write|equation", so we detect maths from the content.)
function looksLikeMath(content: string): boolean {
  return /\\\(|\\\[|\\frac|\\sqrt|\\times|\\div|\\sum|\\int|\\cdot|\$\$|\^|_\{/.test(content)
}

function toLessonSteps(seg: TeachingSegment | null): LessonStep[] {
  if (!seg) return []
  return seg.board_steps.map((s) => {
    const isEquation = s.action.includes('equation') || looksLikeMath(s.content)
    const action: LessonStep['action'] = isEquation
      ? 'equation'
      : (VALID_ACTIONS.includes(s.action) ? s.action : 'write') as LessonStep['action']
    return { action, content: s.content, narration: s.narration, duration: 5000 }
  })
}

export default function ClassSessionPage() {
  const [subject, setSubject] = useState('Mathematics')
  const [classLevel, setClassLevel] = useState('JSS1')
  const [topic, setTopic] = useState('')

  const [phase, setPhase] = useState<Phase>('setup')
  const [projectorMode, setProjectorMode] = useState(true)
  const [greetingText, setGreetingText] = useState('')
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [segIndex, setSegIndex] = useState(0)
  const [segment, setSegment] = useState<TeachingSegment | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  const [answer, setAnswer] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)

  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const aliveRef = useRef(true)

  const steps = toLessonSteps(segment)
  const totalSegments = plan?.segment_titles.length ?? 0
  const voiceActive = phase !== 'setup' && phase !== 'loading'
  const {
    voiceStatus,
    listenState,
    transcription,
    transcriptionError,
    dismissTranscription,
  } = useClassroomVoice(voiceActive)

  useEffect(() => () => { aliveRef.current = false; void stopSpeaking() }, [])

  // Lesson timer (counts toward the ~30-minute period).
  useEffect(() => {
    if (phase === 'setup' || phase === 'done') return
    const t = setInterval(() => {
      if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  // A pre-generated lesson (baked on capable hardware, shipped in a pack). When
  // present, segments play instantly — no live generation on the school's CPU.
  const bakedRef = useRef<GeneratedLesson | null>(null)
  const [isBaked, setIsBaked] = useState(false)

  // One in-flight prefetch of the *next* segment, generated while Martha teaches
  // the current one — so "Continue" is instant instead of waiting on the model.
  const prefetchRef = useRef<{ index: number; promise: Promise<TeachingSegment | null> } | null>(null)

  const fetchSegment = useCallback((i: number, lessonPlan: LessonPlan) =>
    classroomTeachSegment({
      subject, topic: topic.trim(), classLevel,
      segmentTitle: lessonPlan.segment_titles[i],
      segmentIndex: i + 1, totalSegments: lessonPlan.segment_titles.length,
    }), [subject, topic, classLevel])

  const prefetchSegment = useCallback((i: number, lessonPlan: LessonPlan) => {
    if (i >= lessonPlan.segment_titles.length) return
    if (prefetchRef.current?.index === i) return
    prefetchRef.current = { index: i, promise: fetchSegment(i, lessonPlan).catch(() => null) }
  }, [fetchSegment])

  const loadSegment = useCallback(async (i: number, lessonPlan: LessonPlan) => {
    setError(''); setEvaluation(null); setAnswer(''); setStepIdx(0)
    // Pre-generated lesson: play the segment instantly, no model call.
    if (bakedRef.current) {
      const bseg = bakedRef.current.segments[i]
      if (bseg) {
        setSegment({ board_steps: bseg.board_steps, check_question: bseg.check_question })
        setSegIndex(i); setIsPlaying(true); setPhase('teaching')
        return
      }
    }
    // Reuse the prefetched segment if we have it; otherwise show loading + fetch.
    let segPromise: Promise<TeachingSegment | null>
    if (prefetchRef.current?.index === i) {
      segPromise = prefetchRef.current.promise
    } else {
      setPhase('loading')
      segPromise = fetchSegment(i, lessonPlan)
    }
    try {
      const seg = await segPromise
      if (!aliveRef.current) return
      if (!seg) { setPhase('setup'); setError('Martha could not prepare this segment.'); return }
      prefetchRef.current = null
      setSegment(seg); setSegIndex(i); setIsPlaying(true); setPhase('teaching')
      prefetchSegment(i + 1, lessonPlan) // get the next one ready while she teaches
    } catch (err) {
      if (aliveRef.current) { setPhase('setup'); setError(typeof err === 'string' ? err : 'Martha could not prepare this segment.') }
    }
  }, [fetchSegment, prefetchSegment])

  // Opening greeting: Martha welcomes the class, then segment 1 begins.
  useEffect(() => {
    if (phase !== 'greeting' || !plan || !greetingText) return
    let cancelled = false
    if (!bakedRef.current) prefetchSegment(0, plan)
    speak(greetingText).then(() => {
      if (cancelled || !aliveRef.current) return
      void loadSegment(0, plan)
    })
    return () => { cancelled = true; void stopSpeaking() }
  }, [phase, plan, greetingText, loadSegment, prefetchSegment])

  const beginLesson = (p: LessonPlan) => {
    setPlan(p)
    setSegIndex(0)
    startRef.current = Date.now()
    setGreetingText(buildOpeningGreeting(subject, classLevel, topic.trim()))
    setPhase('greeting')
  }

  const startClass = async () => {
    if (!topic.trim()) { setError('Enter a topic for Martha to teach.'); return }
    setPhase('loading'); setError(''); setGreetingText('')
    try {
      // 1. Prefer a pre-generated lesson — instant, no CPU generation.
      const baked = await getGeneratedLesson(subject, topic.trim(), classLevel)
      if (!aliveRef.current) return
      if (baked && baked.segments.length > 0) {
        bakedRef.current = baked; setIsBaked(true)
        const p: LessonPlan = { title: baked.title, segment_titles: baked.segments.map((s) => s.title) }
        beginLesson(p)
        return
      }

      // 2. Otherwise generate it live, segment by segment.
      bakedRef.current = null; setIsBaked(false)
      const p = await classroomPlanLesson(subject, topic.trim(), classLevel)
      if (!aliveRef.current) return
      beginLesson(p)
    } catch (err) {
      if (aliveRef.current) setError(typeof err === 'string' ? err : 'Martha could not plan the lesson.')
      setPhase('setup')
    }
  }

  // Teach: speak the current board step, then advance — or move to the question.
  useEffect(() => {
    if (phase !== 'teaching' || !segment || !isPlaying) return
    let cancelled = false
    const step = segment.board_steps[stepIdx]
    if (!step) return

    speak(step.narration || step.content).then(() => {
      if (cancelled || !aliveRef.current) return
      if (stepIdx < segment.board_steps.length - 1) setStepIdx((s) => s + 1)
      else setPhase('question')
    })
    return () => { cancelled = true; void stopSpeaking() }
  }, [phase, segment, stepIdx, isPlaying])

  const handleEvaluate = async () => {
    if (!segment || !answer.trim()) return
    void stopSpeaking()
    setEvaluating(true); setEvaluation(null)
    try {
      const result = await classroomEvaluateAnswer(subject, topic.trim(), segment.check_question, answer.trim())
      if (!aliveRef.current) return
      setEvaluation(result)
      void speak([result.feedback, result.remediation].filter(Boolean).join('. '))
    } catch (err) {
      if (aliveRef.current) setError(typeof err === 'string' ? err : 'Martha could not evaluate the answer.')
    } finally {
      if (aliveRef.current) setEvaluating(false)
    }
  }

  const continueLesson = async () => {
    void stopSpeaking()
    if (!plan) return
    const next = segIndex + 1
    if (next < plan.segment_titles.length) {
      await loadSegment(next, plan)
    } else {
      setPhase('done')
      void speak('Well done, class. That is the end of our lesson today. Keep practising!')
    }
  }

  const exitClass = () => {
    void stopSpeaking(); setPhase('setup'); setPlan(null); setSegment(null)
    setGreetingText('')
    startRef.current = null; setElapsed(0)
    bakedRef.current = null; setIsBaked(false); prefetchRef.current = null
  }

  // PRODUCER: pre-generate this lesson once (slow) so it plays instantly forever after.
  const [baking, setBaking] = useState(false)
  const [bakeMsg, setBakeMsg] = useState('')
  const handleBake = async () => {
    if (!topic.trim()) { setError('Enter a topic to pre-generate.'); return }
    setBaking(true); setError(''); setBakeMsg('Pre-generating the full lesson… this runs once and can take a few minutes.')
    try {
      const lesson = await bakeLesson(subject, topic.trim(), classLevel)
      setBakeMsg(`Saved "${lesson.title}" (${lesson.segments.length} segments). It will now play instantly and can be exported in a pack.`)
    } catch (err) {
      setBakeMsg(''); setError(typeof err === 'string' ? err : 'Could not pre-generate the lesson.')
    } finally {
      setBaking(false)
    }
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="p-6 flex flex-col gap-6 max-w-[760px] mx-auto">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Teach a Class</h1>
            <p className="text-sm text-text-secondary">Martha teaches the whole topic on the whiteboard, aloud, for a full ~30-minute period — with questions along the way.</p>
          </div>
        </div>
        <div className="bg-white rounded-[20px] shadow-card p-6 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm focus:outline-none focus:border-primary" />
            <CustomDropdown options={classLevelOptions} value={classLevel} onChange={setClassLevel} />
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic — e.g. Adding fractions"
              onKeyDown={(e) => { if (e.key === 'Enter') startClass() }}
              className="px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-xs text-red-600">{error}</p> : <span className="text-xs text-text-muted">If this lesson was pre-installed, it plays instantly. Otherwise Martha generates it live.</span>}
            <div className="flex items-center gap-2">
              <button onClick={handleBake} disabled={baking || !topic.trim()}
                title="Pre-generate this lesson once so it plays instantly everywhere (for content producers)"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[12px] border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
                {baking ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />} Pre-generate
              </button>
              <Button onClick={startClass} className="flex items-center gap-2"><Sparkles size={15} /> Start Class</Button>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={projectorMode}
              onChange={(e) => setProjectorMode(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-text-secondary">
              <Monitor size={14} className="inline mr-1.5 -mt-0.5" />
              Projector mode — large text for the classroom screen (readable from the back row)
            </span>
          </label>
          {bakeMsg && <p className="text-xs text-text-secondary bg-bg-secondary/60 rounded-[10px] px-3 py-2">{bakeMsg}</p>}
        </div>
      </div>
    )
  }

  // ── Loading (planning or preparing a segment) ───────────────────────────────
  if (phase === 'loading' && !segment) {
    const loadingShell = projectorMode
      ? 'fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center'
      : 'min-h-[70vh] flex items-center justify-center'
    return (
      <div className={loadingShell}>
        <div className="text-center px-8">
          <Loader2 className={`animate-spin mx-auto mb-4 ${projectorMode ? 'w-12 h-12 text-white' : 'w-7 h-7 text-primary'}`} />
          <p className={`font-medium ${projectorMode ? 'text-3xl text-white' : 'text-lg text-text-primary'}`}>
            {plan ? 'Preparing the next part…' : 'Martha is planning the lesson…'}
          </p>
          <p className={`mt-2 ${projectorMode ? 'text-lg text-slate-300' : 'text-sm text-text-secondary'}`}>
            Generating on-device with Qwen.
          </p>
        </div>
      </div>
    )
  }

  const isProjector = projectorMode && phase !== 'setup'
  const shellClass = isProjector
    ? 'fixed inset-0 z-[200] bg-white flex flex-col overflow-hidden'
    : 'p-4 flex flex-col gap-4 max-w-[1100px] mx-auto'
  const headerClass = isProjector
    ? 'shrink-0 flex items-center justify-between gap-4 px-6 py-4 bg-slate-900 text-white'
    : 'flex items-center justify-between gap-3'
  const titleClass = isProjector ? 'text-2xl md:text-3xl font-bold truncate' : 'text-lg font-bold text-text-primary truncate'
  const metaClass = isProjector ? 'text-sm text-slate-300' : 'text-xs text-text-muted'

  // ── Teaching / Greeting / Question / Done ───────────────────────────────────
  return (
    <div className={shellClass}>
      {/* Header: progress + timer + controls */}
      <div className={headerClass}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={titleClass}>{plan?.title || topic}</h2>
            {isBaked && (
              <span className={`flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 shrink-0 ${isProjector ? 'bg-green-500/20 text-green-300 text-xs' : 'bg-green-100 text-green-700 text-[10px]'}`}>
                <Zap size={10} /> Pre-loaded
              </span>
            )}
            {isProjector && (
              <span className="rounded-full bg-primary/20 text-primary-200 text-xs font-semibold px-2.5 py-0.5 shrink-0">
                PROJECTOR
              </span>
            )}
          </div>
          <p className={metaClass}>
            {phase === 'greeting' ? 'Opening greeting' : `Segment ${Math.min(segIndex + 1, totalSegments)} of ${totalSegments}`}
            {phase !== 'greeting' && plan && ` · ${plan.segment_titles[segIndex]}`}
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <span className={`font-mono ${isProjector ? 'text-base text-slate-200' : `text-sm ${elapsed >= 1800 ? 'text-green-600' : 'text-text-secondary'}`}`}>
            {mmss(elapsed)} / 30:00
          </span>
          <button
            onClick={() => setProjectorMode((p) => !p)}
            title={projectorMode ? 'Exit projector mode' : 'Projector mode'}
            className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${isProjector ? 'text-slate-200 hover:bg-slate-800' : 'text-text-secondary hover:bg-bg-secondary'}`}
          >
            {projectorMode ? <MonitorOff size={17} /> : <Monitor size={17} />}
          </button>
          {phase === 'teaching' && (
            <>
              <button onClick={() => { setIsPlaying((p) => !p); void stopSpeaking() }} title={isPlaying ? 'Pause' : 'Play'}
                className={`h-9 w-9 flex items-center justify-center rounded-lg ${isProjector ? 'text-slate-200 hover:bg-slate-800' : 'text-text-secondary hover:bg-bg-secondary'}`}>
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button onClick={() => { void stopSpeaking(); setPhase('question') }} title="Skip to question"
                className={`h-9 w-9 flex items-center justify-center rounded-lg ${isProjector ? 'text-slate-200 hover:bg-slate-800' : 'text-text-secondary hover:bg-bg-secondary'}`}>
                <SkipForward size={17} />
              </button>
            </>
          )}
          <button onClick={exitClass} title="End class"
            className={`h-9 w-9 flex items-center justify-center rounded-lg ${isProjector ? 'text-red-300 hover:bg-red-950' : 'text-red-400 hover:bg-red-50'}`}>
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Progress bar over segments */}
      <div className={`shrink-0 overflow-hidden ${isProjector ? 'h-2 bg-slate-200' : 'h-1.5 w-full rounded-full bg-bg-secondary'}`}>
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${totalSegments
              ? ((segIndex + (phase === 'question' || phase === 'done' ? 1 : 0)) / totalSegments) * 100
              : 0}%`,
          }}
        />
      </div>

      {/* Opening greeting — spoken + displayed before segment 1 */}
      {phase === 'greeting' && (
        <div
          className={`flex-1 flex flex-col items-center justify-center text-center px-8 md:px-16 ${isProjector ? 'bg-white' : 'bg-bg-secondary/30 min-h-[50vh] rounded-[16px] border border-border mx-4'}`}
          style={isProjector ? {
            backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          } : undefined}
        >
          <p className={`uppercase tracking-widest font-semibold mb-4 ${isProjector ? 'text-primary text-sm' : 'text-primary text-xs'}`}>
            Martha · {classLevel} {subject}
          </p>
          <p className={`font-medium text-text-primary leading-relaxed max-w-4xl ${isProjector ? 'text-3xl md:text-5xl' : 'text-xl md:text-2xl'}`}>
            {greetingText}
          </p>
          <div className={`flex items-center gap-2 mt-8 ${isProjector ? 'text-lg text-text-secondary' : 'text-sm text-text-secondary'}`}>
            <Volume2 size={isProjector ? 22 : 16} className="text-primary animate-pulse" />
            Martha is greeting the class…
          </div>
        </div>
      )}

      {/* Whiteboard */}
      {(phase === 'teaching' || phase === 'question' || phase === 'done') && (
        <div className={`flex-1 flex flex-col min-h-0 ${isProjector ? '' : 'rounded-[16px] overflow-hidden border border-border bg-white min-h-[300px]'}`}>
          <WhiteboardCanvas
            steps={steps}
            currentStepIndex={phase === 'teaching' ? stepIdx : steps.length - 1}
            isPlaying={phase === 'teaching' && isPlaying}
            projectorMode={isProjector}
          />
        </div>
      )}

      {phase === 'teaching' && (
        <div className={`shrink-0 flex items-center gap-2 px-6 py-3 ${isProjector ? 'text-lg text-text-secondary bg-slate-50 border-t border-slate-200' : 'text-sm text-text-secondary'}`}>
          <Volume2 size={isProjector ? 20 : 16} className="text-primary animate-pulse" /> Martha is teaching…
        </div>
      )}

      {voiceActive && (
        <VoiceBar
          voiceStatus={voiceStatus}
          listenState={listenState}
          transcription={transcription}
          transcriptionError={transcriptionError}
          projectorMode={isProjector}
          onDismissTranscription={dismissTranscription}
        />
      )}

      {/* Question + evaluation — teacher panel; stays readable at desk */}
      {(phase === 'question' || phase === 'done') && segment && (
        <div className={`shrink-0 ${isProjector ? 'border-t-2 border-slate-200 bg-slate-50 px-6 py-5' : 'bg-white rounded-[16px] shadow-card p-5'}`}>
          <p className={`font-semibold text-primary uppercase tracking-wider mb-1 ${isProjector ? 'text-sm' : 'text-xs'}`}>Martha asks the class</p>
          <p className={`text-text-primary font-medium mb-3 ${isProjector ? 'text-2xl md:text-3xl leading-snug' : ''}`}>{segment.check_question}</p>
          <div className="flex gap-2">
            <input value={answer} onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEvaluate() }}
              placeholder="Type a student's answer…"
              className="flex-1 px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm focus:outline-none focus:border-primary" />
            <Button onClick={handleEvaluate} disabled={evaluating || !answer.trim()} className="flex items-center gap-2">
              {evaluating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Check
            </Button>
          </div>

          {evaluation && (
            <div className={`rounded-[12px] p-4 mt-3 ${evaluation.is_correct ? 'bg-green-50' : 'bg-amber-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {evaluation.is_correct ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-amber-600" />}
                <span className={`text-sm font-semibold ${evaluation.is_correct ? 'text-green-700' : 'text-amber-700'}`}>{evaluation.is_correct ? 'Correct' : 'Not quite'}</span>
              </div>
              <p className="text-text-primary leading-relaxed">{evaluation.feedback}</p>
              {evaluation.remediation && (
                <div className="mt-3 flex gap-2 border-t border-amber-200 pt-3">
                  <RotateCcw size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-sm text-text-primary leading-relaxed">{evaluation.remediation}</p>
                </div>
              )}
            </div>
          )}

          {phase === 'question' && (
            <div className="flex justify-end mt-4">
              <Button onClick={continueLesson} className="flex items-center gap-2">
                {segIndex + 1 < totalSegments ? 'Continue lesson' : 'Finish lesson'} <SkipForward size={15} />
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className={`shrink-0 text-center ${isProjector ? 'border-t-2 border-green-200 bg-green-50 px-6 py-6' : 'bg-green-50 rounded-[16px] p-5'}`}>
          <p className={`text-green-700 font-semibold ${isProjector ? 'text-2xl' : ''}`}>Lesson complete</p>
          <p className={`text-text-secondary mt-1 ${isProjector ? 'text-lg' : 'text-sm'}`}>
            Taught {totalSegments} segments in {mmss(elapsed)}.
          </p>
          <Button onClick={exitClass} className="mt-3">Teach another topic</Button>
        </div>
      )}
    </div>
  )
}
