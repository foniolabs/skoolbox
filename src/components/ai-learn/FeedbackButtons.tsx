import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { submitAiFeedback } from '../../lib/tauri/commands';

interface FeedbackButtonsProps {
  studentId: string;
  messageId: string;
  conversationId: string;
  aiResponseText: string;
  studentQuestion: string;
  topicId?: string;
  subject?: string;
}

export default function FeedbackButtons({
  studentId,
  messageId,
  conversationId,
  aiResponseText,
  studentQuestion,
  topicId,
  subject,
}: FeedbackButtonsProps) {
  const [given, setGiven] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFeedback = async (type: 'thumbs_up' | 'thumbs_down') => {
    if (given || saving) return;
    setSaving(true);
    try {
      await submitAiFeedback({
        studentId,
        messageId,
        conversationId,
        feedbackType: type,
        aiResponseText,
        studentQuestion,
        topicId,
        subject,
      });
      setGiven(type);
    } catch {
      // Silently ignore — feedback is best-effort
    } finally {
      setSaving(false);
    }
  };

  if (given) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600">
        <Check size={12} />
        Thanks for the feedback!
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <span className="text-xs text-text-muted mr-1">Was this helpful?</span>
      <button
        onClick={() => handleFeedback('thumbs_up')}
        disabled={saving}
        title="This helped me"
        className="p-1 rounded-full text-text-muted hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        onClick={() => handleFeedback('thumbs_down')}
        disabled={saving}
        title="This didn't help"
        className="p-1 rounded-full text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}
