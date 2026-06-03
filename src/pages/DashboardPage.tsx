import { useState, useEffect } from 'react'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import ClassScoreCard from '../components/dashboard/ClassScoreCard'
import PerformanceBuckets from '../components/dashboard/PerformanceBuckets'
import StudentProficiencyTable from '../components/dashboard/StudentProficiencyTable'
import {
  getAllStudents, getClassOverview, getStudentProgress,
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

  useEffect(() => {
    async function fetchData() {
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
    }
    fetchData()
  }, [selectedClass])

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
      <StudentProficiencyTable students={studentsWithProgress} loading={loading} />
    </div>
  )
}
