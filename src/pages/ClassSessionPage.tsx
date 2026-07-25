import { useState, useEffect, useRef, useCallback } from 'react'
import { GraduationCap, Loader2, Sparkles, Send, CheckCircle, XCircle, RotateCcw, Volume2, Pause, Play, SkipForward, X, Package, Zap, Monitor, Download } from 'lucide-react'
import WhiteboardCanvas from '../components/teach/whiteboard/WhiteboardCanvas'
import CustomDropdown from '../components/shared/CustomDropdown'
import Button from '../components/shared/Button'
import { speak, stopSpeaking } from '../lib/tts/marthaVoice'
import ClassToolsPanel from '../components/teach/ClassToolsPanel'
import PushToTalk from '../components/teach/PushToTalk'
import { downloadText } from '../lib/classroomText'
import {
  classroomPlanLesson, classroomTeachSegment, classroomEvaluateAnswer,
  getGeneratedLesson, bakeLesson,
  type LessonPlan, type TeachingSegment, type AnswerEvaluation, type GeneratedLesson, type LessonNote,
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
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [segIndex, setSegIndex] = useState(0)
  const [segment, setSegment] = useState<TeachingSegment | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  // Projector-first display (SKILL.md Phase 5): large fonts for the back row.
  const [projector, setProjector] = useState(false)
  // Opening greeting (displayed + spoken) and the session log for the summary.
  const [greeting, setGreeting] = useState('')
  const greetingDoneRef = useRef(false)
  const [lastNote, setLastNote] = useState<LessonNote | null>(null)
  const logRef = useRef<Array<{ question: string; correct: boolean | null } | undefined>>([])

  const [answer, setAnswer] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)

  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const aliveRef = useRef(true)

  const steps = toLessonSteps(segment)
  const totalSegments = plan?.segment_titles.length ?? 0

  useEffect(() => () => { aliveRef.current = false; void stopSpeaking() }, [])

  // Escape interrupts Martha's voice instantly, every time (MARTHA_PERSONA §3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void stopSpeaking() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // Opening greeting: displayed AND spoken, names the subject and today's topic,
  // then hands over to the first segment (skippable).
  const beginGreeting = (p: LessonPlan) => {
    const g = `Good day, class! I am Martha. Today in ${subject}, we are learning about ${p.title || topic.trim()}. Sit up, listen well, and let us begin!`
    setGreeting(g); setPhase('greeting')
    greetingDoneRef.current = false
    void speak(g).then(() => {
      if (!aliveRef.current || greetingDoneRef.current) return
      greetingDoneRef.current = true
      void loadSegment(0, p)
    })
  }

  const skipGreeting = () => {
    if (!plan || greetingDoneRef.current) return
    greetingDoneRef.current = true
    void stopSpeaking()
    void loadSegment(0, plan)
  }

  const startClass = async () => {
    if (!topic.trim()) {
      setError('Martha asks: “What are we learning about today?” — enter a topic to begin.')
      void speak('What are we learning about today?')
      return
    }
    logRef.current = []; setLastNote(null)
    setPhase('loading'); setError('')
    try {
      // 1. Prefer a pre-generated lesson — instant, no CPU generation.
      const baked = await getGeneratedLesson(subject, topic.trim(), classLevel)
      if (!aliveRef.current) return
      if (baked && baked.segments.length > 0) {
        bakedRef.current = baked; setIsBaked(true)
        const p: LessonPlan = { title: baked.title, segment_titles: baked.segments.map((s) => s.title) }
        setPlan(p); setSegIndex(0); startRef.current = Date.now()
        beginGreeting(p)
        return
      }

      // 2. Otherwise generate it live, segment by segment.
      bakedRef.current = null; setIsBaked(false)
      const p = await classroomPlanLesson(subject, topic.trim(), classLevel)
      if (!aliveRef.current) return
      setPlan(p); setSegIndex(0)
      startRef.current = Date.now()
      beginGreeting(p)
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
      logRef.current[segIndex] = { question: segment.check_question, correct: result.is_correct }
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
    if (segment && !logRef.current[segIndex]) {
      logRef.current[segIndex] = { question: segment.check_question, correct: null }
    }
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
    startRef.current = null; setElapsed(0)
    bakedRef.current = null; setIsBaked(false); prefetchRef.current = null
    logRef.current = []; setLastNote(null); setGreeting('')
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

  // Session-end summary (SKILL.md Phase 5): topics covered, questions asked,
  // homework (from the generated lesson note, if any), topics to revisit.
  const buildSummary = () => {
    const covered = plan?.segment_titles.slice(0, Math.min(segIndex + 1, totalSegments)) ?? []
    const qa = covered.map((title, i) => ({ title, log: logRef.current[i] }))
    const revisit = qa.filter((e) => e.log?.correct === false).map((e) => e.title)
    return { covered, qa, revisit }
  }

  const summaryToText = () => {
    const { covered, qa, revisit } = buildSummary()
    const qaLines = qa.filter((e) => e.log).map((e) =>
      `  - ${e.log!.question} (${e.log!.correct === true ? 'answered correctly' : e.log!.correct === false ? 'needs revision' : 'not answered'})`)
    return [
      `SKOOLBOX CLASS SUMMARY`,
      `${plan?.title ?? topic} — ${subject}, ${classLevel} — ${new Date().toLocaleDateString()}`,
      ``,
      `TOPICS COVERED:`, ...covered.map((t) => `  - ${t}`),
      ``,
      `QUESTIONS MARTHA ASKED:`, ...(qaLines.length ? qaLines : ['  - (none)']),
      ``,
      `HOMEWORK:`, ...(lastNote ? lastNote.homework.map((h) => `  - ${h}`) : ['  - (generate a lesson note to include homework)']),
      ``,
      `TOPICS TO REVISIT:`, ...(revisit.length ? revisit.map((t) => `  - ${t}`) : ['  - None — well done, class!']),
    ].join('\n')
  }

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
          {bakeMsg && <p className="text-xs text-text-secondary bg-bg-secondary/60 rounded-[10px] px-3 py-2">{bakeMsg}</p>}
        </div>
      </div>
    )
  }

  // ── Opening greeting (displayed + spoken; skippable) ────────────────────────
  if (phase === 'greeting') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="text-center max-w-3xl">
          <GraduationCap className="w-10 h-10 text-primary mx-auto mb-4" />
          <p className={`font-bold text-text-primary leading-snug ${projector ? 'text-5xl' : 'text-3xl'}`}>{greeting}</p>
          <Button onClick={skipGreeting} className="mt-8 flex items-center gap-2 mx-auto">
            Start teaching <SkipForward size={15} />
          </Button>
        </div>
      </div>
    )
  }

  // ── Loading (planning or preparing a segment) ───────────────────────────────
  if (phase === 'loading' && !segment) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto mb-3" />
          <p className="text-lg font-medium text-text-primary">{plan ? 'Preparing the next part…' : 'Martha is planning the lesson…'}</p>
          <p className="text-sm text-text-secondary mt-1">Generating on-device with Qwen.</p>
        </div>
      </div>
    )
  }

  // ── Teaching / Question / Done ──────────────────────────────────────────────
  return (
    <div className={`p-4 flex flex-col gap-4 mx-auto ${projector ? 'max-w-none' : 'max-w-[1100px]'}`}>
      {/* Header: progress + timer + controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary truncate">{plan?.title || topic}</h2>
            {isBaked && (
              <span className="flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-0.5 shrink-0">
                <Zap size={10} /> Pre-loaded
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            Segment {Math.min(segIndex + 1, totalSegments)} of {totalSegments}
            {plan && ` · ${plan.segment_titles[segIndex]}`}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-sm font-mono ${elapsed >= 1800 ? 'text-green-600' : 'text-text-secondary'}`}>{mmss(elapsed)} / 30:00</span>
          <button onClick={() => setProjector((p) => !p)} title="Projector mode — large text, readable from the back row"
            className={`h-9 w-9 flex items-center justify-center rounded-lg ${projector ? 'text-primary bg-bg-secondary' : 'text-text-secondary hover:bg-bg-secondary'}`}>
            <Monitor size={17} />
          </button>
          {phase === 'teaching' && (
            <>
              <button onClick={() => { setIsPlaying((p) => !p); void stopSpeaking() }} title={isPlaying ? 'Pause' : 'Play'}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary">
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button onClick={() => { void stopSpeaking(); setPhase('question') }} title="Skip to question"
                className="h-9 w-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary">
                <SkipForward size={17} />
              </button>
            </>
          )}
          <button onClick={exitClass} title="End class" className="h-9 w-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Progress bar over segments */}
      <div className="h-1.5 w-full rounded-full bg-bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${totalSegments ? ((segIndex + (phase === 'question' || phase === 'done' ? 1 : 0)) / totalSegments) * 100 : 0}%` }} />
      </div>

      {/* On-demand teacher commands (explain / re-explain / prerequisites / quiz / note) */}
      <ClassToolsPanel subject={subject} topic={topic.trim()} classLevel={classLevel} projector={projector}
        onOpen={() => { setIsPlaying(false); void stopSpeaking() }} onNote={setLastNote} />

      {/* Whiteboard */}
      <div className="rounded-[16px] overflow-hidden border border-border bg-white min-h-[300px]">
        <WhiteboardCanvas steps={steps} currentStepIndex={phase === 'teaching' ? stepIdx : steps.length - 1} isPlaying={phase === 'teaching' && isPlaying} />
      </div>

      {phase === 'teaching' && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Volume2 size={16} className="text-primary animate-pulse" /> Martha is teaching…
        </div>
      )}

      {/* Question + evaluation */}
      {(phase === 'question' || phase === 'done') && segment && (
        <div className="bg-white rounded-[16px] shadow-card p-5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Martha asks the class</p>
          <p className={`text-text-primary font-medium mb-3 ${projector ? 'text-3xl leading-snug' : ''}`}>{segment.check_question}</p>
          <div className="flex gap-2 items-center">
            {/* Push-to-talk (Space): the transcript lands here first, so the
                teacher previews and confirms before Martha evaluates. */}
            <PushToTalk projector={projector}
              onTranscript={(t) => setAnswer((prev) => (prev ? `${prev} ${t}` : t))} />
            <input value={answer} onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEvaluate() }}
              placeholder="Type or speak (Space) a student's answer…"
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
              <p className={`text-text-primary leading-relaxed ${projector ? 'text-2xl' : ''}`}>{evaluation.feedback}</p>
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

      {phase === 'done' && (() => {
        const { covered, qa, revisit } = buildSummary()
        return (
          <div className="bg-white rounded-[16px] shadow-card p-5 flex flex-col gap-4">
            <div className="text-center">
              <p className="text-green-700 font-semibold text-lg">Lesson complete 🎉</p>
              <p className="text-sm text-text-secondary mt-1">Taught {covered.length} segments in {mmss(elapsed)}.</p>
            </div>

            <div className={`grid gap-4 ${projector ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Topics covered</p>
                <ul className="list-disc pl-5 flex flex-col gap-0.5">
                  {covered.map((t) => <li key={t} className={`text-text-primary ${projector ? 'text-xl' : 'text-sm'}`}>{t}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Questions Martha asked</p>
                <ul className="flex flex-col gap-1">
                  {qa.filter((e) => e.log).map((e, i) => (
                    <li key={i} className={`flex items-start gap-1.5 ${projector ? 'text-xl' : 'text-sm'} text-text-primary`}>
                      {e.log!.correct === true ? <CheckCircle size={15} className="text-green-600 mt-0.5 shrink-0" />
                        : e.log!.correct === false ? <XCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                        : <SkipForward size={15} className="text-text-muted mt-0.5 shrink-0" />}
                      {e.log!.question}
                    </li>
                  ))}
                  {qa.every((e) => !e.log) && <li className="text-sm text-text-muted">No questions were answered.</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Homework</p>
                {lastNote ? (
                  <ul className="list-disc pl-5 flex flex-col gap-0.5">
                    {lastNote.homework.map((h, i) => <li key={i} className={`text-text-primary ${projector ? 'text-xl' : 'text-sm'}`}>{h}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">Use “Lesson note” above to generate homework for the class.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Topics to revisit</p>
                {revisit.length ? (
                  <ul className="list-disc pl-5 flex flex-col gap-0.5">
                    {revisit.map((t) => <li key={t} className={`text-amber-700 ${projector ? 'text-xl' : 'text-sm'}`}>{t}</li>)}
                  </ul>
                ) : (
                  <p className={`${projector ? 'text-xl' : 'text-sm'} text-green-700`}>None — well done, class!</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button onClick={() => downloadText(`class-summary-${topic.trim().replace(/\s+/g, '-').toLowerCase()}.txt`, summaryToText())}
                className="flex items-center gap-2">
                <Download size={14} /> Save summary
              </Button>
              <Button onClick={exitClass}>Teach another topic</Button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
