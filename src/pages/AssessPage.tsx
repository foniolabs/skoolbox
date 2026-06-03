import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import QuizCard from '../components/quizzes/QuizCard';
import QuizGenerator from '../components/quizzes/QuizGenerator';
import { useQuizStore, type QuizInfo } from '../stores/useQuizStore';

type Tab = 'available' | 'assigned' | 'completed' | 'create';

export default function AssessPage() {
  const [activeTab, setActiveTab] = useState<Tab>('available');
  const navigate = useNavigate();
  const { availableQuizzes, quizResults } = useQuizStore();

  const completedQuizIds = new Set(quizResults.map((r) => r.quizId));

  const handleStartQuiz = (quiz: QuizInfo) => {
    navigate(`/assess/${quiz.id}`);
  };

  const handleGenerateQuiz = (config: {
    subject: string;
    topics: string[];
    topicMode: 'single' | 'custom' | 'mixed' | 'all';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  }) => {
    const generatedId = `quiz-gen-${Date.now()}`;
    const topicsParam = config.topics.join(',');
    navigate(
      `/assess/${generatedId}?subject=${encodeURIComponent(config.subject)}&topics=${encodeURIComponent(topicsParam)}&mode=${config.topicMode}&difficulty=${config.difficulty}&count=${config.questionCount}`
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'available', label: 'Available' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'completed', label: 'Completed' },
    { key: 'create', label: 'Create New' },
  ];

  const filteredQuizzes =
    activeTab === 'completed'
      ? availableQuizzes.filter((q) => completedQuizIds.has(q.id))
      : activeTab === 'available'
        ? availableQuizzes.filter((q) => !completedQuizIds.has(q.id))
        : activeTab === 'assigned'
          ? availableQuizzes
          : [];

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">Assessments</h1>
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

      {/* Quiz grid */}
      {activeTab !== 'create' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.length > 0 ? (
            filteredQuizzes.map((quiz) => (
              <div key={quiz.id} className="[&>div]:rounded-[20px] [&>div]:shadow-card">
                <QuizCard quiz={quiz} onStart={handleStartQuiz} />
              </div>
            ))
          ) : (
            <p className="text-text-secondary col-span-full text-center py-8">
              {activeTab === 'completed'
                ? 'No completed assessments yet.'
                : activeTab === 'assigned'
                  ? 'No assigned assessments yet.'
                  : 'No available assessments right now.'}
            </p>
          )}
        </div>
      ) : (
        <p className="text-text-secondary text-center py-8">
          Generate a custom assessment below to get started.
        </p>
      )}

      {/* Quiz generator */}
      <div className="[&>div]:rounded-[20px] [&>div]:shadow-card">
        <QuizGenerator onGenerate={handleGenerateQuiz} />
      </div>
    </div>
  );
}
