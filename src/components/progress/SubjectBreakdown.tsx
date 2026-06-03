import Card from '../shared/Card';
import ProgressBar from '../shared/ProgressBar';
import { useProgressStore } from '../../stores/useProgressStore';

const subjectConfig: Record<string, { label: string; color: string }> = {
  mathematics: { label: 'Mathematics', color: 'bg-blue-500' },
  english: { label: 'English', color: 'bg-green-500' },
  'basic-science': { label: 'Basic Science', color: 'bg-purple-500' },
  'basic-technology': { label: 'Basic Technology', color: 'bg-orange-500' },
};

export default function SubjectBreakdown() {
  const { subjectProgress } = useProgressStore();

  return (
    <Card>
      <h3 className="text-lg font-semibold text-text-primary mb-6">
        Subject Breakdown
      </h3>
      <div className="space-y-5">
        {subjectProgress.map((subject) => {
          const config = subjectConfig[subject.subjectId] ?? {
            label: subject.subjectId,
            color: 'bg-gray-500',
          };
          const percentage = Math.round(
            (subject.topicsCompleted / subject.totalTopics) * 100
          );

          return (
            <div key={subject.subjectId}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">
                  {config.label}
                </span>
                <span className="text-sm font-medium text-text-secondary">
                  {percentage}%
                </span>
              </div>
              <ProgressBar value={percentage} color={config.color} size="md" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
