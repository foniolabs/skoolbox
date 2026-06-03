import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  currentSubject: string | null;
  currentTopic: string | null;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  setTyping: (typing: boolean) => void;
  setContext: (subject: string | null, topic: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Hello Emmanuel! I\'m your SkoolBox AI tutor. I can help you understand any topic from your subjects. You can ask me questions, request explanations, or even ask me to quiz you. What would you like to learn today?',
      timestamp: Date.now(),
    },
  ],

  isTyping: false,
  currentSubject: null,
  currentTopic: null,

  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role,
          content,
          timestamp: Date.now(),
        },
      ],
    })),

  setTyping: (typing) => set({ isTyping: typing }),

  setContext: (subject, topic) =>
    set({ currentSubject: subject, currentTopic: topic }),

  clearMessages: () =>
    set({
      messages: [
        {
          id: 'welcome-msg',
          role: 'assistant',
          content:
            'Hello Emmanuel! I\'m your SkoolBox AI tutor. I can help you understand any topic from your subjects. You can ask me questions, request explanations, or even ask me to quiz you. What would you like to learn today?',
          timestamp: Date.now(),
        },
      ],
    }),
}));
