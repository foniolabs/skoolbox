import { useState, useEffect } from 'react';
import { TrendingUp, Award, Target, BookOpen, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getStudentProgress, getSubjects } from '../../lib/tauri/commands';
import type { StudentProgress, Subject } from '../../lib/tauri/commands';

export default function StudentProgressPage() {
  const user = useAuthStore((s) => s.user);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const subs = await getSubjects();
        setSubjects(subs);
        if (user?.student_id) {
          const prog = await getStudentProgress(user.student_id);
          setProgress(prog);
        }
      } catch (err) {
        console.error('Failed to load progress:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const masteredCount = progress.filter((p) => p.mastery_level === 'mastered').length;
  const workingCount = progress.filter((p) => p.mastery_level === 'working_towards').length;
  const needsAttCount = progress.filter((p) => p.mastery_level === 'needs_attention').length;
  const totalTopics = progress.length || 1;
  const avgScore = progress.length > 0
    ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / progress.length)
    : 0;

  // Group progress by subject
  const subjectNames = new Map(subjects.map((s) => [s.id, s.name]));

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-text-secondary">Loading progress...</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">My Progress</h1>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-[20px] shadow-card p-5 text-center">
          <div className="flex justify-center mb-2">
            <Target size={24} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-text-primary">{avgScore}%</p>
          <p className="text-sm text-text-secondary">Average Score</p>
        </div>

        <div className="bg-white rounded-[20px] shadow-card p-5 text-center">
          <div className="flex justify-center mb-2">
            <Award size={24} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{masteredCount}</p>
          <p className="text-sm text-text-secondary">Mastered</p>
        </div>

        <div className="bg-white rounded-[20px] shadow-card p-5 text-center">
          <div className="flex justify-center mb-2">
            <BarChart3 size={24} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{workingCount}</p>
          <p className="text-sm text-text-secondary">In Progress</p>
        </div>

        <div className="bg-white rounded-[20px] shadow-card p-5 text-center">
          <div className="flex justify-center mb-2">
            <BookOpen size={24} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{needsAttCount}</p>
          <p className="text-sm text-text-secondary">Needs Work</p>
        </div>
      </div>

      {/* Mastery Breakdown Bar */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Mastery Overview</h2>
        <div className="w-full h-6 rounded-full bg-gray-100 overflow-hidden flex">
          {masteredCount > 0 && (
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(masteredCount / totalTopics) * 100}%` }}
            />
          )}
          {workingCount > 0 && (
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${(workingCount / totalTopics) * 100}%` }}
            />
          )}
          {needsAttCount > 0 && (
            <div
              className="h-full bg-red-400 transition-all"
              style={{ width: `${(needsAttCount / totalTopics) * 100}%` }}
            />
          )}
        </div>
        <div className="flex gap-6 mt-3 text-sm">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" /> Mastered ({masteredCount})
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-400" /> Working Towards ({workingCount})
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" /> Needs Attention ({needsAttCount})
          </span>
        </div>
      </div>

      {/* Topic Progress List */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Topic Scores</h2>
        {progress.length === 0 ? (
          <p className="text-text-muted text-center py-6">
            No progress recorded yet. Start learning to see your scores!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {progress.map((p) => {
              const barColor =
                p.mastery_level === 'mastered'
                  ? 'bg-green-500'
                  : p.mastery_level === 'working_towards'
                    ? 'bg-amber-400'
                    : 'bg-red-400';

              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-text-primary">{p.topic_id}</p>
                      <p className="text-sm font-bold text-text-primary">{Math.round(p.score)}%</p>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${Math.min(p.score, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
