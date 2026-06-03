import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import Button from '../shared/Button';
import { subjects } from '../../data/subjects/subjects';

export default function LessonViewer() {
  const { subjectId, topicId } = useParams<{
    subjectId: string;
    topicId: string;
  }>();
  const navigate = useNavigate();

  const subject = subjects.find((s) => s.id === subjectId);
  const topicIndex = subject?.topics.findIndex((t) => t.id === topicId) ?? -1;
  const topic = subject?.topics[topicIndex];

  if (!subject || !topic) {
    return (
      <div className="p-8 text-center">
        <p className="text-text-secondary">Topic not found.</p>
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

  const prevTopic = topicIndex > 0 ? subject.topics[topicIndex - 1] : null;
  const nextTopic =
    topicIndex < subject.topics.length - 1
      ? subject.topics[topicIndex + 1]
      : null;

  return (
    <div className="max-w-3xl mx-auto p-6 relative">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary mb-6">
        <Link
          to="/subjects"
          className="hover:text-primary transition-colors"
        >
          Subjects
        </Link>
        <span>/</span>
        <Link
          to={`/subjects/${subject.id}`}
          className="hover:text-primary transition-colors"
        >
          {subject.icon} {subject.name}
        </Link>
        <span>/</span>
        <span className="text-text-primary font-medium">{topic.name}</span>
      </nav>

      {/* Title */}
      <h1 className="text-2xl font-bold text-text-primary mb-6">
        {topic.name}
      </h1>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm p-8 mb-8 min-h-[300px]">
        <p className="text-text-secondary mb-4">{topic.description}</p>
        <div className="border-t border-gray-100 pt-6 mt-6">
          <p className="text-text-secondary italic">
            Lesson content for "{topic.name}" will appear here. This is a
            placeholder for the full lesson material including text, images,
            and interactive elements.
          </p>
        </div>
      </div>

      {/* Mark as Complete */}
      <div className="flex justify-center mb-8">
        <Button variant="primary" size="lg">
          Mark as Complete
        </Button>
      </div>

      {/* Previous / Next Navigation */}
      <div className="flex justify-between items-center">
        {prevTopic ? (
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/subjects/${subject.id}/topics/${prevTopic.id}`)
            }
          >
            <span className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              {prevTopic.name}
            </span>
          </Button>
        ) : (
          <div />
        )}

        {nextTopic && nextTopic.status !== 'locked' ? (
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/subjects/${subject.id}/topics/${nextTopic.id}`)
            }
          >
            <span className="flex items-center gap-1">
              {nextTopic.name}
              <ChevronRight className="w-4 h-4" />
            </span>
          </Button>
        ) : (
          <div />
        )}
      </div>

      {/* Ask AI Tutor Floating Button */}
      <Link
        to="/ai-tutor"
        className="fixed bottom-6 right-6 bg-primary text-white rounded-full p-4 shadow-lg hover:bg-primary-dark transition-all duration-200 hover:scale-105"
        title="Ask AI Tutor"
      >
        <MessageCircle className="w-6 h-6" />
      </Link>
    </div>
  );
}
