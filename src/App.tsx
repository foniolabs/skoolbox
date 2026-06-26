import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import Layout from './components/layout/Layout'
import StudentLayout from './components/layout/StudentLayout'

// Auth pages
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

// Teacher pages
import DashboardPage from './pages/DashboardPage'
import PreparePage from './pages/PreparePage'
import ClassSessionPage from './pages/ClassSessionPage'
import PresentationPage from './pages/PresentationPage'
import AssessPage from './pages/AssessPage'
import QuizPlayerPage from './pages/QuizPlayerPage'
import MonitorPage from './pages/MonitorPage'
import LessonPlannerPage from './pages/LessonPlannerPage'
import EnrollStudentsPage from './pages/EnrollStudentsPage'
import CurriculumPlannerPage from './pages/CurriculumPlannerPage'
import TermPlanViewPage from './pages/TermPlanViewPage'
import CurriculumLibraryPage from './pages/CurriculumLibraryPage'

// Student pages
import StudentHomePage from './pages/student/StudentHomePage'
import StudentSubjectsPage from './pages/student/StudentSubjectsPage'
import StudentQuizzesPage from './pages/student/StudentQuizzesPage'
import StudentProgressPage from './pages/student/StudentProgressPage'
import TopicLearningPage from './pages/student/TopicLearningPage'

/** Sends user to their correct home based on role */
function RoleRedirect() {
  const { isLoggedIn, user } = useAuthStore()
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (user?.role === 'student') return <Navigate to="/student" replace />
  return <Navigate to="/dashboard" replace />
}

function App() {
  const { isLoggedIn, user } = useAuthStore()
  const role = user?.role

  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={isLoggedIn ? <RoleRedirect /> : <LoginPage />} />
      <Route path="/signup" element={isLoggedIn ? <RoleRedirect /> : <SignupPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Teacher routes — only render if logged in as teacher */}
      {isLoggedIn && role === 'teacher' && (
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prepare" element={<PreparePage />} />
          <Route path="/prepare/lesson-planner" element={<LessonPlannerPage />} />
          <Route path="/prepare/:subjectId" element={<PreparePage />} />
          <Route path="/teach" element={<ClassSessionPage />} />
          <Route path="/classroom" element={<ClassSessionPage />} />
          <Route path="/assess" element={<AssessPage />} />
          <Route path="/assess/:quizId" element={<QuizPlayerPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/enroll" element={<EnrollStudentsPage />} />
          <Route path="/curriculum-library" element={<CurriculumLibraryPage />} />
          <Route path="/curriculum" element={<CurriculumPlannerPage />} />
          <Route path="/curriculum/:planId" element={<TermPlanViewPage />} />
        </Route>
      )}

      {/* Student routes — only render if logged in as student */}
      {isLoggedIn && role === 'student' && (
        <Route element={<StudentLayout />}>
          <Route path="/student" element={<StudentHomePage />} />
          <Route path="/student/subjects" element={<StudentSubjectsPage />} />
          <Route path="/student/quizzes" element={<StudentQuizzesPage />} />
          <Route path="/student/progress" element={<StudentProgressPage />} />
          <Route path="/student/subjects/:subjectId/topics/:topicId" element={<TopicLearningPage />} />
        </Route>
      )}

      {/* Full-screen presentation (teacher only) */}
      {isLoggedIn && role === 'teacher' && (
        <Route path="/presentation" element={<PresentationPage />} />
      )}

      {/* Catch all */}
      <Route path="*" element={isLoggedIn ? <RoleRedirect /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
