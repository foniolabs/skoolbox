import { create } from 'zustand';
import { isTauri, type User } from '../lib/tauri/commands';

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

// The web demo reloads on refresh, so keep its sign-in for the tab's lifetime.
// The desktop app stays memory-only.
const WEB_SESSION_KEY = 'skoolbox-web-session';

function readWebSession(): User | null {
  if (isTauri || typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem(WEB_SESSION_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
}

function writeWebSession(user: User | null) {
  if (isTauri) return;
  try {
    if (user) sessionStorage.setItem(WEB_SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(WEB_SESSION_KEY);
  } catch {
    // Storage blocked: the demo still works, it just signs out on refresh.
  }
}

const restoredUser = readWebSession();

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: restoredUser,
  isLoggedIn: restoredUser !== null,

  login: (user: User) => {
    writeWebSession(user);
    set({ user, isLoggedIn: true });
  },

  logout: () => {
    writeWebSession(null);
    set({ user: null, isLoggedIn: false });
  },

  isTeacher: () => get().user?.role === 'teacher',

  isStudent: () => get().user?.role === 'student',
}));
