import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Sparkles, Loader2, CheckCircle2, Circle,
  FileText, Trash2, Wand2, BookOpen, ChevronDown, ChevronUp, Edit2, Check, X,
} from 'lucide-react';
import Button from '../components/shared/Button';
import {
  getTermPlans, getPlanTopics, addPlanTopic, deletePlanTopic,
  markPlanTopicTaught, generatePlanTopicAi, suggestTermTopics,
  updatePlanTopic,
  type TermPlan, type TermPlanTopic,
} from '../lib/tauri/commands';
import TopicNotesModal from '../components/curriculum/TopicNotesModal';

export default function TermPlanViewPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<TermPlan | null>(null);
  const [topics, setTopics] = useState<TermPlanTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [suggestingTopics, setSuggestingTopics] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesModalTopic, setNotesModalTopic] = useState<TermPlanTopic | null>(null);
  const [addingTopic, setAddingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (!planId) return;
    Promise.all([
      getTermPlans().then((ps) => ps.find((p) => p.id === planId) || null),
      getPlanTopics(planId),
    ]).then(([p, ts]) => {
      setPlan(p);
      setTopics(ts);
    }).finally(() => setLoading(false));
  }, [planId]);

  const nextWeek = topics.length > 0 ? Math.max(...topics.map((t) => t.week_number)) + 1 : 1;

  const handleAddTopic = async () => {
    if (!planId || !newTopicName.trim()) return;
    try {
      const t = await addPlanTopic({ planId, weekNumber: nextWeek, topicName: newTopicName.trim() });
      setTopics((prev) => [...prev, t]);
      setNewTopicName('');
      setAddingTopic(false);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (topicId: string) => {
    await deletePlanTopic(topicId);
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
  };

  const handleToggleTaught = async (topic: TermPlanTopic) => {
    await markPlanTopicTaught(topic.id, !topic.is_taught);
    setTopics((prev) =>
      prev.map((t) => t.id === topic.id ? { ...t, is_taught: !t.is_taught } : t)
    );
  };

  const handleGenerateAI = async (topic: TermPlanTopic) => {
    if (!plan) return;
    setGeneratingTopicId(topic.id);
    try {
      const updated = await generatePlanTopicAi({
        planTopicId: topic.id,
        topicName: topic.topic_name,
        subject: plan.subject_name,
        classLevel: plan.class_level,
        durationMinutes: topic.duration_minutes,
      });
      setTopics((prev) => prev.map((t) => t.id === topic.id ? updated : t));
      setExpandedId(topic.id);
      // If the notes modal is open for this topic, push the new content into it
      // so the textarea shows the AI result (and Save writes it, not stale data).
      setNotesModalTopic((prev) => (prev && prev.id === topic.id ? updated : prev));
    } catch (err) { console.error(err); }
    finally { setGeneratingTopicId(null); }
  };

  const handleGenerateAll = async () => {
    if (!plan) return;
    setGeneratingAll(true);
    for (const topic of topics) {
      if (!topic.lesson_notes) {
        setGeneratingTopicId(topic.id);
        try {
          const updated = await generatePlanTopicAi({
            planTopicId: topic.id,
            topicName: topic.topic_name,
            subject: plan.subject_name,
            classLevel: plan.class_level,
            durationMinutes: topic.duration_minutes,
          });
          setTopics((prev) => prev.map((t) => t.id === topic.id ? updated : t));
        } catch { /* continue */ }
        setGeneratingTopicId(null);
      }
    }
    setGeneratingAll(false);
  };

  const handleSuggestTopics = async () => {
    if (!plan) return;
    setSuggestingTopics(true);
    try {
      const suggestions = await suggestTermTopics({
        subject: plan.subject_name,
        classLevel: plan.class_level,
        term: plan.term,
        numWeeks: 10,
      });
      // Add suggested topics that don't exist yet
      const existingNames = new Set(topics.map((t) => t.topic_name.toLowerCase()));
      let week = nextWeek;
      const newTopics: TermPlanTopic[] = [];
      for (const name of suggestions) {
        if (!existingNames.has(name.toLowerCase()) && planId) {
          try {
            const t = await addPlanTopic({ planId, weekNumber: week++, topicName: name });
            newTopics.push(t);
          } catch { /* continue */ }
        }
      }
      setTopics((prev) => [...prev, ...newTopics]);
    } catch (err) { console.error(err); }
    finally { setSuggestingTopics(false); }
  };

  const handleSaveName = async (topicId: string) => {
    if (!editingName.trim()) return;
    await updatePlanTopic({ topicId, topicName: editingName.trim() });
    setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, topic_name: editingName.trim() } : t));
    setEditingId(null);
  };

  const taughtCount = topics.filter((t) => t.is_taught).length;
  const notesCount = topics.filter((t) => t.lesson_notes).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return <p className="p-8 text-text-secondary">Plan not found.</p>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <button
        onClick={() => navigate('/curriculum')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mb-5 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Plans
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{plan.title}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {plan.class_level} · {plan.academic_year} ·{' '}
            <span className="text-green-600 font-medium">{taughtCount}/{topics.length} taught</span>
            {' · '}
            <span className="text-primary font-medium">{notesCount}/{topics.length} have notes</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSuggestTopics}
            disabled={suggestingTopics}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {suggestingTopics ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            AI Suggest Topics
          </button>
          <button
            onClick={handleGenerateAll}
            disabled={generatingAll || topics.every((t) => !!t.lesson_notes)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate All Notes
          </button>
        </div>
      </div>

      {/* Topics list */}
      <div className="flex flex-col gap-3 mb-4">
        {topics.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-[16px]">
            <BookOpen size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-text-secondary mb-4">No topics yet. Add topics manually or let AI suggest them.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setAddingTopic(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                <Plus size={14} /> Add Manually
              </button>
              <button
                onClick={handleSuggestTopics}
                disabled={suggestingTopics}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {suggestingTopics ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                AI Suggest 10 Topics
              </button>
            </div>
          </div>
        ) : (
          topics.map((topic) => (
            <div
              key={topic.id}
              className={`bg-white rounded-[14px] border transition-all ${
                topic.is_taught ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              {/* Row */}
              <div className="flex items-center gap-3 p-4">
                {/* Week badge */}
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">W{topic.week_number}</span>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {editingId === topic.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(topic.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 text-sm border border-primary rounded-lg px-3 py-1.5 focus:outline-none"
                      />
                      <button onClick={() => handleSaveName(topic.id)} className="p-1.5 rounded-lg bg-primary text-white"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg border border-gray-200"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${topic.is_taught ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                        {topic.topic_name}
                      </span>
                      <button
                        onClick={() => { setEditingId(topic.id); setEditingName(topic.topic_name); }}
                        className="p-1 rounded text-gray-300 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 size={12} />
                      </button>
                      {topic.is_ai_generated && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-600">AI</span>
                      )}
                      {topic.lesson_notes && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 flex items-center gap-0.5">
                          <FileText size={10} /> Notes
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-text-muted mt-0.5">{topic.duration_minutes} min lesson</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Taught toggle */}
                  <button
                    onClick={() => handleToggleTaught(topic)}
                    className={`p-2 rounded-lg transition-colors ${
                      topic.is_taught
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={topic.is_taught ? 'Mark as not taught' : 'Mark as taught'}
                  >
                    {topic.is_taught ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </button>

                  {/* Generate AI notes */}
                  <button
                    onClick={() => handleGenerateAI(topic)}
                    disabled={generatingTopicId === topic.id}
                    className="p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
                    title="Generate lesson notes with AI"
                  >
                    {generatingTopicId === topic.id
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Sparkles size={16} />}
                  </button>

                  {/* View/edit notes */}
                  <button
                    onClick={() => setNotesModalTopic(topic)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="View / edit lesson notes"
                  >
                    <FileText size={16} />
                  </button>

                  {/* Expand preview */}
                  {topic.lesson_notes && (
                    <button
                      onClick={() => setExpandedId(expandedId === topic.id ? null : topic.id)}
                      className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
                    >
                      {expandedId === topic.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(topic.id)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expanded notes preview */}
              {expandedId === topic.id && topic.lesson_notes && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                  <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed line-clamp-6">
                    {topic.lesson_notes.slice(0, 600)}{topic.lesson_notes.length > 600 ? '…' : ''}
                  </div>
                  <button
                    onClick={() => setNotesModalTopic(topic)}
                    className="text-xs text-primary mt-2 hover:underline"
                  >
                    Open full notes →
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add topic inline */}
      {addingTopic ? (
        <div className="flex gap-2 items-center p-3 bg-white rounded-[14px] border border-primary/30">
          <span className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
            W{nextWeek}
          </span>
          <input
            autoFocus
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); if (e.key === 'Escape') { setAddingTopic(false); setNewTopicName(''); } }}
            placeholder="Topic name…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
          />
          <Button size="sm" onClick={handleAddTopic} disabled={!newTopicName.trim()}>Add</Button>
          <Button size="sm" variant="outline" onClick={() => { setAddingTopic(false); setNewTopicName(''); }}>Cancel</Button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTopic(true)}
          className="flex items-center gap-2 w-full p-3 rounded-[14px] border border-dashed border-gray-200 text-text-muted hover:border-primary hover:text-primary transition-colors text-sm"
        >
          <Plus size={16} /> Add topic (Week {nextWeek})
        </button>
      )}

      {/* Notes modal */}
      {notesModalTopic && (
        <TopicNotesModal
          topic={notesModalTopic}
          plan={plan}
          onClose={() => setNotesModalTopic(null)}
          onSaved={(updated) => {
            setTopics((prev) => prev.map((t) => t.id === updated.id ? updated : t));
            setNotesModalTopic(updated);
          }}
          onGenerateAI={handleGenerateAI}
          generating={generatingTopicId === notesModalTopic.id}
        />
      )}
    </div>
  );
}
