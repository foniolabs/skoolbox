import { useState } from 'react';
import { Activity } from 'lucide-react';
import ProgressStats from '../components/progress/ProgressStats';
import ScoreTrend from '../components/progress/ScoreTrend';
import StrengthsWeaknesses from '../components/progress/StrengthsWeaknesses';
import SubjectBreakdown from '../components/progress/SubjectBreakdown';
import CustomDropdown from '../components/shared/CustomDropdown';

const classOptions = [
  { label: 'All Classes', value: 'All Classes' },
  { label: 'Class A', value: 'Class A' },
  { label: 'Class B', value: 'Class B' },
];

export default function MonitorPage() {
  const [selectedClass, setSelectedClass] = useState('All Classes');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-text-primary">
            Student Monitoring
          </h1>
        </div>

        <CustomDropdown
          options={classOptions}
          value={selectedClass}
          onChange={setSelectedClass}
          className="w-44"
        />
      </div>

      {/* Stat Cards - full width */}
      <div className="[&>div]:rounded-[20px] [&>div]:shadow-card">
        <ProgressStats />
      </div>

      {/* Score Trend + Strengths/Weaknesses - 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 [&>div]:rounded-[20px] [&>div]:shadow-card">
        <ScoreTrend />
        <StrengthsWeaknesses />
      </div>

      {/* Subject Breakdown */}
      <div className="[&>div]:rounded-[20px] [&>div]:shadow-card">
        <SubjectBreakdown />
      </div>
    </div>
  );
}
