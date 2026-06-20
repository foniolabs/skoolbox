import { useState, useEffect, useRef } from 'react'
import { GraduationCap, Loader2, Send, Sparkles, CheckCircle, XCircle, RotateCcw, Volume2, Square } from 'lucide-react'
import CustomDropdown from '../components/shared/CustomDropdown'
import Button from '../components/shared/Button'
import { speak, stopSpeaking } from '../lib/tts/marthaVoice'
import {
  classroomStartLesson, classroomEvaluateAnswer,
  type LessonSegment, type AnswerEvaluation,
} from '../lib/tauri/commands'

const classLevelOptions = [
  { label: 'Pry 5', value: 'Pry 5' }, { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' }, { label: 'JSS2', value: 'JSS2' }, { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' }, { label: 'SS2', value: 'SS2' }, { label: 'SS3', value: 'SS3' },
]

export default function ClassroomPage() {
  const [subject, setSubject] = useState('Mathematics')
  const [classLevel, setClassLevel] = useState('JSS1')
  const [topic, setTopic] = useState('')

  const [lesson, setLesson] = useState<LessonSegment | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const [answer, setAnswer] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)

  // Voice teaching: which line Martha is speaking (0 = intro, 1..n = points, last = question).
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const narratingRef = useRef(false)

  // Stop any speech when leaving the page.
  useEffect(() => () => { narratingRef.current = false; void stopSpeaking() }, [])

  const stopNarration = () => {
    narratingRef.current = false
    setSpeakingIdx(null)
    void stopSpeaking()
  }

  /** Martha reads the lesson aloud: introduction → each teaching point → question. */
  const narrate = async (seg: LessonSegment) => {
    const lines = [seg.introduction, ...seg.teaching_points, seg.check_question]
    narratingRef.current = true
    for (let i = 0; i < lines.length; i++) {
      if (!narratingRef.current) return
      setSpeakingIdx(i)
      await speak(lines[i])
    }
    if (narratingRef.current) setSpeakingIdx(null)
    narratingRef.current = false
  }

  const handleStart = async () => {
    if (!topic.trim()) { setError('Enter a topic for Martha to teach.'); return }
    stopNarration()
    setStarting(true); setError(''); setLesson(null); setEvaluation(null); setAnswer('')
    try {
      const seg = await classroomStartLesson(subject, topic.trim(), classLevel)
      setLesson(seg)
      void narrate(seg) // start teaching aloud
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Martha could not start the lesson.')
    } finally {
      setStarting(false)
    }
  }

  const handleEvaluate = async () => {
    if (!lesson || !answer.trim()) return
    stopNarration()
    setEvaluating(true); setEvaluation(null)
    try {
      const result = await classroomEvaluateAnswer(subject, topic.trim(), lesson.check_question, answer.trim())
      setEvaluation(result)
      // Martha speaks her feedback (and any re-teaching).
      void speak([result.feedback, result.remediation].filter(Boolean).join('. '))
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Martha could not evaluate the answer.')
    } finally {
      setEvaluating(false)
    }
  }

  // Index helpers for highlighting the line currently being spoken.
  const introSpeaking = speakingIdx === 0
  const pointSpeaking = (i: number) => speakingIdx === i + 1
  const questionSpeaking = lesson != null && speakingIdx === lesson.teaching_points.length + 1
  const isNarrating = speakingIdx !== null

  const inputClass = 'px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary'

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[900px] mx-auto">
      <div className="flex items-center gap-3">
        <GraduationCap className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Classroom (Beta)</h1>
          <p className="text-sm text-text-secondary">Martha leads a live lesson — introduces, teaches, and checks understanding. Runs offline on Qwen.</p>
        </div>
      </div>

      {/* Lesson setup */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputClass} />
          <CustomDropdown options={classLevelOptions} value={classLevel} onChange={setClassLevel} />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic — e.g. Adding fractions" className={inputClass} />
        </div>
        <div className="flex items-center justify-between gap-3">
          {error ? <p className="text-xs text-red-600">{error}</p> : <span className="text-xs text-text-muted">Martha will teach the whole class, then ask a question.</span>}
          <Button onClick={handleStart} disabled={starting} className="flex items-center gap-2">
            {starting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {starting ? 'Starting…' : 'Start Lesson'}
          </Button>
        </div>
      </div>

      {/* Lesson content */}
      {lesson && (
        <div className="bg-white rounded-[20px] shadow-card p-6 flex flex-col gap-5">
          {/* Voice controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Volume2 size={16} className={isNarrating ? 'text-primary animate-pulse' : 'text-text-muted'} />
              {isNarrating ? 'Martha is teaching…' : 'Lesson ready'}
            </div>
            {isNarrating ? (
              <button onClick={stopNarration} className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600">
                <Square size={14} /> Stop
              </button>
            ) : (
              <button onClick={() => narrate(lesson)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark">
                <Volume2 size={14} /> Read aloud
              </button>
            )}
          </div>

          <div className={`rounded-lg -m-1 p-1 transition-colors ${introSpeaking ? 'bg-primary/5' : ''}`}>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Introduction</p>
            <p className="text-text-primary leading-relaxed">{lesson.introduction}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Teaching</p>
            <ol className="flex flex-col gap-2">
              {lesson.teaching_points.map((point, i) => (
                <li key={i} className={`flex gap-3 rounded-lg p-1 transition-colors ${pointSpeaking(i) ? 'bg-primary/5' : ''}`}>
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="text-text-primary leading-relaxed">{point}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Check question + answer */}
          <div className={`rounded-[14px] p-4 transition-colors ${questionSpeaking ? 'bg-primary/10' : 'bg-bg-secondary/60'}`}>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Martha asks the class</p>
            <p className="text-text-primary font-medium mb-3">{lesson.check_question}</p>
            <div className="flex gap-2">
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEvaluate() }}
                placeholder="Type a student's answer…"
                className={`${inputClass} flex-1`}
              />
              <Button onClick={handleEvaluate} disabled={evaluating || !answer.trim()} className="flex items-center gap-2">
                {evaluating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Check
              </Button>
            </div>
          </div>

          {/* Evaluation */}
          {evaluation && (
            <div className={`rounded-[14px] p-4 ${evaluation.is_correct ? 'bg-green-50' : 'bg-amber-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {evaluation.is_correct
                  ? <CheckCircle size={16} className="text-green-600" />
                  : <XCircle size={16} className="text-amber-600" />}
                <span className={`text-sm font-semibold ${evaluation.is_correct ? 'text-green-700' : 'text-amber-700'}`}>
                  {evaluation.is_correct ? 'Correct' : 'Not quite'}
                </span>
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
        </div>
      )}
    </div>
  )
}
