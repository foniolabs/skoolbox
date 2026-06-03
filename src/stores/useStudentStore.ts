import { create } from 'zustand';

export interface Student {
  id: string;
  name: string;
  classLevel: string;
  streakDays: number;
  totalPoints: number;
  avatar: string;
}

interface StudentState {
  student: Student;
  updateStreak: (days: number) => void;
  addPoints: (points: number) => void;
  updateProfile: (updates: Partial<Student>) => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  student: {
    id: 'student-001',
    name: 'Emmanuel',
    classLevel: 'Pry 5',
    streakDays: 12,
    totalPoints: 2450,
    avatar: '/avatars/default.png',
  },

  updateStreak: (days) =>
    set((state) => ({
      student: { ...state.student, streakDays: days },
    })),

  addPoints: (points) =>
    set((state) => ({
      student: { ...state.student, totalPoints: state.student.totalPoints + points },
    })),

  updateProfile: (updates) =>
    set((state) => ({
      student: { ...state.student, ...updates },
    })),
}));
