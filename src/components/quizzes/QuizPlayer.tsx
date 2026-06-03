import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  Volume2,
  VolumeX,
  Lightbulb,
  XCircle,
} from 'lucide-react';
import Button from '../shared/Button';
import ProgressBar from '../shared/ProgressBar';
import QuestionView from './QuestionView';
import { useQuizStore, type QuizQuestion } from '../../stores/useQuizStore';
import { marthaTTS } from '../../lib/tts/browserTTS';

interface QuizPlayerProps {
  quizId: string;
  subject: string;
  topic: string;
  onExit: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuizPlayer({
  quizId,
  subject,
  topic,
  onExit,
  onComplete,
}: QuizPlayerProps) {
  const { currentQuiz, answerQuestion, nextQuestion, finishQuiz } = useQuizStore();
  const [elapsed, setElapsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Stop TTS on unmount
  useEffect(() => {
    return () => { marthaTTS.stop(); };
  }, []);

  const handlePrevious = useCallback(() => {
    if (!currentQuiz || currentQuiz.currentIndex === 0) return;
    useQuizStore.setState((state) => ({
      currentQuiz: state.currentQuiz
        ? { ...state.currentQuiz, currentIndex: state.currentQuiz.currentIndex - 1 }
        : null,
    }));
    setShowHint(false);
  }, [currentQuiz]);

  const handleNext = useCallback(() => {
    if (!currentQuiz) return;
    nextQuestion();
    setShowHint(false);
  }, [currentQuiz, nextQuestion]);

  const handleSubmit = useCallback(() => {
    finishQuiz(quizId, subject, topic);
    onComplete();
  }, [finishQuiz, quizId, subject, topic, onComplete]);

  const handleReadQuestion = useCallback(() => {
    if (!currentQuiz) return;
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    if (isReading) {
      marthaTTS.stop();
      setIsReading(false);
    } else {
      const text = `Question ${currentQuiz.currentIndex + 1}. ${q.question}. The options are: ${q.options.map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`).join('. ')}`;
      marthaTTS.speak(text, 0.9, () => setIsReading(false));
      setIsReading(true);
    }
  }, [currentQuiz, isReading]);

  if (!currentQuiz) return null;

  const { questions, currentIndex, answers } = currentQuiz;
  const question: QuizQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  // Build a real hint from the question's explanation
  const hintText = question.explanation
    ? `Hint: ${question.explanation.split('.').slice(0, 1).join('.')}. Think about this carefully.`
    : `Hint: Consider each option carefully. The answer relates to ${topic}.`;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {subject} &middot; {topic}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-text-secondary">
            Q {currentIndex + 1}/{totalQuestions}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-text-secondary">
            <Clock size={14} />
            {formatTime(elapsed)}
          </span>
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            <XCircle size={16} />
            Exit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar value={progress} size="sm" />

      {/* Question */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <QuestionView
          question={question}
          selectedAnswer={answers[currentIndex]}
          onSelectAnswer={answerQuestion}
        />
      </div>

      {/* Hint */}
      {showHint && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <span className="font-medium">{hintText}</span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReadQuestion}>
            <span className="flex items-center gap-1">
              {isReading ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {isReading ? 'Stop' : 'Read Question'}
            </span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)}>
            <span className="flex items-center gap-1">
              <Lightbulb size={16} />
              Hint
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <span className="flex items-center gap-1">
              <ArrowLeft size={16} />
              Previous
            </span>
          </Button>

          {isLastQuestion ? (
            <Button size="sm" onClick={handleSubmit}>
              Submit Quiz
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleNext}>
              <span className="flex items-center gap-1">
                Next
                <ArrowRight size={16} />
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
