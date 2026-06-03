import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import QuizPlayer from '../components/quizzes/QuizPlayer'
import QuizResults from '../components/quizzes/QuizResults'
import { useQuizStore, type QuizQuestion } from '../stores/useQuizStore'
import { mathQuestions } from '../data/questions/mathQuestions'
import { getQuestions, generateQuizAi } from '../lib/tauri/commands'

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/** Convert backend Question format to frontend QuizQuestion format */
function convertBackendQuestion(q: { id: string; question_text: string; options: string | null; correct_answer: string; explanation: string | null; difficulty: number }): QuizQuestion {
  const options: string[] = q.options ? JSON.parse(q.options) : []
  const correctIndex = options.findIndex((o) => o === q.correct_answer)
  const diffMap: Record<number, 'easy' | 'medium' | 'hard'> = { 1: 'easy', 2: 'medium', 3: 'hard' }
  return {
    id: q.id,
    question: q.question_text,
    options,
    correctAnswer: correctIndex >= 0 ? correctIndex : 0,
    explanation: q.explanation || '',
    difficulty: diffMap[q.difficulty] || 'medium',
  }
}

/** Get questions - try backend first, then fall back to local mathQuestions */
async function fetchQuestions(
  count: number,
  difficulty: string | undefined,
  subject: string,
  topic: string,
): Promise<QuizQuestion[]> {
  // Try AI generation first
  try {
      const aiResponse = await generateQuizAi({
        subject,
        topic,
        classLevel: 'Pry 5',
        difficulty: difficulty || 'medium',
        numQuestions: count,
      })
      let jsonStr = aiResponse.trim()
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) jsonStr = match[1].trim()
      const parsed = JSON.parse(jsonStr)
      const questions = Array.isArray(parsed) ? parsed : parsed.questions || []
      if (questions.length > 0) {
        return questions.map((q: Record<string, unknown>, i: number) => {
          const opts = (q.options as string[]) || []
          const correctIdx = opts.findIndex((o) => o === q.correct_answer)
          return {
            id: `ai-q-${i}`,
            question: (q.question_text as string) || (q.question as string) || '',
            options: opts,
            correctAnswer: correctIdx >= 0 ? correctIdx : 0,
            explanation: (q.explanation as string) || '',
            difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          }
        })
      }
    } catch (err) {
      console.warn('AI quiz generation failed, trying backend DB:', err)
    }

  // Try backend database questions
  try {
    // Use a general topic search - the backend matches by topic_id
    const backendQuestions = await getQuestions(topic || subject, undefined, count)
    if (backendQuestions.length > 0) {
      return shuffleArray(backendQuestions.map(convertBackendQuestion)).slice(0, count)
    }
  } catch {
    // Fall through to local
  }

  // Final fallback: local mathQuestions
  let pool: QuizQuestion[] = mathQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
  }))

  if (difficulty) {
    const filtered = pool.filter((q) => q.difficulty === difficulty)
    if (filtered.length >= count) pool = filtered
  }

  return shuffleArray(pool).slice(0, count)
}

export default function QuizPlayerPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { availableQuizzes, currentQuiz, quizResults, startQuiz } = useQuizStore()

  const [quizMeta, setQuizMeta] = useState<{
    subject: string
    topic: string
  } | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!quizId) {
      navigate('/assess')
      return
    }

    const predefined = availableQuizzes.find((q) => q.id === quizId)

    let subject: string
    let topic: string
    let count: number
    let difficulty: string | undefined

    if (predefined) {
      subject = predefined.subject
      topic = predefined.topic
      count = predefined.questionCount
      difficulty = predefined.difficulty
    } else {
      subject = searchParams.get('subject') || 'Mathematics'
      topic = searchParams.get('topic') || 'Custom Quiz'
      count = Number(searchParams.get('count')) || 10
      difficulty = searchParams.get('difficulty') || undefined
    }

    setQuizMeta({ subject, topic })
    setLoading(true)
    setShowResults(false)

    fetchQuestions(count, difficulty, subject, topic).then((questions) => {
      startQuiz(questions)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId])

  const handleComplete = useCallback(() => {
    setShowResults(true)
  }, [])

  const handleRetake = useCallback(() => {
    setShowResults(false)
    setLoading(true)

    const predefined = availableQuizzes.find((q) => q.id === quizId)
    const subject = predefined?.subject || searchParams.get('subject') || 'Mathematics'
    const topic = predefined?.topic || searchParams.get('topic') || 'Custom Quiz'
    const count = predefined?.questionCount || Number(searchParams.get('count')) || 10
    const difficulty = predefined?.difficulty || searchParams.get('difficulty') || undefined

    fetchQuestions(count, difficulty, subject, topic).then((questions) => {
      startQuiz(questions)
      setLoading(false)
    })
  }, [quizId, availableQuizzes, searchParams, startQuiz])

  const handleExit = useCallback(() => {
    navigate('/assess')
  }, [navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="flex justify-center gap-1 mb-4">
            <div className="w-3 h-3 rounded-full bg-primary animate-dot-1" />
            <div className="w-3 h-3 rounded-full bg-primary animate-dot-2" />
            <div className="w-3 h-3 rounded-full bg-primary animate-dot-3" />
          </div>
          <p className="text-lg font-medium text-text-primary">
            {'Generating quiz questions...'}
          </p>
        </div>
      </div>
    )
  }

  if (!quizMeta || !currentQuiz) return null

  if (showResults) {
    const latestResult = quizResults[0]
    if (!latestResult) return null

    return (
      <QuizResults
        results={{
          score: latestResult.score,
          totalQuestions: latestResult.totalQuestions,
          timeTaken: latestResult.timeTaken,
          answers: latestResult.answers,
          questions: currentQuiz.questions,
        }}
        onRetake={handleRetake}
      />
    )
  }

  return (
    <QuizPlayer
      quizId={quizId!}
      subject={quizMeta.subject}
      topic={quizMeta.topic}
      onExit={handleExit}
      onComplete={handleComplete}
    />
  )
}
