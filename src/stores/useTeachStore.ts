import { create } from 'zustand'
import { getAiLessonHistory } from '../lib/tauri/commands'

export type PresentationMode =
  | 'whiteboard'
  | 'video'
  | 'animation'
  | 'slideshow'
  | 'narrated'
  | 'auto'

export interface RecentLesson {
  id: string
  title: string
  mode: PresentationMode
  subject: string
  date: string
}

export interface Lesson {
  id: string
  title: string
  content: string
  mode: PresentationMode
  subject: string
  classLevel: string
}

interface TeachState {
  teacherCommand: string
  selectedSubject: string
  selectedClass: string
  selectedMode: PresentationMode
  isPresenting: boolean
  currentLesson: Lesson | null
  recentLessons: RecentLesson[]
  isLoadingHistory: boolean

  setCommand: (command: string) => void
  setSubject: (subject: string) => void
  setClass: (classLevel: string) => void
  setMode: (mode: PresentationMode) => void
  startPresentation: () => void
  stopPresentation: () => void
  setCurrentLesson: (lesson: Lesson | null) => void
  addRecentLesson: (lesson: RecentLesson) => void
  loadRecentLessons: () => Promise<void>
}

const useTeachStore = create<TeachState>((set) => ({
  teacherCommand: '',
  selectedSubject: '',
  selectedClass: '',
  selectedMode: 'auto',
  isPresenting: false,
  currentLesson: null,
  recentLessons: [],
  isLoadingHistory: false,

  setCommand: (command) => set({ teacherCommand: command }),
  setSubject: (subject) => set({ selectedSubject: subject }),
  setClass: (classLevel) => set({ selectedClass: classLevel }),
  setMode: (mode) => set({ selectedMode: mode }),
  startPresentation: () => set({ isPresenting: true }),
  stopPresentation: () => set({ isPresenting: false }),
  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),
  addRecentLesson: (lesson) =>
    set((state) => ({
      recentLessons: [lesson, ...state.recentLessons],
    })),

  loadRecentLessons: async () => {
    set({ isLoadingHistory: true })
    try {
      const history = await getAiLessonHistory()
      const lessons: RecentLesson[] = history.map((h) => ({
        id: h.id,
        title: h.teacher_command,
        mode: (h.mode as PresentationMode) || 'whiteboard',
        subject: h.subject || 'General',
        date: h.created_at.split('T')[0],
      }))
      set({ recentLessons: lessons })
    } catch (err) {
      console.error('Failed to load lesson history:', err)
    }
    set({ isLoadingHistory: false })
  },
}))

export default useTeachStore
