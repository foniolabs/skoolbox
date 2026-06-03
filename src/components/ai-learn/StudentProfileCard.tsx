import { useEffect, useState } from 'react';
import { Brain, TrendingUp, AlertCircle, MessageSquare } from 'lucide-react';
import { getStudentLearningProfile, type LearningProfile } from '../../lib/tauri/commands';

interface StudentProfileCardProps {
  studentId: string;
}

const masteryColors: Record<string, string> = {
  beginner: 'bg-red-100 text-red-700',
  developing: 'bg-amber-100 text-amber-700',
  proficient: 'bg-blue-100 text-blue-700',
  advanced: 'bg-green-100 text-green-700',
};

const confidenceColors: Record<string, string> = {
  low: 'text-red-500',
  medium: 'text-amber-500',
  high: 'text-green-500',
};

const confidenceLabel: Record<string, string> = {
  low: 'Needs encouragement',
  medium: 'Building confidence',
  high: 'Confident learner',
};

export default function StudentProfileCard({ studentId }: StudentProfileCardProps) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);

  useEffect(() => {
    getStudentLearningProfile(studentId).then(setProfile);
  }, [studentId]);

  if (!profile) return null;

  const weakSubjects: string[] = (() => {
    try { return JSON.parse(profile.weakest_subjects) } catch { return [] }
  })();
  const strongSubjects: string[] = (() => {
    try { return JSON.parse(profile.strongest_subjects) } catch { return [] }
  })();

  const masteryClass = masteryColors[profile.overall_mastery_level] || 'bg-gray-100 text-gray-600';
  const confidenceClass = confidenceColors[profile.confidence_level] || 'text-gray-500';

  return (
    <div className="bg-white rounded-[16px] border border-gray-100 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={16} className="text-primary" />
        <h4 className="text-sm font-semibold text-text-primary">Learning Profile</h4>
      </div>

      {/* Mastery + Confidence */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${masteryClass}`}>
          {profile.overall_mastery_level.charAt(0).toUpperCase() + profile.overall_mastery_level.slice(1)}
        </span>
        <span className={`text-xs font-medium ${confidenceClass}`}>
          {confidenceLabel[profile.confidence_level] || profile.confidence_level}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <MessageSquare size={12} />
          <span>{profile.total_ai_conversations} sessions</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp size={12} />
          <span>{profile.total_ai_messages} messages</span>
        </div>
      </div>

      {/* Strong subjects */}
      {strongSubjects.length > 0 && (
        <div>
          <p className="text-xs text-text-muted mb-1">Strong in:</p>
          <div className="flex flex-wrap gap-1">
            {strongSubjects.slice(0, 3).map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weak subjects */}
      {weakSubjects.length > 0 && (
        <div>
          <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
            <AlertCircle size={10} /> Needs work:
          </p>
          <div className="flex flex-wrap gap-1">
            {weakSubjects.slice(0, 3).map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Learning style */}
      {profile.preferred_explanation_type && profile.preferred_explanation_type !== 'unknown' && (
        <p className="text-xs text-text-secondary">
          Learns best via: <span className="font-medium">{profile.preferred_explanation_type.replace(/_/g, ' ')}</span>
        </p>
      )}

      {/* Last session summary */}
      {profile.last_conversation_summary && (
        <div className="bg-bg-secondary rounded-[10px] p-2.5">
          <p className="text-xs text-text-muted mb-0.5">Last session:</p>
          <p className="text-xs text-text-secondary leading-relaxed">
            {profile.last_conversation_summary}
          </p>
        </div>
      )}
    </div>
  );
}
