import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookMarked, Plus, ChevronRight, Trash2, Loader2,
  GraduationCap, Calendar, ArrowLeft,
} from 'lucide-react';
import Button from '../components/shared/Button';
import CustomDropdown from '../components/shared/CustomDropdown';
import {
  getSubjects, getTermPlans, createTermPlan, deleteTermPlan,
  type Subject, type TermPlan,
} from '../lib/tauri/commands';

const termOptions = [
  { label: 'Term 1 (Sept–Dec)', value: '1' },
  { label: 'Term 2 (Jan–Apr)', value: '2' },
  { label: 'Term 3 (May–Jul)', value: '3' },
];

const classOptions = [
  { label: 'Pry 5', value: 'Pry 5' }, { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' }, { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' }, { label: 'SS2', value: 'SS2' }, { label: 'SS3', value: 'SS3' },
];

const yearOptions = ['2024/2025', '2025/2026', '2026/2027'].map((y) => ({ label: y, value: y }));

export default function CurriculumPlannerPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<TermPlan[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New plan form state
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newClass, setNewClass] = useState('JSS1');
  const [newTerm, setNewTerm] = useState('1');
  const [newYear, setNewYear] = useState('2024/2025');

  useEffect(() => {
    Promise.all([getSubjects(), getTermPlans()]).then(([subs, ps]) => {
      // Deduplicate subjects by name
      const seen = new Set<string>();
      const unique = subs.filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });
      setSubjects(unique);
      setPlans(ps);
      if (unique.length > 0) setNewSubjectId(unique[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const subjectOptions = subjects.map((s) => ({ label: s.name, value: s.id }));

  const handleCreate = async () => {
    const subject = subjects.find((s) => s.id === newSubjectId);
    if (!subject) return;
    setCreating(true);
    try {
      const plan = await createTermPlan({
        subjectId: newSubjectId,
        subjectName: subject.name,
        classLevel: newClass,
        term: parseInt(newTerm),
        academicYear: newYear,
      });
      setPlans((prev) => [plan, ...prev]);
      setShowCreate(false);
      navigate(`/curriculum/${plan.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this term plan and all its topics?')) return;
    setDeletingId(planId);
    try {
      await deleteTermPlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const termLabel = (t: number) => `Term ${t}`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookMarked className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Curriculum Planner</h1>
            <p className="text-sm text-text-secondary">Organise your term topics with AI-assisted lesson notes</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={16} />
          New Term Plan
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-[20px] shadow-card p-6 mb-6 border border-primary/20">
          <h3 className="text-base font-semibold text-text-primary mb-4">Create New Term Plan</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-text-secondary mb-1 block">Subject</label>
              <CustomDropdown options={subjectOptions} value={newSubjectId} onChange={setNewSubjectId} />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1 block">Class</label>
              <CustomDropdown options={classOptions} value={newClass} onChange={setNewClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1 block">Term</label>
              <CustomDropdown options={termOptions} value={newTerm} onChange={setNewTerm} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-text-secondary mb-1 block">Academic Year</label>
              <CustomDropdown options={yearOptions} value={newYear} onChange={setNewYear} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={creating || !newSubjectId}>
              {creating ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Create Plan
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Plans list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-24">
          <BookMarked size={48} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">No term plans yet</h3>
          <p className="text-text-secondary">
            Click <strong>New Term Plan</strong> above to organise your topics and generate AI lesson notes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => navigate(`/curriculum/${plan.id}`)}
              className="flex items-center justify-between p-5 bg-white rounded-[16px] border border-gray-100 hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap size={22} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {plan.title || `${plan.subject_name} — ${termLabel(plan.term)}`}
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm text-text-secondary">{plan.class_level}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-text-secondary flex items-center gap-1">
                      <Calendar size={12} />
                      {plan.academic_year}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-text-secondary">
                      {plan.topic_count} {plan.topic_count === 1 ? 'topic' : 'topics'}
                    </span>
                    {plan.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(plan.id, e)}
                  disabled={deletingId === plan.id}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {deletingId === plan.id
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Trash2 size={16} />}
                </button>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
