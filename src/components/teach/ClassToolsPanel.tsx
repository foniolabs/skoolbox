import { useState } from 'react'
import { Loader2, X, Volume2, Eye, EyeOff, Download, MessageCircle, User, ListOrdered, ListChecks, BookOpen } from 'lucide-react'
import Button from '../shared/Button'
import { speak, stopSpeaking } from '../../lib/tts/marthaVoice'
import {
  classroomExplain, classroomClassQuiz, classroomLessonNote,
  type ClassQuiz, type LessonNote,
} from '../../lib/tauri/commands'
import { downloadText, lessonNoteToText } from '../../lib/classroomText'

type Tool = 'explain' | 'simpler' | 'prerequisites' | 'quiz' | 'note'

interface Props {
  subject: string
  topic: string
  classLevel: string
  /** Big-screen projector mode: larger fonts in the result modal. */
  projector: boolean
  /** Called when a tool starts (the page pauses lesson narration). */
  onOpen: () => void
  /** Lets the page keep the last note for the session-end summary. */
  onNote: (note: LessonNote) => void
}

/** On-demand teacher commands during a live class (SKILL.md Phase 5):
 *  explain to class · re-explain for a named student · prerequisites ·
 *  quiz (shown + read aloud) · lesson note (reviewable, downloadable). */
export default function ClassToolsPanel({ subject, topic, classLevel, projector, onOpen, onNote }: Props) {
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [explanation, setExplanation] = useState('')
  const [quiz, setQuiz] = useState<ClassQuiz | null>(null)
  const [note, setNote] = useState<LessonNote | null>(null)
  const [studentName, setStudentName] = useState('')
  const [askingName, setAskingName] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  const reset = () => {
    void stopSpeaking()
    setTool(null); setError(''); setExplanation(''); setQuiz(null); setShowAnswers(false); setAskingName(false)
  }

  const run = async (t: Tool, name?: string) => {
    onOpen()
    void stopSpeaking()
    setTool(t); setLoading(true); setError(''); setExplanation(''); setQuiz(null); setNote(null); setShowAnswers(false)
    try {
      if (t === 'quiz') {
        const q = await classroomClassQuiz(subject, topic, classLevel)
        setQuiz(q)
        // Read the questions aloud one after the other, pausing between them.
        void (async () => {
          for (const item of q.questions) { await speak(item.question) }
        })()
      } else if (t === 'note') {
        const n = await classroomLessonNote(subject, topic, classLevel)
        setNote(n); onNote(n)
      } else {
        const mode = t === 'explain' ? 'class' : t === 'simpler' ? 'simpler' : 'prerequisites'
        const text = await classroomExplain(subject, topic, classLevel, mode, name)
        setExplanation(text)
        void speak(text)
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Martha could not do that just now — try again.')
    } finally {
      setLoading(false)
    }
  }

  const btn = 'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[12px] border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50'
  const bodyText = projector ? 'text-2xl leading-relaxed' : 'text-base leading-relaxed'

  return (
    <>
      {/* Command bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-1">Ask Martha to…</span>
        <button className={btn} onClick={() => run('explain')} title="Explain the topic to the whole class again">
          <MessageCircle size={14} /> Explain to class
        </button>
        <button className={btn} onClick={() => { onOpen(); setAskingName(true); setTool(null) }} title="Re-explain more simply for one student">
          <User size={14} /> Re-explain for a student
        </button>
        <button className={btn} onClick={() => run('prerequisites')} title="Remind the class what they must already know">
          <ListOrdered size={14} /> Prerequisites
        </button>
        <button className={btn} onClick={() => run('quiz')} title="Quiz the class: 3–5 questions, shown and read aloud">
          <ListChecks size={14} /> Quiz the class
        </button>
        <button className={btn} onClick={() => run('note')} title="Generate a lesson note to review and save">
          <BookOpen size={14} /> Lesson note
        </button>
      </div>

      {/* Student-name prompt for “re-explain for a student” */}
      {askingName && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setAskingName(false)}>
          <div className="bg-white rounded-[16px] shadow-card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-text-primary mb-2">Which student should Martha carry along?</p>
            <input autoFocus value={studentName} onChange={(e) => setStudentName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && studentName.trim()) { setAskingName(false); void run('simpler', studentName.trim()) } }}
              placeholder="Student's name — e.g. Amina"
              className="w-full px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm focus:outline-none focus:border-primary" />
            <div className="flex justify-end gap-2 mt-3">
              <button className={btn} onClick={() => setAskingName(false)}>Cancel</button>
              <Button disabled={!studentName.trim()} onClick={() => { setAskingName(false); void run('simpler', studentName.trim()) }}>
                Re-explain
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Result modal */}
      {tool && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={reset}>
          <div className={`bg-white rounded-[20px] shadow-card w-full ${projector ? 'max-w-4xl' : 'max-w-2xl'} max-h-[85vh] overflow-y-auto p-6`}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                {tool === 'quiz' ? 'Class quiz' : tool === 'note' ? 'Lesson note — review before use' : 'Martha explains'}
              </p>
              <button onClick={reset} className="h-8 w-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary" title="Close (Esc stops Martha's voice)">
                <X size={16} />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-text-secondary py-8 justify-center">
                <Loader2 size={18} className="animate-spin" /> Martha is preparing…
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {explanation && (
              <div>
                <p className={`${bodyText} text-text-primary whitespace-pre-wrap`}>{explanation}</p>
                <button className={`${btn} mt-4`} onClick={() => { void stopSpeaking(); void speak(explanation) }}>
                  <Volume2 size={14} /> Say it again
                </button>
              </div>
            )}

            {quiz && (
              <div>
                <h3 className={`font-bold text-text-primary mb-3 ${projector ? 'text-3xl' : 'text-lg'}`}>{quiz.title}</h3>
                <ol className="flex flex-col gap-4">
                  {quiz.questions.map((q, i) => (
                    <li key={i} className="border border-border rounded-[12px] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`${bodyText} text-text-primary font-medium`}>{i + 1}. {q.question}</p>
                        <button onClick={() => { void stopSpeaking(); void speak(q.question) }} title="Martha reads this question aloud"
                          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary">
                          <Volume2 size={15} />
                        </button>
                      </div>
                      {showAnswers && <p className={`${projector ? 'text-xl' : 'text-sm'} text-green-700 mt-2`}>Answer: {q.answer}</p>}
                    </li>
                  ))}
                </ol>
                <button className={`${btn} mt-4`} onClick={() => setShowAnswers((s) => !s)}>
                  {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />} {showAnswers ? 'Hide answers' : 'Show answers (teacher)'}
                </button>
              </div>
            )}

            {note && (
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-text-primary">{note.title}</h3>
                {([
                  ['Objectives — pupils should be able to:', note.objectives],
                  ['Key points', note.key_points],
                  ['Worked examples', note.examples],
                  ['Homework', note.homework],
                ] as [string, string[]][]).map(([title, items]) => (
                  <div key={title}>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">{title}</p>
                    <ul className="list-disc pl-5 flex flex-col gap-1">
                      {items.map((item, i) => <li key={i} className="text-sm text-text-primary leading-relaxed">{item}</li>)}
                    </ul>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Button onClick={() => downloadText(`lesson-note-${topic.replace(/\s+/g, '-').toLowerCase()}.txt`, lessonNoteToText(note))}
                    className="flex items-center gap-2">
                    <Download size={14} /> Save note
                  </Button>
                  <span className="text-xs text-text-muted">Review and edit before giving it to the class.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
