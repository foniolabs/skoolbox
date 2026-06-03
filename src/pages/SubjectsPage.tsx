import { BookOpen } from 'lucide-react';
import SubjectGrid from '../components/subjects/SubjectGrid';

export default function SubjectsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">Subjects</h1>
      </div>
      <SubjectGrid />
    </div>
  );
}
