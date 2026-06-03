import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../components/shared/Button';
import TopicList from '../components/subjects/TopicList';
import { subjects } from '../data/subjects/subjects';

export default function TopicPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();

  const subject = subjects.find((s) => s.id === subjectId);

  if (!subject) {
    return (
      <div className="p-8 text-center">
        <p className="text-text-secondary">Subject not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/subjects')}
        >
          Back to Subjects
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate('/subjects')}
      >
        <span className="flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Subjects
        </span>
      </Button>

      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">{subject.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {subject.name}
          </h1>
          <p className="text-sm text-text-secondary">
            {subject.topics.length} topics
          </p>
        </div>
      </div>

      <TopicList topics={subject.topics} subjectId={subject.id} />
    </div>
  );
}
