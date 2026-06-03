import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, ArrowLeft, Plus, GraduationCap, CheckCircle2, Loader2, BookMarked, Calendar } from 'lucide-react';
import Button from '../components/shared/Button';
import SubjectGrid from '../components/subjects/SubjectGrid';
import { getSubjects, getTopics, markTopicTaught, type Subject, type Topic } from '../lib/tauri/commands';

export default function PreparePage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [dbTopics, setDbTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    setLoadingTopics(true);

    // Load subject info and topics from backend
    Promise.all([
      getSubjects().then((subs) => {
        const found = subs.find((s) => s.id === subjectId);
        setSubjectInfo(found || null);
      }),
      getTopics(subjectId).then(setDbTopics),
    ])
      .catch((err) => console.error('Failed to load subject data:', err))
      .finally(() => setLoadingTopics(false));
  }, [subjectId]);

  const handleToggleTaught = async (topic: Topic) => {
    setTogglingId(topic.id);
    try {
      await markTopicTaught(topic.id, !topic.is_taught);
      setDbTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, is_taught: !t.is_taught, is_locked: topic.is_taught } : t))
      );
    } catch (err) {
      console.error('Failed to toggle taught status:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // If a subjectId is present, show the topic view for that subject
  if (subjectId) {
    const taughtCount = dbTopics.filter((t) => t.is_taught).length;

    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate('/prepare')}
        >
          <span className="flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Prepare
          </span>
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {subjectInfo?.name || 'Subject'}
            </h1>
            <p className="text-sm text-text-secondary">
              {dbTopics.length > 0
                ? `${taughtCount}/${dbTopics.length} topics taught`
                : 'Loading topics...'}
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-[14px] p-4 mb-6">
          <p className="text-sm text-blue-700">
            Mark topics as <strong>Taught</strong> to unlock them for your students.
            Students can only access topics you've marked as taught.
          </p>
        </div>

        {loadingTopics ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : dbTopics.length > 0 ? (
          <div className="flex flex-col gap-3">
            {dbTopics.map((topic, index) => (
              <div
                key={topic.id}
                className="flex items-center gap-4 p-4 rounded-[14px] border border-gray-100 bg-white hover:shadow-sm transition-shadow"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                  topic.is_taught
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {topic.is_taught
                    ? <CheckCircle2 size={20} />
                    : <span className="text-sm font-bold">{index + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-text-primary">{topic.name}</h4>
                  {topic.description && (
                    <p className="text-sm text-text-secondary mt-0.5 truncate">{topic.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    topic.is_taught
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {topic.is_taught ? 'Taught' : 'Not Taught'}
                  </span>

                  <button
                    onClick={() => handleToggleTaught(topic)}
                    disabled={togglingId === topic.id}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      topic.is_taught ? 'bg-green-500' : 'bg-gray-300'
                    } ${togglingId === topic.id ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        topic.is_taught ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-text-secondary py-12">
            No topics found for this subject.
          </p>
        )}
      </div>
    );
  }

  // Default: show the subject grid with the lesson planner card
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">
          Prepare Lessons
        </h1>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Curriculum Planner */}
        <div
          onClick={() => navigate('/curriculum')}
          className="bg-bg-card rounded-[20px] shadow-card p-6 flex items-center gap-4 cursor-pointer hover:shadow-lg transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookMarked className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors">
              Term Curriculum Planner
            </h2>
            <p className="text-sm text-text-secondary">
              Organise topics by week · AI-generate lesson notes · Track taught status
            </p>
          </div>
          <Calendar className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors" />
        </div>

        {/* AI Lesson Planner */}
        <div
          onClick={() => navigate('/prepare/lesson-planner')}
          className="bg-bg-card rounded-[20px] shadow-card p-6 flex items-center gap-4 cursor-pointer hover:shadow-lg transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text-primary group-hover:text-amber-600 transition-colors">
              AI Lesson Planner
            </h2>
            <p className="text-sm text-text-secondary">
              Generate a single lesson plan with AI for any topic
            </p>
          </div>
        </div>
      </div>

      <SubjectGrid />
    </div>
  );
}
