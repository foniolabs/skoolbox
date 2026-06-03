import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Bot,
} from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { type QuizQuestion } from '../../stores/useQuizStore';

interface QuizResultsProps {
  results: {
    score: number;
    totalQuestions: number;
    timeTaken: number;
    answers: (number | null)[];
    questions: QuizQuestion[];
  };
  onRetake: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuizResults({ results, onRetake }: QuizResultsProps) {
  const navigate = useNavigate();
  const { score, totalQuestions, timeTaken, answers, questions } = results;
  const percentage = Math.round((score / totalQuestions) * 100);
  const wrongCount = totalQuestions - score;
  const isCelebration = percentage > 70;

  const wrongAnswers = questions
    .map((q, i) => ({ question: q, userAnswer: answers[i], index: i }))
    .filter(({ question, userAnswer }) => userAnswer !== question.correctAnswer);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Score display */}
      <Card className="text-center py-10">
        {isCelebration && (
          <div className="flex justify-center mb-4">
            <Trophy size={48} className="text-amber-500" />
          </div>
        )}
        <h2 className="text-5xl font-bold text-text-primary">
          {score}/{totalQuestions}
        </h2>
        <p className="text-2xl font-semibold text-primary mt-2">{percentage}%</p>
        {isCelebration ? (
          <p className="text-text-secondary mt-2">Great job! Keep up the good work!</p>
        ) : (
          <p className="text-text-secondary mt-2">Keep practicing, you'll get better!</p>
        )}
        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-text-secondary">
          <span>+{score * 10} points earned</span>
          {isCelebration && <span>&middot; Streak maintained!</span>}
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-text-primary">{score}</p>
          <p className="text-sm text-text-secondary">Correct</p>
        </Card>
        <Card className="text-center">
          <XCircle size={24} className="text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-text-primary">{wrongCount}</p>
          <p className="text-sm text-text-secondary">Wrong</p>
        </Card>
        <Card className="text-center">
          <Clock size={24} className="text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-text-primary">{formatTime(timeTaken)}</p>
          <p className="text-sm text-text-secondary">Time Taken</p>
        </Card>
      </div>

      {/* Review wrong answers */}
      {wrongAnswers.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-text-primary">Review Wrong Answers</h3>
          {wrongAnswers.map(({ question, userAnswer, index }) => (
            <Card key={index} className="flex flex-col gap-3">
              <p className="font-medium text-text-primary">
                Q{index + 1}. {question.question}
              </p>
              <div className="flex flex-col gap-1.5 text-sm">
                <p className="flex items-center gap-2 text-red-600">
                  <XCircle size={14} />
                  Your answer:{' '}
                  {userAnswer !== null ? question.options[userAnswer] : 'Not answered'}
                </p>
                <p className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 size={14} />
                  Correct answer: {question.options[question.correctAnswer]}
                </p>
              </div>
              <p className="text-sm text-text-secondary bg-gray-50 rounded-lg p-3">
                {question.explanation}
              </p>
              <button
                onClick={() => navigate('/ai-tutor')}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark transition-colors self-start"
              >
                <Bot size={14} />
                Ask AI Tutor
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onRetake} className="flex items-center gap-2">
          <RotateCcw size={16} />
          Retake Quiz
        </Button>
        <Button onClick={() => navigate('/quizzes')}>Back to Quizzes</Button>
      </div>
    </div>
  );
}
