import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import CustomDropdown from '../shared/CustomDropdown';
import { getSubjects, getTopics } from '../../lib/tauri/commands';

interface QuizGeneratorProps {
  onGenerate: (config: {
    subject: string;
    topics: string[];
    topicMode: 'single' | 'custom' | 'mixed' | 'all';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  }) => void;
}

const difficultyOptions = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

const topicModeOptions = [
  { label: 'Single Topic', value: 'single' },
  { label: 'Custom (Pick Topics)', value: 'custom' },
  { label: 'Mixed (Random)', value: 'mixed' },
  { label: 'All Topics', value: 'all' },
];

const questionPresets = [5, 10, 20, 30, 50, 100, 150, 200, 250, 300, 350, 400];

export default function QuizGenerator({ onGenerate }: QuizGeneratorProps) {
  const [subjectOptions, setSubjectOptions] = useState<{ label: string; value: string }[]>([]);
  const [subjectIdMap, setSubjectIdMap] = useState<Record<string, string>>({});
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const [subject, setSubject] = useState('');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [topicMode, setTopicMode] = useState<'single' | 'custom' | 'mixed' | 'all'>('single');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(10);

  // Load subjects from backend on mount
  useEffect(() => {
    getSubjects()
      .then((subs) => {
        const seen = new Set<string>();
        const opts: { label: string; value: string }[] = [];
        const idMap: Record<string, string> = {};
        for (const s of subs) {
          if (!seen.has(s.name)) {
            seen.add(s.name);
            opts.push({ label: s.name, value: s.name });
            idMap[s.name] = s.id;
          }
        }
        setSubjectOptions(opts);
        setSubjectIdMap(idMap);
        if (opts.length > 0) setSubject(opts[0].value);
      })
      .catch(() => {
        const fallback = [
          'Mathematics', 'English', 'Basic Science', 'Basic Technology',
          'Social Studies', 'Biology', 'Chemistry', 'Physics',
        ];
        setSubjectOptions(fallback.map((s) => ({ label: s, value: s })));
        if (fallback.length > 0) setSubject(fallback[0]);
      })
      .finally(() => setLoadingSubjects(false));
  }, []);

  // Load topics from backend when subject changes
  useEffect(() => {
    if (!subject) return;
    const subjectId = subjectIdMap[subject];
    if (!subjectId) return;

    setLoadingTopics(true);
    setAvailableTopics([]);
    setSelectedTopic('');
    setSelectedTopics([]);

    getTopics(subjectId)
      .then((topics) => {
        const names = topics.map((t) => t.name);
        setAvailableTopics(names);
        if (names.length > 0) setSelectedTopic(names[0]);
      })
      .catch(() => setAvailableTopics([]))
      .finally(() => setLoadingTopics(false));
  }, [subject, subjectIdMap]);

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setTopicMode('single');
    setSelectedTopics([]);
  };

  const handleTopicModeChange = (mode: string) => {
    setTopicMode(mode as 'single' | 'custom' | 'mixed' | 'all');
    setSelectedTopics([]);
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const resolvedTopics = useMemo(() => {
    switch (topicMode) {
      case 'single':
        return selectedTopic ? [selectedTopic] : [];
      case 'custom':
        return selectedTopics;
      case 'mixed':
      case 'all':
        return availableTopics;
      default:
        return selectedTopic ? [selectedTopic] : [];
    }
  }, [topicMode, selectedTopic, selectedTopics, availableTopics]);

  const canGenerate =
    resolvedTopics.length > 0 && questionCount >= 5 && questionCount <= 400 && !loadingTopics;

  const handleGenerate = () => {
    if (!canGenerate) return;
    onGenerate({ subject, topics: resolvedTopics, topicMode, difficulty, questionCount });
  };

  const topicOptions = availableTopics.map((t) => ({ label: t, value: t }));

  const sliderToPreset = (val: number) => {
    const index = Math.round((val / 100) * (questionPresets.length - 1));
    return questionPresets[Math.max(0, Math.min(index, questionPresets.length - 1))];
  };

  const presetToSlider = (preset: number) => {
    const index = questionPresets.indexOf(preset);
    if (index === -1) return 0;
    return (index / (questionPresets.length - 1)) * 100;
  };

  if (loadingSubjects) {
    return (
      <Card className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-text-primary">Generate Custom Quiz</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Subject</label>
          <CustomDropdown
            options={subjectOptions}
            value={subject}
            onChange={handleSubjectChange}
          />
        </div>

        {/* Topic Mode */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Topic Selection</label>
          <CustomDropdown
            options={topicModeOptions}
            value={topicMode}
            onChange={handleTopicModeChange}
          />
        </div>

        {/* Topics loading */}
        {loadingTopics && (
          <div className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
            <Loader2 size={14} className="animate-spin" />
            Loading topics...
          </div>
        )}

        {/* Single Topic Dropdown */}
        {!loadingTopics && topicMode === 'single' && topicOptions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Topic</label>
            <CustomDropdown
              options={topicOptions}
              value={selectedTopic}
              onChange={setSelectedTopic}
            />
          </div>
        )}

        {/* Custom Topic Picker */}
        {!loadingTopics && topicMode === 'custom' && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-text-secondary">
              Select Topics ({selectedTopics.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm font-medium transition-all border ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-text-secondary border-gray-200 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {isSelected && <Check size={14} />}
                    {topic}
                  </button>
                );
              })}
            </div>
            {selectedTopics.length === 0 && (
              <p className="text-xs text-amber-600">Pick at least one topic</p>
            )}
          </div>
        )}

        {/* Mixed/All info */}
        {!loadingTopics && (topicMode === 'mixed' || topicMode === 'all') && availableTopics.length > 0 && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-text-secondary">Topics Included</label>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map((topic) => (
                <span
                  key={topic}
                  className="px-3 py-1.5 rounded-[12px] text-sm bg-green-50 text-primary border border-green-200"
                >
                  {topic}
                </span>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              {topicMode === 'mixed'
                ? 'Questions will be randomly mixed from all topics above'
                : 'Questions will cover all topics above equally'}
            </p>
          </div>
        )}

        {/* No topics warning */}
        {!loadingTopics && availableTopics.length === 0 && subject && (
          <p className="text-xs text-amber-600 sm:col-span-2">
            No topics found for {subject}. The teacher may not have added topics yet.
          </p>
        )}

        {/* Difficulty */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Difficulty</label>
          <CustomDropdown
            options={difficultyOptions}
            value={difficulty}
            onChange={(v) => setDifficulty(v as 'easy' | 'medium' | 'hard')}
          />
        </div>

        {/* Number of Questions */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Number of Questions: <span className="text-primary font-bold">{questionCount}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={presetToSlider(questionCount)}
            onChange={(e) => setQuestionCount(sliderToPreset(Number(e.target.value)))}
            className="w-full accent-primary mt-2"
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>5</span>
            <span>50</span>
            <span>100</span>
            <span>200</span>
            <span>400</span>
          </div>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`flex items-center justify-center gap-2 ${!canGenerate ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Sparkles size={16} />
        Generate Quiz
        {resolvedTopics.length > 1 && (
          <span className="text-xs opacity-80">
            ({resolvedTopics.length} topics · {questionCount} questions)
          </span>
        )}
      </Button>
    </Card>
  );
}
