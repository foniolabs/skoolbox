import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import SubjectCard from './SubjectCard';
import CustomDropdown from '../shared/CustomDropdown';
import { getSubjects, getTopics, type Subject } from '../../lib/tauri/commands';

const classLevelOptions = [
  { label: 'All Classes', value: 'All' },
  { label: 'Pry 5', value: 'Pry 5' },
  { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' },
  { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' },
  { label: 'SS2', value: 'SS2' },
  { label: 'SS3', value: 'SS3' },
];

export interface SubjectWithTopics {
  id: string;
  name: string;
  icon: string;
  topicCount: number;
  taughtCount: number;
}

export default function SubjectGrid() {
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [subjectsData, setSubjectsData] = useState<SubjectWithTopics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      setLoading(true);
      try {
        const classFilter = selectedLevel === 'All' ? undefined : selectedLevel;
        const subs = await getSubjects(classFilter);

        // Deduplicate by name and fetch topic counts
        const uniqueMap = new Map<string, Subject>();
        for (const s of subs) {
          if (!uniqueMap.has(s.name)) uniqueMap.set(s.name, s);
        }

        const withTopics: SubjectWithTopics[] = await Promise.all(
          Array.from(uniqueMap.values()).map(async (s) => {
            let topicCount = 0;
            let taughtCount = 0;
            try {
              const topics = await getTopics(s.id);
              topicCount = topics.length;
              taughtCount = topics.filter((t) => t.is_taught).length;
            } catch {
              // ignore
            }
            return {
              id: s.id,
              name: s.name,
              icon: s.icon || 'graduation-cap',
              topicCount,
              taughtCount,
            };
          })
        );

        setSubjectsData(withTopics.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
      setLoading(false);
    }
    loadSubjects();
  }, [selectedLevel]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium text-text-secondary">Filter by class:</span>
        <CustomDropdown
          options={classLevelOptions}
          value={selectedLevel}
          onChange={setSelectedLevel}
          className="w-40"
          size="sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subjectsData.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}

      {!loading && subjectsData.length === 0 && (
        <p className="text-center text-text-secondary py-12">
          No subjects found{selectedLevel !== 'All' ? ` for ${selectedLevel}` : ''}.
        </p>
      )}
    </div>
  );
}
