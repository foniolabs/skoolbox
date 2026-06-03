import { create } from 'zustand'
import { saveQuizAttempt } from '../lib/tauri/commands'

export interface QuizInfo {
  id: string
  subject: string
  topic: string
  questionCount: number
  duration: number // in minutes
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface CurrentQuiz {
  questions: QuizQuestion[]
  currentIndex: number
  answers: (number | null)[]
  startTime: number
  isComplete: boolean
}

export interface QuizResult {
  quizId: string
  subject: string
  topic: string
  score: number
  totalQuestions: number
  timeTaken: number // in seconds
  date: string
  answers: (number | null)[]
}

interface QuizState {
  availableQuizzes: QuizInfo[]
  currentQuiz: CurrentQuiz | null
  quizResults: QuizResult[]
  startQuiz: (questions: QuizQuestion[]) => void
  answerQuestion: (answerIndex: number) => void
  nextQuestion: () => void
  finishQuiz: (quizId: string, subject: string, topic: string) => void
}

export const useQuizStore = create<QuizState>((set, get) => ({
  availableQuizzes: [
    {
      id: 'quiz-math-algebra',
      subject: 'Mathematics',
      topic: 'Algebra',
      questionCount: 10,
      duration: 15,
      difficulty: 'medium',
    },
    {
      id: 'quiz-math-linear-eq',
      subject: 'Mathematics',
      topic: 'Linear Equations',
      questionCount: 10,
      duration: 15,
      difficulty: 'medium',
    },
    {
      id: 'quiz-eng-tenses',
      subject: 'English',
      topic: 'Tenses',
      questionCount: 10,
      duration: 12,
      difficulty: 'easy',
    },
    {
      id: 'quiz-sci-cells',
      subject: 'Basic Science',
      topic: 'Cells',
      questionCount: 10,
      duration: 12,
      difficulty: 'medium',
    },
    {
      id: 'quiz-tech-machines',
      subject: 'Basic Technology',
      topic: 'Simple Machines',
      questionCount: 10,
      duration: 15,
      difficulty: 'easy',
    },
  ],

  currentQuiz: null,
  quizResults: [],

  startQuiz: (questions) =>
    set({
      currentQuiz: {
        questions,
        currentIndex: 0,
        answers: new Array(questions.length).fill(null),
        startTime: Date.now(),
        isComplete: false,
      },
    }),

  answerQuestion: (answerIndex) =>
    set((state) => {
      if (!state.currentQuiz) return state
      const newAnswers = [...state.currentQuiz.answers]
      newAnswers[state.currentQuiz.currentIndex] = answerIndex
      return {
        currentQuiz: { ...state.currentQuiz, answers: newAnswers },
      }
    }),

  nextQuestion: () =>
    set((state) => {
      if (!state.currentQuiz) return state
      const nextIndex = state.currentQuiz.currentIndex + 1
      const isComplete = nextIndex >= state.currentQuiz.questions.length
      return {
        currentQuiz: {
          ...state.currentQuiz,
          currentIndex: isComplete ? state.currentQuiz.currentIndex : nextIndex,
          isComplete,
        },
      }
    }),

  finishQuiz: (quizId, subject, topic) => {
    const state = get()
    if (!state.currentQuiz) return

    const { questions, answers, startTime } = state.currentQuiz
    const score = answers.reduce<number>(
      (acc, answer, i) => (answer === questions[i].correctAnswer ? acc + 1 : acc),
      0
    )
    const timeTaken = Math.floor((Date.now() - startTime) / 1000)

    const result: QuizResult = {
      quizId,
      subject,
      topic,
      score,
      totalQuestions: questions.length,
      timeTaken,
      date: new Date().toISOString().split('T')[0],
      answers,
    }

    set({
      currentQuiz: { ...state.currentQuiz, isComplete: true },
      quizResults: [result, ...state.quizResults],
    })

    // Persist to backend (fire and forget)
    const scorePercent = Math.round((score / questions.length) * 100)
    saveQuizAttempt({
      studentId: 's1', // current student
      quizType: quizId.startsWith('quiz-gen') ? 'ai_generated' : 'practice',
      totalQuestions: questions.length,
      correctAnswers: score,
      score: scorePercent,
      timeTakenSeconds: timeTaken,
      questionsData: JSON.stringify(answers),
    }).catch((err) => console.error('Failed to save quiz attempt:', err))
  },
}))
