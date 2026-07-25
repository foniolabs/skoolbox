import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, XCircle, Trophy, RotateCcw, Play, Bot, Loader2, Volume2 } from 'lucide-react';
import { getQuestions, saveQuizAttempt, updateStudentProgress, askStudentTutor } from '../../lib/tauri/commands';
import { useAuthStore } from '../../stores/useAuthStore';
import { marthaTTS } from '../../lib/tts/browserTTS';
import type { Question } from '../../lib/tauri/commands';

interface QuizTabProps {
  topicId: string;
  topicName: string;
  subjectId: string;
}

type Phase = 'setup' | 'active' | 'results';

export default function QuizTab({ topicId, topicName, subjectId }: QuizTabProps) {
  const user = useAuthStore((s) => s.user);
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(10); // minutes
  const [loading, setLoading] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null);

  // Timer
  useEffect(() => {
    if (phase !== 'active' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finishQuiz();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, finishQuiz]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const qs = await getQuestions(topicId, undefined, questionCount);
      if (qs.length === 0) return;
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
      setCurrentIndex(0);
      setTimeLeft(timeLimit * 60);
      setStartTime(Date.now());
      setPhase('active');
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (answer: string) => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = answer;
      return updated;
    });
  };

  const finishQuiz = useCallback(async () => {
    setPhase('results');
    const correct = questions.reduce((count, q, i) => (
      answers[i] === q.correct_answer ? count + 1 : count
    ), 0);

    const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    if (user?.student_id) {
      try {
        await saveQuizAttempt({
          studentId: user.student_id,
          subjectId,
          topicId,
          quizType: 'topic_quiz',
          totalQuestions: questions.length,
          correctAnswers: correct,
          score,
          timeTakenSeconds: timeTaken,
        });
        await updateStudentProgress(
          user.student_id,
          topicId,
          score,
          score >= 50 ? 'completed' : 'in_progress'
        );
      } catch (err) {
        console.error('Failed to save quiz:', err);
      }
    }
  }, [questions, answers, startTime, user, subjectId, topicId]);

  const correctCount = questions.reduce((c, q, i) => (answers[i] === q.correct_answer ? c + 1 : c), 0);
  const scorePct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const askMarthaExplanation = async (q: Question, userAnswer: string | null) => {
    if (aiExplanations[q.id]) return;
    setLoadingExplanation(q.id);
    try {
      const response = await askStudentTutor({
        messages: [[
          'user',
          `I got this question wrong on a quiz about "${topicName}". Please explain the answer simply and help me understand.\n\nQuestion: ${q.question_text}\nMy answer: ${userAnswer || 'I skipped it'}\nCorrect answer: ${q.correct_answer}\n\nExplain step by step why the correct answer is right.`,
        ]],
        subject: subjectId,
        topic: topicName,
        classLevel: 'JSS2',
      });
      setAiExplanations((prev) => ({ ...prev, [q.id]: response }));
    } catch {
      setAiExplanations((prev) => ({ ...prev, [q.id]: 'Sorry, Martha couldn\'t explain right now. Please try again later.' }));
    } finally {
      setLoadingExplanation(null);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Setup phase
  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center py-12 px-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-6 shadow-lg">
          <Trophy size={36} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-text-primary mb-2">Topic Quiz</h3>
        <p className="text-text-secondary text-center max-w-md mb-8">
          Test your knowledge on <strong>{topicName}</strong>. This quiz is scored and timed.
        </p>

        <div className="w-full max-w-sm flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Questions</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                    questionCount === n
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Time Limit</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setTimeLimit(n)}
                  className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
                    timeLimit === n
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {n}min
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={startQuiz}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 rounded-[14px] bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Play size={18} />
          {loading ? 'Loading...' : 'Start Quiz'}
        </button>
      </div>
    );
  }

  // Active quiz
  if (phase === 'active') {
    const current = questions[currentIndex];
    const options: string[] = current?.options ? JSON.parse(current.options) : [];
    const answeredCount = answers.filter((a) => a !== null).length;

    return (
      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-text-secondary">
            Question {currentIndex + 1}/{questions.length}
          </span>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-text-secondary'
          }`}>
            <Clock size={14} />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-2 rounded-full shrink-0 transition-colors ${
                i === currentIndex
                  ? 'bg-primary'
                  : answers[i] !== null
                    ? 'bg-green-400'
                    : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <div className="bg-white rounded-[20px] shadow-card p-6 mb-4">
          <p className="text-lg font-semibold text-text-primary mb-6">{current.question_text}</p>
          <div className="flex flex-col gap-3">
            {options.map((option, i) => (
              <button
                key={i}
                onClick={() => selectAnswer(option)}
                className={`flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-[14px] border-2 transition-all ${
                  answers[currentIndex] === option
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-text-secondary shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-medium text-text-primary">{option}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2 rounded-[12px] text-sm font-medium text-text-secondary hover:bg-gray-100 disabled:opacity-40"
          >
            Previous
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(currentIndex + 1)}
              className="px-4 py-2 rounded-[12px] bg-primary text-white text-sm font-medium hover:bg-primary/90"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finishQuiz}
              className="px-6 py-2 rounded-[12px] bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              Submit Quiz ({answeredCount}/{questions.length} answered)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Results
  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-4 ${
          scorePct >= 80 ? 'bg-green-100' : scorePct >= 60 ? 'bg-amber-100' : 'bg-red-100'
        }`}>
          <span className="text-3xl font-bold">{scorePct}%</span>
        </div>
        <h3 className="text-xl font-bold text-text-primary">
          {scorePct >= 80 ? 'Excellent!' : scorePct >= 60 ? 'Good effort!' : 'Keep practicing!'}
        </h3>
        <p className="text-text-secondary mt-1">
          {correctCount}/{questions.length} correct
        </p>
      </div>

      {/* Review */}
      <div className="flex flex-col gap-3 mb-6">
        {questions.map((q, i) => {
          const isRight = answers[i] === q.correct_answer;
          return (
            <div key={q.id} className={`rounded-[16px] p-4 border ${isRight ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                {isRight ? <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" /> : <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{q.question_text}</p>
                  {!isRight && (
                    <p className="text-xs text-text-secondary mt-1">
                      Your answer: <span className="text-red-500">{answers[i] || 'Skipped'}</span> ·
                      Correct: <span className="text-green-600">{q.correct_answer}</span>
                    </p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-text-muted mt-1">{q.explanation}</p>
                  )}
                  {/* Ask Martha for AI explanation (wrong answers only) */}
                  {!isRight && (
                    <div className="mt-2">
                      {aiExplanations[q.id] ? (
                        <div className="bg-white rounded-[12px] p-3 border border-primary/20 mt-1">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Bot size={14} className="text-primary" />
                            <span className="text-xs font-semibold text-primary">Martha explains:</span>
                            <button
                              onClick={() => marthaTTS.speak(aiExplanations[q.id])}
                              className="ml-auto text-text-muted hover:text-primary"
                              title="Read aloud"
                            >
                              <Volume2 size={12} />
                            </button>
                          </div>
                          <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{aiExplanations[q.id]}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => askMarthaExplanation(q, answers[i])}
                          disabled={loadingExplanation === q.id}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50"
                        >
                          {loadingExplanation === q.id ? (
                            <><Loader2 size={12} className="animate-spin" /> Martha is thinking...</>
                          ) : (
                            <><Bot size={12} /> Ask Martha to explain</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => { setPhase('setup'); setAnswers([]); setCurrentIndex(0); }}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-[14px] bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
      >
        <RotateCcw size={18} />
        Take Another Quiz
      </button>
    </div>
  );
}
