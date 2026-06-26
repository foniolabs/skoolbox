import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Save, Loader2, FileText, Target, Activity, Upload } from 'lucide-react';
import mammoth from 'mammoth';
import Button from '../shared/Button';
import { updatePlanTopic, type TermPlanTopic, type TermPlan } from '../../lib/tauri/commands';

interface TopicNotesModalProps {
  topic: TermPlanTopic;
  plan: TermPlan;
  onClose: () => void;
  onSaved: (updated: TermPlanTopic) => void;
  onGenerateAI: (topic: TermPlanTopic) => void;
  generating: boolean;
}

type TabKey = 'notes' | 'objectives' | 'activities';

export default function TopicNotesModal({
  topic,
  plan,
  onClose,
  onSaved,
  onGenerateAI,
  generating,
}: TopicNotesModalProps) {
  const [tab, setTab] = useState<TabKey>('notes');
  const [notes, setNotes] = useState(topic.lesson_notes || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedOk, setSavedOk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseArr = (val: string | null): string[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return [val]; }
  };

  const [objectives, setObjectives] = useState<string[]>(parseArr(topic.objectives));
  const [activities, setActivities] = useState<string[]>(parseArr(topic.activities));

  // Re-sync local edits when the topic prop changes — e.g. after "Generate with
  // AI" replaces the notes/objectives/activities while the modal stays open.
  useEffect(() => {
    setNotes(topic.lesson_notes || '');
    setObjectives(parseArr(topic.objectives));
    setActivities(parseArr(topic.activities));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, topic.lesson_notes, topic.objectives, topic.activities]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSavedOk(false);
    try {
      await updatePlanTopic({
        topicId: topic.id,
        lessonNotes: notes,
        objectives: JSON.stringify(objectives),
        activities: JSON.stringify(activities),
      });
      onSaved({
        ...topic,
        lesson_notes: notes,
        objectives: JSON.stringify(objectives),
        activities: JSON.stringify(activities),
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      console.error(err);
      setSaveError(typeof err === 'string' ? err : 'Could not save notes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let text = '';

      if (ext === 'txt' || ext === 'md') {
        text = await file.text();
      } else if (ext === 'docx') {
        // Use mammoth to extract plain text from .docx
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
        if (result.messages.length > 0) {
          console.warn('mammoth warnings:', result.messages);
        }
      } else if (ext === 'doc') {
        // .doc is old binary format — mammoth handles basic .doc too
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } catch {
          setUploadError('.doc format is not fully supported. Please save as .docx and try again.');
          return;
        }
      } else {
        setUploadError('Unsupported file type. Please use .docx, .doc, .txt, or .md.');
        return;
      }

      if (!text.trim()) {
        setUploadError('The file appears to be empty or could not be read.');
        return;
      }

      // Append to existing notes or replace if empty
      setNotes((prev) => prev.trim() ? `${prev}\n\n---\n\n${text.trim()}` : text.trim());
      setTab('notes');
    } catch {
      setUploadError('Failed to read file. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const tabs: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: 'notes', label: 'Lesson Notes', icon: FileText },
    { key: 'objectives', label: 'Objectives', icon: Target },
    { key: 'activities', label: 'Activities', icon: Activity },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">
              Week {topic.week_number} · {plan.subject_name} · {plan.class_level}
            </p>
            <h3 className="text-lg font-bold text-text-primary">{topic.topic_name}</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload notes from a .txt or .md file"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload Notes
            </button>

            {/* AI regenerate */}
            <button
              onClick={() => onGenerateAI(topic)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? 'Generating…' : 'Generate with AI'}
            </button>

            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="mx-5 mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
            {uploadError}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'notes' && (
            <div className="flex flex-col gap-2 h-full">
              {!notes && (
                <p className="text-xs text-text-muted mb-1">
                  Write notes, upload a file (.txt / .md), or generate with AI.
                </p>
              )}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type or paste lesson notes here…"
                rows={16}
                className="w-full text-sm text-text-primary border border-gray-200 rounded-[12px] p-4 focus:outline-none focus:border-primary resize-none leading-relaxed font-mono"
              />
            </div>
          )}

          {tab === 'objectives' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-muted mb-2">
                What students should be able to do by the end of the lesson.
              </p>
              {objectives.map((obj, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-2.5 text-xs font-bold text-primary w-5 shrink-0">{i + 1}.</span>
                  <input
                    value={obj}
                    onChange={(e) => setObjectives((prev) => prev.map((o, j) => j === i ? e.target.value : o))}
                    className="flex-1 text-sm border border-gray-200 rounded-[10px] px-3 py-2 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => setObjectives((prev) => prev.filter((_, j) => j !== i))}
                    className="mt-1 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setObjectives((prev) => [...prev, ''])}
                className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
              >
                + Add objective
              </button>
            </div>
          )}

          {tab === 'activities' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-text-muted mb-2">
                Introduction, teaching, practice, and wrap-up activities.
              </p>
              {activities.map((act, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-2.5 text-xs font-bold text-primary w-5 shrink-0">{i + 1}.</span>
                  <input
                    value={act}
                    onChange={(e) => setActivities((prev) => prev.map((a, j) => j === i ? e.target.value : a))}
                    className="flex-1 text-sm border border-gray-200 rounded-[10px] px-3 py-2 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => setActivities((prev) => prev.filter((_, j) => j !== i))}
                    className="mt-1 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setActivities((prev) => [...prev, ''])}
                className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
              >
                + Add activity
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100">
          {saveError ? (
            <p className="text-xs text-red-600">{saveError}</p>
          ) : savedOk ? (
            <p className="text-xs text-green-600">Saved ✓</p>
          ) : (
            <p className="text-xs text-text-muted">Supports .docx, .doc, .txt, .md</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
