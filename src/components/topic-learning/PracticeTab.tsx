import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Lightbulb, Loader2 } from 'lucide-react';
import { getQuestions } from '../../lib/tauri/commands';
import type { Question } from '../../lib/tauri/commands';

interface PracticeTabProps {
  topicId: string;
  topicName: string;
}

export default function PracticeTab({ topicId, topicName }: PracticeTabProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const qs = await getQuestions(topicId, undefined, 10);
        setQuestions(qs);
      } catch (err) {
        console.error('Failed to load questions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [topicId]);

  const current = questions[currentIndex];
  const options: string[] = current?.options ? JSON.parse(current.options) : [];
  const isCorrect = selectedAnswer === current?.correct_answer;
  const totalAnswered = currentIndex + (showResult ? 1 : 0);

  const handleSelect = (option: string) => {
    if (showResult) return;
    setSelectedAnswer(option);
    setShowResult(true);
    if (option === current.correct_answer) {
      setCorrectCount((c) => c + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setCorrectCount(0);
    setFinished(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-primary" />
        <span className="ml-2 text-text-secondary">Loading practice questions...</span>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-16">
        <Lightbulb size={48} className="mx-auto text-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">No Practice Questions Yet</h3>
        <p className="text-text-secondary">
          Your teacher hasn't added practice questions for {topicName} yet. Check back later!
        </p>
      </div>
    );
  }

  // Finished all questions
  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    const emoji = pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good job!' : 'Keep practicing!';

    return (
      <div className="flex flex-col items-center py-12 px-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
          pct >= 80 ? 'bg-green-100' : pct >= 60 ? 'bg-amber-100' : 'bg-red-100'
        }`}>
          <span className="text-3xl font-bold">{pct}%</span>
        </div>
        <h3 className="text-xl font-bold text-text-primary mb-1">{emoji}</h3>
        <p className="text-text-secondary mb-6">
          You got {correctCount} out of {questions.length} correct
        </p>
        <button
          onClick={handleRestart}
          className="flex items-center gap-2 px-6 py-3 rounded-[14px] bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          <RotateCcw size={18} />
          Practice Again
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-secondary">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-sm font-medium text-primary">
          {correctCount} correct
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-100 mb-6">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIndex + (showResult ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-white rounded-[20px] shadow-card p-6 mb-4">
        <p className="text-lg font-semibold text-text-primary mb-6">{current.question_text}</p>

        <div className="flex flex-col gap-3">
          {options.map((option, i) => {
            const isSelected = selectedAnswer === option;
            const isRight = option === current.correct_answer;

            let style = 'border-gray-200 hover:border-primary hover:bg-primary/5';
            if (showResult) {
              if (isRight) style = 'border-green-500 bg-green-50';
              else if (isSelected && !isRight) style = 'border-red-500 bg-red-50';
              else style = 'border-gray-100 opacity-60';
            } else if (isSelected) {
              style = 'border-primary bg-primary/5';
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(option)}
                disabled={showResult}
                className={`flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-[14px] border-2 transition-all ${style}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-text-secondary shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-medium text-text-primary flex-1">{option}</span>
                {showResult && isRight && <CheckCircle size={20} className="text-green-500 shrink-0" />}
                {showResult && isSelected && !isRight && <XCircle size={20} className="text-red-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showResult && current.explanation && (
        <div className={`rounded-[16px] p-5 mb-4 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect ? (
              <CheckCircle size={18} className="text-green-600" />
            ) : (
              <Lightbulb size={18} className="text-amber-600" />
            )}
            <span className="font-semibold text-sm">
              {isCorrect ? 'Correct!' : 'Not quite — here\'s why:'}
            </span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{current.explanation}</p>
        </div>
      )}

      {/* Next button */}
      {showResult && (
        <button
          onClick={handleNext}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-[14px] bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          {currentIndex + 1 >= questions.length ? 'See Results' : 'Next Question'}
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}
