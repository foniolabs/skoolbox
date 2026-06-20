import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuizCard from '../components/quizzes/QuizCard';
import QuizGenerator from '../components/quizzes/QuizGenerator';
import { useQuizStore, type QuizInfo } from '../stores/useQuizStore';

type Tab = 'available' | 'completed' | 'ai-generated';

export default function QuizzesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('available');
  const navigate = useNavigate();
  const { availableQuizzes, quizResults } = useQuizStore();

  const completedQuizIds = new Set(quizResults.map((r) => r.quizId));

  const handleStartQuiz = (quiz: QuizInfo) => {
    navigate(`/quizzes/${quiz.id}`);
  };

  const handleGenerateQuiz = (config: {
    subject: string;
    topics: string[];
    topicMode: 'single' | 'custom' | 'mixed' | 'all';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  }) => {
    // For now, navigate to a generated quiz with query params
    const generatedId = `quiz-gen-${Date.now()}`;
    const topicParam = config.topics.join(',');
    navigate(`/quizzes/${generatedId}?subject=${encodeURIComponent(config.subject)}&topic=${encodeURIComponent(topicParam)}&difficulty=${config.difficulty}&count=${config.questionCount}`);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'available', label: 'Available' },
    { key: 'completed', label: 'Completed' },
    { key: 'ai-generated', label: 'AI Generated' },
  ];

  const filteredQuizzes =
    activeTab === 'completed'
      ? availableQuizzes.filter((q) => completedQuizIds.has(q.id))
      : activeTab === 'available'
        ? availableQuizzes.filter((q) => !completedQuizIds.has(q.id))
        : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Quizzes</h1>
        <p className="text-text-secondary mt-1">Test your knowledge and track your progress</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quiz grid */}
      {activeTab !== 'ai-generated' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.length > 0 ? (
            filteredQuizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} onStart={handleStartQuiz} />
            ))
          ) : (
            <p className="text-text-secondary col-span-full text-center py-8">
              {activeTab === 'completed'
                ? 'No completed quizzes yet. Start one!'
                : 'No available quizzes right now.'}
            </p>
          )}
        </div>
      ) : (
        <p className="text-text-secondary text-center py-8">
          Generate a custom quiz below to get started with AI-powered quizzes.
        </p>
      )}

      {/* Quiz generator */}
      <QuizGenerator onGenerate={handleGenerateQuiz} />
    </div>
  );
}
