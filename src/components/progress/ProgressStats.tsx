import { BookOpen, FileQuestion, Target, Clock } from 'lucide-react';
import StatCard from '../shared/StatCard';
import { useProgressStore } from '../../stores/useProgressStore';

export default function ProgressStats() {
  const { subjectProgress, quizHistory } = useProgressStore();

  const topicsCovered = subjectProgress.reduce(
    (sum, sp) => sum + sp.topicsCompleted,
    0
  );

  const quizzesTaken = quizHistory.length;

  const avgScore =
    quizHistory.length > 0
      ? Math.round(
          quizHistory.reduce(
            (sum, q) => sum + (q.score / q.totalQuestions) * 100,
            0
          ) / quizHistory.length
        )
      : 0;

  const studyHours = Math.round(
    subjectProgress.reduce((sum, sp) => sum + sp.timeSpent, 0) / 60
  );

  const stats = [
    {
      icon: <BookOpen className="w-6 h-6" />,
      label: 'Topics Covered',
      value: topicsCovered,
      trend: 'up' as const,
      trendValue: '+3',
    },
    {
      icon: <FileQuestion className="w-6 h-6" />,
      label: 'Quizzes Taken',
      value: quizzesTaken,
      trend: 'up' as const,
      trendValue: '+5',
    },
    {
      icon: <Target className="w-6 h-6" />,
      label: 'Avg Score',
      value: `${avgScore}%`,
      trend: 'up' as const,
      trendValue: '+4%',
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Study Hours',
      value: `${studyHours}hrs`,
      trend: 'up' as const,
      trendValue: '+8hrs',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
