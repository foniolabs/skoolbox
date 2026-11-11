import { useState, useEffect, useCallback } from 'react'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import ClassScoreCard from '../components/dashboard/ClassScoreCard'
import PerformanceBuckets from '../components/dashboard/PerformanceBuckets'
import StudentProficiencyTable from '../components/dashboard/StudentProficiencyTable'
import StudentEditModal from '../components/dashboard/StudentEditModal'
import {
  getAllStudents, getClassOverview, getStudentProgress, deleteStudent, setStudentStatus,
  type Student, type ClassOverview, type StudentProgress,
} from '../lib/tauri/commands'

export interface StudentWithProgress {
  student: Student
  progress: StudentProgress[]
}

export default function DashboardPage() {
  const [selectedClass, setSelectedClass] = useState('Pry 5')
  const [overview, setOverview] = useState<ClassOverview | null>(null)
  const [studentsWithProgress, setStudentsWithProgress] = useState<StudentWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; name: string; classLevel: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewData, students] = await Promise.all([
        getClassOverview(selectedClass),
        getAllStudents(),
      ])
      setOverview(overviewData)

      // Fetch progress for each student
      const withProgress = await Promise.all(
        students.map(async (student) => ({
          student,
          progress: await getStudentProgress(student.id),
        }))
      )
      setStudentsWithProgress(withProgress)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    }
    setLoading(false)
  }, [selectedClass])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!confirm(`Delete ${name} and all their data? This cannot be undone.`)) return
    try {
      await deleteStudent(studentId)
      await fetchData()
    } catch (err) {
      console.error('Failed to delete student:', err)
    }
  }

  const handleToggleSuspend = async (studentId: string, name: string, currentStatus: string) => {
    const next = currentStatus === 'suspended' ? 'active' : 'suspended'
    const verb = next === 'suspended' ? 'Suspend' : 'Reactivate'
    if (!confirm(`${verb} ${name}?${next === 'suspended' ? ' They will no longer be able to log in.' : ''}`)) return
    try {
      await setStudentStatus(studentId, next)
      await fetchData()
    } catch (err) {
      console.error('Failed to update student status:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader selectedClass={selectedClass} onClassChange={setSelectedClass} />

      {/* Score card + Performance buckets row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <ClassScoreCard overview={overview} loading={loading} />
        </div>
        <div className="lg:col-span-3">
          <PerformanceBuckets overview={overview} loading={loading} />
        </div>
      </div>

      {/* Student proficiency table */}
      <StudentProficiencyTable
        students={studentsWithProgress}
        loading={loading}
        actions={{
          onEdit: setEditing,
          onToggleSuspend: handleToggleSuspend,
          onDelete: handleDeleteStudent,
        }}
      />

      {editing && (
        <StudentEditModal
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchData() }}
        />
      )}
    </div>
  )
}
