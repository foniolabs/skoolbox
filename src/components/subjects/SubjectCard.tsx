import { useNavigate } from 'react-router-dom';
import { Calculator, BookOpen, FlaskConical, Wrench, GraduationCap, Atom, Globe, Landmark, Cpu, Leaf, Scale } from 'lucide-react';
import Card from '../shared/Card';
import ProgressBar from '../shared/ProgressBar';
import type { SubjectWithTopics } from './SubjectGrid';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  calculator: Calculator,
  'book-open': BookOpen,
  'flask-conical': FlaskConical,
  wrench: Wrench,
  atom: Atom,
  globe: Globe,
  landmark: Landmark,
  cpu: Cpu,
  leaf: Leaf,
  scale: Scale,
};

const iconBgMap: Record<string, string> = {
  calculator: 'bg-primary/10 text-primary',
  'book-open': 'bg-amber-100 text-amber-600',
  'flask-conical': 'bg-blue-100 text-blue-600',
  wrench: 'bg-purple-100 text-purple-600',
  atom: 'bg-indigo-100 text-indigo-600',
  globe: 'bg-teal-100 text-teal-600',
  landmark: 'bg-rose-100 text-rose-600',
  cpu: 'bg-cyan-100 text-cyan-600',
  leaf: 'bg-green-100 text-green-600',
  scale: 'bg-orange-100 text-orange-600',
};

interface SubjectCardProps {
  subject: SubjectWithTopics;
}

export default function SubjectCard({ subject }: SubjectCardProps) {
  const navigate = useNavigate();

  const progress = subject.topicCount > 0
    ? Math.round((subject.taughtCount / subject.topicCount) * 100)
    : 0;

  const IconComponent = iconMap[subject.icon] || GraduationCap;
  const iconClasses = iconBgMap[subject.icon] || 'bg-gray-100 text-gray-600';

  return (
    <Card
      hover
      onClick={() => navigate(`/prepare/${subject.id}`)}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClasses}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            {subject.name}
          </h3>
          <p className="text-sm text-text-secondary">
            {subject.topicCount} {subject.topicCount === 1 ? 'topic' : 'topics'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={progress} size="sm" />
        </div>
        <span className="text-sm font-medium text-text-secondary whitespace-nowrap">
          {progress}%
        </span>
      </div>

      <p className="text-xs text-text-secondary">
        {subject.taughtCount}/{subject.topicCount} taught
      </p>
    </Card>
  );
}
