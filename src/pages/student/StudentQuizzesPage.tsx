import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle, Star, BookOpen } from 'lucide-react';
import QuizGenerator from '../../components/quizzes/QuizGenerator';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { getQuizAttempts, type QuizAttempt } from '../../lib/tauri/commands';

type Tab = 'self-assess' | 'history';

export default function StudentQuizzesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('self-assess');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!user?.student_id) return;
    setLoadingHistory(true);
    getQuizAttempts(user.student_id)
      .then(setHistory)
      .catch((err) => console.error('Failed to load quiz history:', err))
      .finally(() => setLoadingHistory(false));
  }, [user?.student_id]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'self-assess', label: 'Self Assessment' },
    { key: 'history', label: 'Quiz History' },
  ];

  const handleGenerateQuiz = (config: {
    subject: string;
    topics: string[];
    topicMode: 'single' | 'custom' | 'mixed' | 'all';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  }) => {
    const generatedId = `quiz-self-${Date.now()}`;
    const topicsParam = config.topics.join(',');
    navigate(
      `/assess/${generatedId}?subject=${encodeURIComponent(config.subject)}&topics=${encodeURIComponent(topicsParam)}&mode=${config.topicMode}&difficulty=${config.difficulty}&count=${config.questionCount}`
    );
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">Quizzes</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-[20px] p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-[16px] text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary shadow-card'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Self Assessment */}
      {activeTab === 'self-assess' && (
        <div>
          <p className="text-text-secondary mb-4">
            Generate a custom quiz to test yourself on any topic.
          </p>
          <div className="[&>div]:rounded-[20px] [&>div]:shadow-card">
            <QuizGenerator onGenerate={handleGenerateQuiz} />
          </div>
        </div>
      )}

      {/* Quiz History */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : history.length > 0 ? (
            history.map((quiz) => {
              const pct = Math.round(quiz.score);
              return (
                <div key={quiz.id} className="bg-white rounded-[20px] shadow-card p-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary">
                    <CheckCircle size={24} className={getScoreColor(pct)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary">
                      {quiz.subject_id || 'Quiz'} {quiz.topic_id ? `— ${quiz.topic_id}` : ''}
                    </p>
                    <p className="text-sm text-text-muted">
                      {formatDate(quiz.created_at)} · {quiz.quiz_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${getScoreColor(pct)}`}>{pct}%</p>
                    <p className="text-xs text-text-muted">
                      {quiz.correct_answers}/{quiz.total_questions} correct
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= Math.round(pct / 20) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <BookOpen size={32} className="text-text-muted mb-3" />
              <p className="text-text-secondary">No quiz history yet.</p>
              <p className="text-sm text-text-muted mt-1">
                Take a quiz from Self Assessment or from a topic page to see your results here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
