import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, BookOpen, Brain, ClipboardCheck, Video, Loader2 } from 'lucide-react';
import { getSubjects, getTopics, getStudent } from '../../lib/tauri/commands';
import { useAuthStore } from '../../stores/useAuthStore';
import type { Subject, Topic } from '../../lib/tauri/commands';
import LearnTab from '../../components/topic-learning/LearnTab';
import PracticeTab from '../../components/topic-learning/PracticeTab';
import QuizTab from '../../components/topic-learning/QuizTab';
import VideosTab from '../../components/topic-learning/VideosTab';

type Tab = 'learn' | 'practice' | 'quiz' | 'videos';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'learn', label: 'Martha', icon: Brain },
  { key: 'practice', label: 'Practice', icon: BookOpen },
  { key: 'quiz', label: 'Quiz', icon: ClipboardCheck },
  { key: 'videos', label: 'Videos', icon: Video },
];

export default function TopicLearningPage() {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [classLevel, setClassLevel] = useState('Pry 5');
  const [activeTab, setActiveTab] = useState<Tab>('learn');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Get class level
        if (user?.student_id) {
          try {
            const s = await getStudent(user.student_id);
            setClassLevel(s.class_level);
          } catch {}
        }

        // Get subject
        const allSubs = await getSubjects();
        const sub = allSubs.find((s) => s.id === subjectId);
        setSubject(sub || null);

        // Get topic
        if (subjectId) {
          const allTopics = await getTopics(subjectId);
          const t = allTopics.find((t) => t.id === topicId);
          setTopic(t || null);
        }
      } catch (err) {
        console.error('Failed to load topic data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subjectId, topicId, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!subject || !topic) {
    return (
      <div className="p-6 text-center">
        <p className="text-text-secondary">Topic not found.</p>
        <button onClick={() => navigate('/student/subjects')} className="text-primary mt-2 hover:underline">
          Back to subjects
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] mt-4 px-4">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 pt-6 pb-4 rounded-t-[20px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-text-muted mb-2">
          <button onClick={() => navigate('/student/subjects')} className="hover:text-primary transition-colors">
            My Subjects
          </button>
          <ChevronRight size={14} />
          <button
            onClick={() => navigate('/student/subjects', { state: { expandSubject: subjectId } })}
            className="hover:text-primary transition-colors"
          >
            {subject.name}
          </button>
          <ChevronRight size={14} />
          <span className="text-text-primary font-medium">{topic.name}</span>
        </div>

        <h1 className="text-xl font-bold text-text-primary">{topic.name}</h1>
        {topic.description && (
          <p className="text-sm text-text-secondary mt-0.5">{topic.description}</p>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 mt-4 bg-gray-100 rounded-[14px] p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 bg-bg-app">
        {activeTab === 'learn' && (
          <LearnTab subject={subject.name} topic={topic.name} topicId={topic.id} classLevel={classLevel} />
        )}
        {activeTab === 'practice' && (
          <PracticeTab topicId={topic.id} topicName={topic.name} />
        )}
        {activeTab === 'quiz' && (
          <QuizTab topicId={topic.id} topicName={topic.name} subjectId={subject.id} />
        )}
        {activeTab === 'videos' && (
          <VideosTab subject={subject.name} topic={topic.name} classLevel={classLevel} />
        )}
      </div>
    </div>
  );
}
