import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, CircleDot, Lock } from 'lucide-react';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import ProgressBar from '../shared/ProgressBar';
import type { Topic } from '../../data/subjects/subjects';

interface TopicItemProps {
  topic: Topic;
  subjectId: string;
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    badge: 'Completed' as const,
    badgeVariant: 'success' as const,
    buttonLabel: 'Review',
    buttonVariant: 'outline' as const,
  },
  in_progress: {
    icon: CircleDot,
    iconColor: 'text-blue-500',
    badge: 'In Progress' as const,
    badgeVariant: 'info' as const,
    buttonLabel: 'Continue',
    buttonVariant: 'primary' as const,
  },
  not_started: {
    icon: Circle,
    iconColor: 'text-gray-400',
    badge: 'Not Started' as const,
    badgeVariant: 'neutral' as const,
    buttonLabel: 'Start',
    buttonVariant: 'primary' as const,
  },
  locked: {
    icon: Lock,
    iconColor: 'text-gray-300',
    badge: 'Locked' as const,
    badgeVariant: 'neutral' as const,
    buttonLabel: 'Locked',
    buttonVariant: 'ghost' as const,
  },
};

export default function TopicItem({ topic, subjectId }: TopicItemProps) {
  const navigate = useNavigate();
  const config = statusConfig[topic.status];
  const StatusIcon = config.icon;
  const isLocked = topic.status === 'locked';

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-gray-100 bg-white ${
        isLocked ? 'opacity-50' : ''
      }`}
    >
      <div className="flex-shrink-0">
        <StatusIcon className={`w-6 h-6 ${config.iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4
            className={`font-medium ${
              isLocked ? 'text-gray-400' : 'text-text-primary'
            }`}
          >
            {topic.name}
          </h4>
          <Badge variant={config.badgeVariant} size="sm">
            {config.badge}
          </Badge>
        </div>
        <p
          className={`text-sm ${
            isLocked ? 'text-gray-300' : 'text-text-secondary'
          }`}
        >
          {topic.description}
        </p>
        {topic.status === 'in_progress' && (
          <div className="mt-2 max-w-xs">
            <ProgressBar value={topic.progress} size="sm" />
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <Button
          variant={config.buttonVariant}
          size="sm"
          disabled={isLocked}
          onClick={() => {
            if (!isLocked) {
              navigate(`/subjects/${subjectId}/topics/${topic.id}`);
            }
          }}
        >
          {config.buttonLabel}
        </Button>
      </div>
    </div>
  );
}
