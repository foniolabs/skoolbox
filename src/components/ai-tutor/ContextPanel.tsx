import { useState } from 'react';
import { Volume2, Sparkles, BookOpen, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../shared/Button';
import CustomDropdown from '../shared/CustomDropdown';

interface ContextPanelProps {
  onTopicSelect: (topic: string) => void;
  currentSubject: string | null;
  onSubjectChange: (subject: string) => void;
  onLevelChange: (level: string) => void;
}

const quickTopics = [
  'Algebra',
  'Grammar',
  'Fractions',
  'Essay Writing',
  'Photosynthesis',
];

const subjectOptions = [
  { label: 'Select a subject', value: '' },
  { label: 'Mathematics', value: 'Mathematics' },
  { label: 'English', value: 'English' },
  { label: 'Science', value: 'Science' },
  { label: 'Social Studies', value: 'Social Studies' },
  { label: 'Art', value: 'Art' },
];

const classLevelOptions = [
  { label: 'Select level', value: '' },
  { label: 'Pry 5', value: 'Pry 5' },
  { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' },
  { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' },
  { label: 'SS2', value: 'SS2' },
  { label: 'SS3', value: 'SS3' },
];

export default function ContextPanel({
  onTopicSelect,
  currentSubject,
  onSubjectChange,
  onLevelChange,
}: ContextPanelProps) {
  const [readAloud, setReadAloud] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col overflow-y-auto">
      {/* Quick Topics */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Quick Topics
        </h3>
        <div className="flex flex-wrap gap-2">
          {quickTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => onTopicSelect(topic)}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-bg-secondary text-text-secondary
                hover:bg-primary hover:text-white transition-colors duration-200
                flex items-center gap-1"
            >
              {topic}
              <ChevronRight className="w-3 h-3" />
            </button>
          ))}
        </div>
      </div>

      {/* Subject Selector */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Subject
        </h3>
        <CustomDropdown
          options={subjectOptions}
          value={currentSubject || ''}
          onChange={onSubjectChange}
          placeholder="Select a subject"
        />
      </div>

      {/* Class Level */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Class Level</h3>
        <CustomDropdown
          options={classLevelOptions}
          value=""
          onChange={onLevelChange}
          placeholder="Select level"
        />
      </div>

      {/* Actions */}
      <div className="p-5 flex flex-col gap-3">
        <button
          onClick={() => setReadAloud(!readAloud)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
            readAloud
              ? 'bg-primary text-white'
              : 'bg-bg-secondary text-text-secondary hover:bg-gray-200'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          Read Aloud {readAloud ? 'On' : 'Off'}
        </button>

        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() => navigate('/quizzes')}
          className="flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Quiz
        </Button>
      </div>
    </div>
  );
}
