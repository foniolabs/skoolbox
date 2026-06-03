import { create } from 'zustand';
import type { User } from '../lib/tauri/commands';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  login: (user: User) => void;
  logout: () => void;
  isTeacher: () => boolean;
  isStudent: () => boolean;
}

// Clear any stale persisted auth from old versions
if (typeof window !== 'undefined') {
  localStorage.removeItem('skoolbox-auth');
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoggedIn: false,

  login: (user: User) => set({ user, isLoggedIn: true }),

  logout: () => set({ user: null, isLoggedIn: false }),

  isTeacher: () => get().user?.role === 'teacher',

  isStudent: () => get().user?.role === 'student',
}));
