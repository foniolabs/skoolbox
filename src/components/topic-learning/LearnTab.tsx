import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Volume2, VolumeX } from 'lucide-react';
import { aiAgentChat, generateConversationSummary } from '../../lib/tauri/commands';
import { marthaTTS } from '../../lib/tts/browserTTS';
import FeedbackButtons from '../ai-learn/FeedbackButtons';
import { useAuthStore } from '../../stores/useAuthStore';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  messageId?: string;   // AI message ID (for feedback)
  userContent?: string; // The user message that triggered this AI response
}

interface LearnTabProps {
  subject: string;
  topic: string;
  topicId?: string;
  classLevel: string;
}

// Generate a stable conversation ID per topic session
function makeConversationId(studentId: string, topic: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${studentId}-${topic.slice(0, 20).replace(/\s+/g, '-')}-${date}`;
}

export default function LearnTab({ subject, topic, topicId, classLevel }: LearnTabProps) {
  const { user } = useAuthStore();
  const studentId = user?.student_id || '';
  const conversationId = makeConversationId(studentId, topic);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // When student leaves, generate a conversation summary (fire-and-forget)
  const summarizeOnExit = useCallback(() => {
    if (!studentId || messages.length < 2) return;
    marthaTTS.stop();
    generateConversationSummary({
      studentId,
      conversationId,
      subject,
      topic,
    }).catch(() => {}); // best-effort
  }, [studentId, conversationId, subject, topic, messages.length]);

  useEffect(() => {
    return () => { summarizeOnExit(); };
  }, [summarizeOnExit]);

  const toggleSpeak = (idx: number, content: string) => {
    if (speakingIdx === idx) {
      marthaTTS.stop();
      setSpeakingIdx(null);
    } else {
      marthaTTS.speak(content, 0.95, () => setSpeakingIdx(null));
      setSpeakingIdx(idx);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiAgentChat({
        studentId,
        message: content,
        subject,
        topic,
        classLevel,
        conversationId,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.message,
          messageId: response.message_id,
          userContent: content,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Martha is having trouble connecting right now. Please check your internet connection and API key in Settings.\n\nError: ${err}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const startLearning = async () => {
    setStarted(true);
    await sendMessage(
      `Please teach me about "${topic}" in ${subject}. Start from the basics and explain step by step.`
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  // Not started yet — show welcome screen
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-6 shadow-lg">
          <Bot size={36} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-text-primary mb-2">Meet Martha</h3>
        <p className="text-text-secondary max-w-md mb-6">
          Martha is your personal AI tutor. She'll explain{' '}
          <strong>{topic}</strong> step by step, answer your questions, and help
          you truly understand — not just memorise.
        </p>
        <button
          onClick={startLearning}
          className="flex items-center gap-2 px-6 py-3 rounded-[14px] bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-md"
        >
          <Sparkles size={18} />
          Start Learning with Martha
        </button>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
          {[
            'Explain it simply',
            'Give me real-life examples',
            'How will this help me in WAEC?',
          ].map((q) => (
            <button
              key={q}
              onClick={() => {
                setStarted(true);
                sendMessage(`${q} (about ${topic} in ${subject})`);
              }}
              className="px-3 py-2.5 rounded-[12px] bg-bg-secondary text-sm text-text-secondary hover:bg-bg-secondary/80 hover:text-text-primary transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                <Bot size={16} className="text-primary" />
              </div>
            )}

            <div className="max-w-[80%]">
              <div
                className={`px-4 py-3 rounded-[16px] text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white shadow-card text-text-primary rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>

              {/* Controls for AI messages */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {/* Read Aloud */}
                  <button
                    onClick={() => toggleSpeak(i, msg.content)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                      speakingIdx === i
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-text-muted hover:text-text-secondary hover:bg-gray-100'
                    }`}
                  >
                    {speakingIdx === i ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    {speakingIdx === i ? 'Stop' : 'Read Aloud'}
                  </button>

                  {/* Feedback buttons (only if we have a message ID) */}
                  {msg.messageId && studentId && (
                    <FeedbackButtons
                      studentId={studentId}
                      messageId={msg.messageId}
                      conversationId={conversationId}
                      aiResponseText={msg.content}
                      studentQuestion={msg.userContent || ''}
                      topicId={topicId}
                      subject={subject}
                    />
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center mt-1">
                <User size={16} className="text-accent" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot size={16} className="text-primary" />
            </div>
            <div className="bg-white shadow-card px-4 py-3 rounded-[16px] rounded-bl-sm">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                Martha is thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Martha a question..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-[14px] border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
