import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { BookOpen, ClipboardCheck, TrendingUp, Flame, Trophy, Target, Brain, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getStudent, getStudentProgress, type Student, type StudentProgress } from '../../lib/tauri/commands';

export default function StudentHomePage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.full_name?.split(' ')[0] || 'Student';

  const [student, setStudent] = useState<Student | null>(null);
  const [progress, setProgress] = useState<StudentProgress[]>([]);

  useEffect(() => {
    if (!user?.student_id) return;
    getStudent(user.student_id).then(setStudent).catch(() => {});
    getStudentProgress(user.student_id).then(setProgress).catch(() => {});
  }, [user?.student_id]);

  const avgScore = progress.length > 0
    ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / progress.length)
    : 0;

  const quickActions = [
    {
      label: 'My Subjects',
      description: 'Continue learning where you left off',
      icon: BookOpen,
      to: '/student/subjects',
      color: 'bg-green-50 text-primary',
    },
    {
      label: 'Take a Quiz',
      description: 'Test your knowledge',
      icon: ClipboardCheck,
      to: '/student/quizzes',
      color: 'bg-amber-50 text-accent',
    },
    {
      label: 'My Progress',
      description: 'Track your performance',
      icon: TrendingUp,
      to: '/student/progress',
      color: 'bg-blue-50 text-blue-600',
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-[20px] p-6 text-white relative overflow-hidden">
        <div className="absolute right-4 top-4 opacity-10">
          <Brain size={120} />
        </div>
        <p className="text-white/70 text-sm font-medium mb-1">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-bold mb-1">Welcome back, {firstName}!</h1>
        <p className="text-white/80">Keep learning and growing every day</p>
        <Link
          to="/student/subjects"
          className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2 rounded-[12px] text-sm font-medium transition-colors"
        >
          Continue Learning <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[20px] shadow-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
            <Flame className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{student?.streak_days ?? 0}</p>
            <p className="text-sm text-text-secondary">Day Streak</p>
          </div>
        </div>

        <div className="bg-white rounded-[20px] shadow-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <Trophy className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{(student?.total_points ?? 0).toLocaleString()}</p>
            <p className="text-sm text-text-secondary">Total Points</p>
          </div>
        </div>

        <div className="bg-white rounded-[20px] shadow-card p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">{avgScore}%</p>
            <p className="text-sm text-text-secondary">Average Score</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-text-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="bg-white rounded-[20px] shadow-card p-5 flex items-start gap-4 hover:shadow-lg transition-shadow"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${action.color}`}>
                <action.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-text-primary">{action.label}</p>
                <p className="text-sm text-text-secondary mt-0.5">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Martha AI Tutor Card */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-[20px] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-text-primary">Martha - AI Tutor</h3>
            <p className="text-sm text-text-secondary">
              Ask Martha anything about your subjects. She explains step by step and reads aloud!
            </p>
          </div>
          <Link
            to="/student/subjects"
            className="px-4 py-2.5 rounded-[12px] bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Start Learning
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">Recent Activity</h2>
        {progress.length > 0 ? (
          <div className="flex flex-col gap-3">
            {progress.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-bg-secondary rounded-[12px]">
                <ClipboardCheck size={18} className="text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    Score: {Math.round(p.score)}% on a topic
                  </p>
                  <p className="text-xs text-text-muted">
                    Status: {p.status} · Mastery: {p.mastery_level}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <BookOpen size={32} className="text-text-muted mb-3" />
            <p className="text-text-secondary">No activity yet. Start learning to see your progress here!</p>
            <Link
              to="/student/subjects"
              className="mt-3 text-primary text-sm font-medium hover:underline"
            >
              Browse subjects
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
