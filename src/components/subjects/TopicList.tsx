import type { Topic } from '../../data/subjects/subjects';
import TopicItem from './TopicItem';

interface TopicListProps {
  topics: Topic[];
  subjectId: string;
}

export default function TopicList({ topics, subjectId }: TopicListProps) {
  return (
    <div className="flex flex-col gap-3">
      {topics.map((topic) => (
        <TopicItem key={topic.id} topic={topic} subjectId={subjectId} />
      ))}
      {topics.length === 0 && (
        <p className="text-center text-text-secondary py-8">
          No topics available for this subject.
        </p>
      )}
    </div>
  );
}
