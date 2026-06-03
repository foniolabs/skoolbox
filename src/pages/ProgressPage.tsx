import { BarChart3 } from 'lucide-react';
import ProgressStats from '../components/progress/ProgressStats';
import ScoreTrend from '../components/progress/ScoreTrend';
import StrengthsWeaknesses from '../components/progress/StrengthsWeaknesses';
import SubjectBreakdown from '../components/progress/SubjectBreakdown';

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">
          Your Learning Progress
        </h1>
      </div>

      {/* Stat Cards */}
      <ProgressStats />

      {/* Score Trend + Strengths/Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreTrend />
        <StrengthsWeaknesses />
      </div>

      {/* Subject Breakdown */}
      <SubjectBreakdown />
    </div>
  );
}
