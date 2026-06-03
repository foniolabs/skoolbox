import { ArrowUpDown } from 'lucide-react'
import type { StudentWithProgress } from '../../pages/DashboardPage'

const avatarColors = ['bg-pink-400', 'bg-blue-400', 'bg-purple-400', 'bg-teal-400', 'bg-amber-400', 'bg-green-400', 'bg-indigo-400', 'bg-rose-400']

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'bg-card-green'
  if (score >= 50) return 'bg-card-orange'
  return 'bg-card-coral'
}

function getScoreTextColor(score: number): string {
  if (score >= 75) return 'text-green-800'
  if (score >= 50) return 'text-orange-800'
  return 'text-red-800'
}

function SortableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
      <button className="flex items-center gap-1 hover:text-text-primary transition-colors">
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  )
}

interface StudentProficiencyTableProps {
  students: StudentWithProgress[]
  loading: boolean
}

export default function StudentProficiencyTable({ students, loading }: StudentProficiencyTableProps) {
  const rows = students.map((s) => {
    const progress = s.progress
    const totalWork = progress.length
    const completed = progress.filter((p) => p.status === 'completed').length
    const avgScore = totalWork > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / totalWork)
      : 0
    const mastered = progress.filter((p) => p.mastery_level === 'mastered').length
    const workingTowards = progress.filter((p) => p.mastery_level === 'working_towards').length
    const needsAttention = progress.filter((p) => p.mastery_level === 'needs_attention').length

    return {
      id: s.student.id,
      name: s.student.full_name,
      initials: getInitials(s.student.full_name),
      workCompleted: `${completed}/${totalWork}`,
      averageScore: avgScore,
      mastered,
      workingTowards,
      needsAttention,
    }
  })

  return (
    <div className="bg-white rounded-[20px] shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 pt-6 pb-4">
        <h2 className="text-lg font-bold text-text-primary">Students Proficiency</h2>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <button className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            Learning Objectives
          </button>
          <button className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
            All Strands
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-x-auto ${loading ? 'animate-pulse' : ''}`}>
        <table className="w-full">
          <thead>
            <tr className="border-t border-gray-100">
              <SortableHeader>Full Name</SortableHeader>
              <SortableHeader>Work Completed</SortableHeader>
              <SortableHeader>Average Score</SortableHeader>
              <SortableHeader>Needing Attention</SortableHeader>
              <SortableHeader>Working Towards</SortableHeader>
              <SortableHeader>Mastered</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((student, index) => (
              <tr
                key={student.id}
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50 transition-colors`}
              >
                {/* Full Name with avatar */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${avatarColors[index % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                    >
                      {student.initials}
                    </div>
                    <span className="text-sm font-medium text-text-primary whitespace-nowrap">
                      {student.name}
                    </span>
                  </div>
                </td>

                {/* Work Completed */}
                <td className="px-4 py-3.5">
                  <span className="text-sm text-text-primary font-medium">{student.workCompleted}</span>
                </td>

                {/* Average Score with colored bar */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getScoreColor(student.averageScore)}`}
                        style={{ width: `${student.averageScore}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold ${getScoreTextColor(student.averageScore)}`}>
                      {student.averageScore}%
                    </span>
                  </div>
                </td>

                {/* Needing Attention */}
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card-coral/15 text-card-coral text-sm font-bold">
                    {student.needsAttention}
                  </span>
                </td>

                {/* Working Towards */}
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card-orange/15 text-card-orange text-sm font-bold">
                    {student.workingTowards}
                  </span>
                </td>

                {/* Mastered */}
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-card-green/15 text-card-green text-sm font-bold">
                    {student.mastered}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
