import { Clock, Calculator, FileText, FlaskConical, Wrench, GraduationCap } from 'lucide-react';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import { type QuizInfo } from '../../stores/useQuizStore';

interface QuizCardProps {
  quiz: QuizInfo;
  onStart: (quiz: QuizInfo) => void;
}

const subjectIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Mathematics: Calculator,
  English: FileText,
  'Basic Science': FlaskConical,
  'Basic Technology': Wrench,
};

const subjectIconBg: Record<string, string> = {
  Mathematics: 'bg-primary/10 text-primary',
  English: 'bg-amber-100 text-amber-600',
  'Basic Science': 'bg-blue-100 text-blue-600',
  'Basic Technology': 'bg-purple-100 text-purple-600',
};

const difficultyVariant: Record<string, 'success' | 'warning' | 'error'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
};

export default function QuizCard({ quiz, onStart }: QuizCardProps) {
  const IconComponent = subjectIcons[quiz.subject] || GraduationCap;
  const iconClasses = subjectIconBg[quiz.subject] || 'bg-gray-100 text-gray-600';

  return (
    <Card hover className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClasses}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <Badge variant={difficultyVariant[quiz.difficulty]} size="sm">
          {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
        </Badge>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-text-primary">{quiz.topic}</h3>
        <p className="text-sm text-text-secondary">{quiz.subject}</p>
      </div>

      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <span>{quiz.questionCount} questions</span>
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {quiz.duration} min
        </span>
      </div>

      <Button fullWidth onClick={() => onStart(quiz)}>
        Start Quiz
      </Button>
    </Card>
  );
}
