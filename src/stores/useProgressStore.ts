import { create } from 'zustand';

export interface SubjectProgress {
  subjectId: string;
  topicsCompleted: number;
  totalTopics: number;
  averageScore: number;
  timeSpent: number; // in minutes
}

export interface WeeklyActivity {
  day: string;
  questionsAnswered: number;
  score: number;
}

export interface QuizHistoryEntry {
  id: string;
  subject: string;
  topic: string;
  score: number;
  totalQuestions: number;
  date: string;
}

interface ProgressState {
  subjectProgress: SubjectProgress[];
  weeklyActivity: WeeklyActivity[];
  strengths: string[];
  weaknesses: string[];
  quizHistory: QuizHistoryEntry[];
  updateSubjectProgress: (subjectId: string, updates: Partial<SubjectProgress>) => void;
  addQuizToHistory: (entry: QuizHistoryEntry) => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  subjectProgress: [
    {
      subjectId: 'mathematics',
      topicsCompleted: 4,
      totalTopics: 5,
      averageScore: 80,
      timeSpent: 320,
    },
    {
      subjectId: 'english',
      topicsCompleted: 3,
      totalTopics: 6,
      averageScore: 55,
      timeSpent: 210,
    },
    {
      subjectId: 'basic-science',
      topicsCompleted: 1,
      totalTopics: 5,
      averageScore: 20,
      timeSpent: 75,
    },
    {
      subjectId: 'basic-technology',
      topicsCompleted: 4,
      totalTopics: 6,
      averageScore: 70,
      timeSpent: 280,
    },
  ],

  weeklyActivity: [
    { day: 'Mon', questionsAnswered: 15, score: 78 },
    { day: 'Tue', questionsAnswered: 22, score: 85 },
    { day: 'Wed', questionsAnswered: 10, score: 60 },
    { day: 'Thu', questionsAnswered: 18, score: 72 },
    { day: 'Fri', questionsAnswered: 25, score: 90 },
    { day: 'Sat', questionsAnswered: 8, score: 65 },
    { day: 'Sun', questionsAnswered: 12, score: 70 },
  ],

  strengths: [
    'Algebra & Linear Equations',
    'Technical Drawing',
    'Sentence Construction',
    'Simple Machines',
  ],

  weaknesses: [
    'Cell Biology',
    'Tenses & Grammar',
    'Chemical Equations',
    'Statistics & Probability',
  ],

  quizHistory: [
    {
      id: 'qh-001',
      subject: 'Mathematics',
      topic: 'Linear Equations',
      score: 8,
      totalQuestions: 10,
      date: '2026-03-25',
    },
    {
      id: 'qh-002',
      subject: 'English',
      topic: 'Tenses',
      score: 5,
      totalQuestions: 10,
      date: '2026-03-24',
    },
    {
      id: 'qh-003',
      subject: 'Basic Science',
      topic: 'Living Cells',
      score: 3,
      totalQuestions: 10,
      date: '2026-03-23',
    },
    {
      id: 'qh-004',
      subject: 'Mathematics',
      topic: 'Algebra',
      score: 9,
      totalQuestions: 10,
      date: '2026-03-22',
    },
    {
      id: 'qh-005',
      subject: 'Basic Technology',
      topic: 'Simple Machines',
      score: 7,
      totalQuestions: 10,
      date: '2026-03-21',
    },
  ],

  updateSubjectProgress: (subjectId, updates) =>
    set((state) => ({
      subjectProgress: state.subjectProgress.map((sp) =>
        sp.subjectId === subjectId ? { ...sp, ...updates } : sp
      ),
    })),

  addQuizToHistory: (entry) =>
    set((state) => ({
      quizHistory: [entry, ...state.quizHistory],
    })),
}));
