/**
 * Tauri backend command bindings.
 * Wraps all invoke() calls with typed interfaces.
 * Falls back to mock data when running in browser (npm run dev without Tauri).
 */

import {
  mockStudents, mockSubjects, mockTopics, mockQuestions,
  mockStudentProgress, mockClassOverview, mockAiLessons, mockTtsSettings,
  getMockSetting, setMockSetting,
} from './mockData'

// Check if we're running inside Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error(`Tauri not available: ${cmd}`)
  }
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

// ── Types ─────────────────────────────────────────────

export interface Student {
  id: string
  full_name: string
  class_level: string
  avatar_url: string | null
  streak_days: number
  total_points: number
  created_at: string
  status?: string // 'active' | 'suspended'
}

export interface Subject {
  id: string
  name: string
  icon: string | null
  class_level: string
  description: string | null
}

export interface Topic {
  id: string
  subject_id: string
  name: string
  description: string | null
  sort_order: number
  is_locked: boolean
  is_taught: boolean
  estimated_minutes: number
}

export interface Question {
  id: string
  topic_id: string
  question_text: string
  question_type: string
  options: string | null
  correct_answer: string
  explanation: string | null
  difficulty: number
}

export interface StudentProgress {
  id: string
  student_id: string
  topic_id: string
  status: string
  score: number
  time_spent_seconds: number
  last_accessed: string | null
  mastery_level: string
}

export interface ClassOverview {
  total_students: number
  average_score: number
  mastered_count: number
  working_towards_count: number
  needs_attention_count: number
  total_work_assigned: number
}

export interface QuizAttempt {
  id: string
  student_id: string
  subject_id: string | null
  topic_id: string | null
  quiz_type: string
  total_questions: number
  correct_answers: number
  score: number
  time_taken_seconds: number | null
  questions_data: string | null
  created_at: string
}

export interface AILesson {
  id: string
  teacher_command: string
  subject: string | null
  class_level: string | null
  mode: string
  lesson_data: string
  duration_seconds: number | null
  created_at: string
}

export interface TtsSettings {
  voice: string
  speed: string
}

// ── Student commands ──────────────────────────────────

export async function getAllStudents(): Promise<Student[]> {
  if (!isTauri) return mockStudents
  return invoke<Student[]>('get_all_students')
}

export async function getStudent(studentId: string): Promise<Student> {
  if (!isTauri) {
    const s = mockStudents.find((s) => s.id === studentId)
    if (!s) throw new Error('Student not found')
    return s
  }
  return invoke<Student>('get_student', { studentId })
}

export async function createStudent(fullName: string, classLevel: string): Promise<Student> {
  if (!isTauri) {
    const newStudent: Student = {
      id: `s-${Date.now()}`, full_name: fullName, class_level: classLevel,
      avatar_url: null, streak_days: 0, total_points: 0, created_at: new Date().toISOString(),
    }
    mockStudents.push(newStudent)
    return newStudent
  }
  return invoke<Student>('create_student', { fullName, classLevel })
}

// ── Subject & Topic commands ──────────────────────────

export async function getSubjects(classLevel?: string): Promise<Subject[]> {
  if (!isTauri) {
    if (classLevel) return mockSubjects.filter((s) => s.class_level === classLevel)
    return mockSubjects
  }
  return invoke<Subject[]>('get_subjects', { classLevel: classLevel ?? null })
}

export async function getTopics(subjectId: string): Promise<Topic[]> {
  if (!isTauri) return mockTopics[subjectId] || []
  return invoke<Topic[]>('get_topics', { subjectId })
}

export async function getQuestions(
  topicId: string,
  difficulty?: number,
  limit?: number,
): Promise<Question[]> {
  if (!isTauri) {
    let pool = mockQuestions.filter((q) => q.topic_id === topicId)
    if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty)
    if (limit) pool = pool.slice(0, limit)
    return pool
  }
  return invoke<Question[]>('get_questions', {
    topicId,
    difficulty: difficulty ?? null,
    limit: limit ?? null,
  })
}

// ── Progress commands ─────────────────────────────────

export async function getStudentProgress(studentId: string): Promise<StudentProgress[]> {
  if (!isTauri) return mockStudentProgress[studentId] || []
  return invoke<StudentProgress[]>('get_student_progress', { studentId })
}

export async function updateStudentProgress(
  studentId: string,
  topicId: string,
  score: number,
  status: string,
): Promise<void> {
  if (!isTauri) return
  return invoke('update_student_progress', { studentId, topicId, score, status })
}

export async function getClassOverview(classLevel: string): Promise<ClassOverview> {
  if (!isTauri) return mockClassOverview
  return invoke<ClassOverview>('get_class_overview', { classLevel })
}

// ── Quiz commands ─────────────────────────────────────

export async function saveQuizAttempt(data: {
  studentId: string
  subjectId?: string
  topicId?: string
  quizType: string
  totalQuestions: number
  correctAnswers: number
  score: number
  timeTakenSeconds?: number
  questionsData?: string
}): Promise<QuizAttempt> {
  if (!isTauri) {
    return {
      id: `qa-${Date.now()}`, student_id: data.studentId,
      subject_id: data.subjectId ?? null, topic_id: data.topicId ?? null,
      quiz_type: data.quizType, total_questions: data.totalQuestions,
      correct_answers: data.correctAnswers, score: data.score,
      time_taken_seconds: data.timeTakenSeconds ?? null,
      questions_data: data.questionsData ?? null,
      created_at: new Date().toISOString(),
    }
  }
  return invoke<QuizAttempt>('save_quiz_attempt', {
    studentId: data.studentId,
    subjectId: data.subjectId ?? null,
    topicId: data.topicId ?? null,
    quizType: data.quizType,
    totalQuestions: data.totalQuestions,
    correctAnswers: data.correctAnswers,
    score: data.score,
    timeTakenSeconds: data.timeTakenSeconds ?? null,
    questionsData: data.questionsData ?? null,
  })
}

export async function getQuizAttempts(studentId: string): Promise<QuizAttempt[]> {
  if (!isTauri) return []
  return invoke<QuizAttempt[]>('get_quiz_attempts', { studentId })
}

// ── AI commands ───────────────────────────────────────

export async function askAiTutor(data: {
  prompt: string
  subject: string
  classLevel: string
  mode: string
}): Promise<string> {
  if (!isTauri) throw new Error('AI Tutor requires Tauri backend. Using offline fallback.')
  return invoke<string>('ask_ai_tutor', data)
}

export async function generateQuizAi(data: {
  subject: string
  topic: string
  classLevel: string
  difficulty: string
  numQuestions: number
}): Promise<string> {
  if (!isTauri) throw new Error('AI Quiz generation requires Tauri backend. Using offline fallback.')
  return invoke<string>('generate_quiz_ai', data)
}

export async function checkConnectivity(): Promise<boolean> {
  if (!isTauri) return navigator.onLine
  return invoke<boolean>('check_connectivity')
}

// ── AI Lesson History ─────────────────────────────────

export async function saveAiLesson(data: {
  teacherCommand: string
  subject?: string
  classLevel?: string
  mode: string
  lessonData: string
}): Promise<AILesson> {
  if (!isTauri) {
    const lesson: AILesson = {
      id: `al-${Date.now()}`, teacher_command: data.teacherCommand,
      subject: data.subject ?? null, class_level: data.classLevel ?? null,
      mode: data.mode, lesson_data: data.lessonData,
      duration_seconds: null, created_at: new Date().toISOString(),
    }
    mockAiLessons.unshift(lesson)
    return lesson
  }
  return invoke<AILesson>('save_ai_lesson', {
    teacherCommand: data.teacherCommand,
    subject: data.subject ?? null,
    classLevel: data.classLevel ?? null,
    mode: data.mode,
    lessonData: data.lessonData,
  })
}

export async function getAiLessonHistory(): Promise<AILesson[]> {
  if (!isTauri) return mockAiLessons
  return invoke<AILesson[]>('get_ai_lesson_history')
}

// ── Settings ──────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri) return getMockSetting(key)
  return invoke<string | null>('get_setting', { key })
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri) { setMockSetting(key, value); return }
  return invoke('set_setting', { key, value })
}

// ── TTS ───────────────────────────────────────────────

export async function getTtsSettings(): Promise<TtsSettings> {
  if (!isTauri) return mockTtsSettings
  return invoke<TtsSettings>('get_tts_settings')
}

export async function saveTtsSettings(settings: TtsSettings): Promise<void> {
  if (!isTauri) return
  return invoke('save_tts_settings', { ...settings })
}

// ── Topic Management ─────────────────────────────────

export async function markTopicTaught(topicId: string, isTaught: boolean): Promise<void> {
  if (!isTauri) return
  return invoke('mark_topic_taught', { topicId, isTaught })
}

// ── Videos ───────────────────────────────────────────

export interface Video {
  id: string
  title: string
  youtube_id: string | null
  subject: string
  topic: string | null
  class_level: string | null
  duration_seconds: number | null
  description: string | null
  source: string
  created_at: string
}

export async function getTopicVideos(subject: string, topic: string): Promise<Video[]> {
  if (!isTauri) return []
  return invoke<Video[]>('get_topic_videos', { subject, topic })
}

export async function addTopicVideo(data: {
  title: string
  youtubeId: string
  subject: string
  topic: string
  classLevel: string
  description?: string
}): Promise<Video> {
  if (!isTauri) {
    return {
      id: `v-${Date.now()}`, title: data.title, youtube_id: data.youtubeId,
      subject: data.subject, topic: data.topic, class_level: data.classLevel,
      duration_seconds: null, description: data.description || null,
      source: 'youtube', created_at: new Date().toISOString(),
    }
  }
  return invoke<Video>('add_topic_video', {
    title: data.title, youtubeId: data.youtubeId, subject: data.subject,
    topic: data.topic, classLevel: data.classLevel, description: data.description ?? null,
  })
}

// ── Student AI Tutor ─────────────────────────────────

export async function askStudentTutor(data: {
  messages: [string, string][]
  subject: string
  topic: string
  classLevel: string
}): Promise<string> {
  if (!isTauri) {
    // Browser fallback: simple mock response
    const lastMsg = data.messages[data.messages.length - 1]?.[1] || ''
    return `Great question about "${data.topic}"! Let me explain...\n\nThis is a demo response in browser mode. In the full Tauri app, the AI tutor will give you a detailed, step-by-step explanation tailored to your ${data.classLevel} level.\n\nYou asked: "${lastMsg}"\n\nTry running the app with \`npm run tauri:dev\` and set your Claude API key in Settings to get real AI tutoring!`
  }
  return invoke<string>('ask_student_tutor', data)
}

// ── Auth ─────────────────────────────────────────────

export interface User {
  id: string
  username: string
  full_name: string
  role: string
  student_id: string | null
  created_at: string
}

export interface LoginResponse {
  user: User
  success: boolean
  message: string
}

// Browser-mode demo accounts (used when Tauri backend is not available)
const demoAccounts: Record<string, { password: string; user: User }> = {
  teacher: {
    password: 'teacher123',
    user: { id: 'user-teacher-1', username: 'teacher', full_name: 'Mr. Emmanuel', role: 'teacher', student_id: null, created_at: '2024-01-01T00:00:00Z' },
  },
  amina: {
    password: 'student123',
    user: { id: 'user-s1', username: 'amina', full_name: 'Amina Johnson', role: 'student', student_id: 's1', created_at: '2024-01-01T00:00:00Z' },
  },
  david: {
    password: 'student123',
    user: { id: 'user-s2', username: 'david', full_name: 'David Okonkwo', role: 'student', student_id: 's2', created_at: '2024-01-01T00:00:00Z' },
  },
  grace: {
    password: 'student123',
    user: { id: 'user-s3', username: 'grace', full_name: 'Grace Peters', role: 'student', student_id: 's3', created_at: '2024-01-01T00:00:00Z' },
  },
  samuel: {
    password: 'student123',
    user: { id: 'user-s4', username: 'samuel', full_name: 'Samuel Kehinde', role: 'student', student_id: 's4', created_at: '2024-01-01T00:00:00Z' },
  },
  fatima: {
    password: 'student123',
    user: { id: 'user-s5', username: 'fatima', full_name: 'Fatima Bello', role: 'student', student_id: 's5', created_at: '2024-01-01T00:00:00Z' },
  },
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  if (!isTauri) {
    const account = demoAccounts[username.toLowerCase()]
    if (account && account.password === password) {
      return { user: account.user, success: true, message: 'Login successful' }
    }
    return {
      user: { id: '', username: '', full_name: '', role: '', student_id: null, created_at: '' },
      success: false,
      message: account ? 'Incorrect password' : 'User not found',
    }
  }
  return invoke<LoginResponse>('login', { username, password })
}

export async function register(
  username: string,
  password: string,
  fullName: string,
  role: string,
  classLevel?: string,
): Promise<LoginResponse> {
  if (!isTauri) {
    return {
      user: {
        id: `user-${Date.now()}`, username, full_name: fullName,
        role, student_id: role === 'student' ? `s-${Date.now()}` : null,
        created_at: new Date().toISOString(),
      },
      success: true,
      message: 'Account created (browser mode)',
    }
  }
  return invoke<LoginResponse>('register', { username, password, fullName, role, classLevel: classLevel ?? null })
}

export async function getAllUsers(): Promise<User[]> {
  if (!isTauri) return []
  return invoke<User[]>('get_all_users')
}

export async function deleteUser(userId: string): Promise<void> {
  if (!isTauri) return
  return invoke('delete_user', { userId })
}

/** Delete a student and all of their data (works even for orphaned records with no login). */
export async function deleteStudent(studentId: string): Promise<void> {
  if (!isTauri) return
  return invoke('delete_student', { studentId })
}

/** Update a student's name and/or class (e.g. upgrading them to a new class). */
export async function updateStudent(studentId: string, data: {
  fullName?: string
  classLevel?: string
}): Promise<void> {
  if (!isTauri) return
  return invoke('update_student', {
    studentId,
    fullName: data.fullName ?? null,
    classLevel: data.classLevel ?? null,
  })
}

/** Suspend (when a student leaves) or reactivate a student. status: 'active' | 'suspended'. */
export async function setStudentStatus(studentId: string, status: 'active' | 'suspended'): Promise<void> {
  if (!isTauri) return
  return invoke('set_student_status', { studentId, status })
}

export async function enrollStudents(
  students: [string, string, string][],
  defaultPassword: string,
): Promise<User[]> {
  if (!isTauri) return []
  return invoke<User[]>('enroll_students', { students, defaultPassword })
}

// ── AI Agent (4-layer system with memory + feedback) ──────────────────────────

export interface LearningProfile {
  id: string
  student_id: string
  preferred_explanation_type: string
  strongest_subjects: string
  weakest_subjects: string
  overall_mastery_level: string
  confidence_level: string
  frustration_indicators: number
  total_ai_conversations: number
  total_ai_messages: number
  topics_discussed: string
  last_conversation_summary: string | null
  updated_at: string
}

export interface AgentResponse {
  message: string
  conversation_id: string
  message_id: string
}

export interface ConversationSummary {
  id: string
  student_id: string
  subject: string
  topic: string | null
  summary: string
  key_insights: string | null
  messages_count: number | null
  session_date: string
}

export interface ChatHistoryMessage {
  id: string
  student_id: string
  role: string
  content: string
  subject: string | null
  topic: string | null
  conversation_id: string
  created_at: string
}

export interface StudentMistake {
  id: string
  student_id: string
  topic_id: string
  mistake_type: string
  mistake_description: string
  occurrence_count: number
  last_occurred: string
  is_resolved: boolean
}

export interface TopicHealth {
  topic_id: string
  topic_name: string
  subject_name: string
  total_feedback: number
  negative_feedback: number
  avg_quiz_score: number | null
}

export interface FeedbackProcessResult {
  golden_explanations_added: number
  problem_topics_flagged: number
  summaries_generated: number
}

export async function aiAgentChat(data: {
  studentId: string
  message: string
  subject: string
  topic?: string
  classLevel: string
  conversationId: string
}): Promise<AgentResponse> {
  if (!isTauri) {
    await new Promise((r) => setTimeout(r, 600))
    return {
      message: `Hi! I'm Martha, your AI tutor. I'm ready to help you with "${data.topic || data.subject}". This is a browser preview — run the Tauri app to get real AI-powered responses with memory and curriculum context.`,
      conversation_id: data.conversationId,
      message_id: `msg-${Date.now()}`,
    }
  }
  return invoke<AgentResponse>('ai_agent_chat', {
    studentId: data.studentId,
    message: data.message,
    subject: data.subject,
    topic: data.topic ?? null,
    classLevel: data.classLevel,
    conversationId: data.conversationId,
  })
}

export async function submitAiFeedback(data: {
  studentId: string
  messageId: string
  conversationId: string
  feedbackType: 'thumbs_up' | 'thumbs_down'
  feedbackDetail?: string
  aiResponseText: string
  studentQuestion: string
  topicId?: string
  subject?: string
}): Promise<boolean> {
  if (!isTauri) return true
  return invoke<boolean>('submit_ai_feedback', {
    studentId: data.studentId,
    messageId: data.messageId,
    conversationId: data.conversationId,
    feedbackType: data.feedbackType,
    feedbackDetail: data.feedbackDetail ?? null,
    aiResponseText: data.aiResponseText,
    studentQuestion: data.studentQuestion,
    topicId: data.topicId ?? null,
    subject: data.subject ?? null,
  })
}

export async function generateConversationSummary(data: {
  studentId: string
  conversationId: string
  subject: string
  topic?: string
}): Promise<string> {
  if (!isTauri) return ''
  return invoke<string>('generate_conversation_summary', {
    studentId: data.studentId,
    conversationId: data.conversationId,
    subject: data.subject,
    topic: data.topic ?? null,
  })
}

export async function getStudentLearningProfile(studentId: string): Promise<LearningProfile | null> {
  if (!isTauri) return null
  try {
    return await invoke<LearningProfile>('get_student_learning_profile', { studentId })
  } catch {
    return null
  }
}

export async function getConversationSummaries(studentId: string, limit = 5): Promise<ConversationSummary[]> {
  if (!isTauri) return []
  return invoke<ConversationSummary[]>('get_conversation_summaries', { studentId, limit })
}

export async function getChatHistory(studentId: string, conversationId: string, limit = 50): Promise<ChatHistoryMessage[]> {
  if (!isTauri) return []
  return invoke<ChatHistoryMessage[]>('get_chat_history', { studentId, conversationId, limit })
}

export async function getStudentMistakes(studentId: string): Promise<StudentMistake[]> {
  if (!isTauri) return []
  return invoke<StudentMistake[]>('get_student_mistakes', { studentId })
}

export async function recordStudentMistake(data: {
  studentId: string
  topicId: string
  mistakeType: string
  mistakeDescription: string
}): Promise<boolean> {
  if (!isTauri) return true
  return invoke<boolean>('record_student_mistake', {
    studentId: data.studentId,
    topicId: data.topicId,
    mistakeType: data.mistakeType,
    mistakeDescription: data.mistakeDescription,
  })
}

export async function getTopicHealth(subject?: string): Promise<TopicHealth[]> {
  if (!isTauri) return []
  return invoke<TopicHealth[]>('get_topic_health', { subject: subject ?? null })
}

export async function processFeedbackBatch(): Promise<FeedbackProcessResult> {
  if (!isTauri) return { golden_explanations_added: 0, problem_topics_flagged: 0, summaries_generated: 0 }
  return invoke<FeedbackProcessResult>('process_feedback_batch')
}

// ── Curriculum / Term Planning ────────────────────────────────────────────────

export interface TermPlan {
  id: string
  subject_id: string
  subject_name: string
  class_level: string
  term: number              // 1 | 2 | 3
  academic_year: string
  title: string | null
  is_active: boolean
  created_at: string
  topic_count: number
}

export interface TermPlanTopic {
  id: string
  plan_id: string
  week_number: number
  topic_name: string
  topic_id: string | null
  lesson_notes: string | null
  objectives: string | null   // JSON array string
  activities: string | null   // JSON array string
  duration_minutes: number
  is_ai_generated: boolean
  is_taught: boolean
  taught_at: string | null
  created_at: string
}

export async function createTermPlan(data: {
  subjectId: string
  subjectName: string
  classLevel: string
  term: number
  academicYear: string
  title?: string
}): Promise<TermPlan> {
  if (!isTauri) throw new Error('Requires Tauri')
  return invoke<TermPlan>('create_term_plan', {
    subjectId: data.subjectId,
    subjectName: data.subjectName,
    classLevel: data.classLevel,
    term: data.term,
    academicYear: data.academicYear,
    title: data.title ?? null,
  })
}

export async function getTermPlans(subjectId?: string, classLevel?: string): Promise<TermPlan[]> {
  if (!isTauri) return []
  return invoke<TermPlan[]>('get_term_plans', {
    subjectId: subjectId ?? null,
    classLevel: classLevel ?? null,
  })
}

export async function getActiveTermPlan(subjectId: string, classLevel: string, term: number): Promise<TermPlan | null> {
  if (!isTauri) return null
  return invoke<TermPlan | null>('get_active_term_plan', { subjectId, classLevel, term })
}

export async function deleteTermPlan(planId: string): Promise<boolean> {
  if (!isTauri) return true
  return invoke<boolean>('delete_term_plan', { planId })
}

export async function getPlanTopics(planId: string): Promise<TermPlanTopic[]> {
  if (!isTauri) return []
  return invoke<TermPlanTopic[]>('get_plan_topics', { planId })
}

export async function addPlanTopic(data: {
  planId: string
  weekNumber: number
  topicName: string
  topicId?: string
  durationMinutes?: number
}): Promise<TermPlanTopic> {
  if (!isTauri) throw new Error('Requires Tauri')
  return invoke<TermPlanTopic>('add_plan_topic', {
    planId: data.planId,
    weekNumber: data.weekNumber,
    topicName: data.topicName,
    topicId: data.topicId ?? null,
    durationMinutes: data.durationMinutes ?? null,
  })
}

export async function updatePlanTopic(data: {
  topicId: string
  topicName?: string
  lessonNotes?: string
  objectives?: string
  activities?: string
  weekNumber?: number
  durationMinutes?: number
}): Promise<boolean> {
  if (!isTauri) return true
  return invoke<boolean>('update_plan_topic', {
    topicId: data.topicId,
    topicName: data.topicName ?? null,
    lessonNotes: data.lessonNotes ?? null,
    objectives: data.objectives ?? null,
    activities: data.activities ?? null,
    weekNumber: data.weekNumber ?? null,
    durationMinutes: data.durationMinutes ?? null,
  })
}

export async function deletePlanTopic(topicId: string): Promise<boolean> {
  if (!isTauri) return true
  return invoke<boolean>('delete_plan_topic', { topicId })
}

export async function markPlanTopicTaught(topicId: string, isTaught: boolean): Promise<boolean> {
  if (!isTauri) return true
  return invoke<boolean>('mark_plan_topic_taught', { topicId, isTaught })
}

export async function generatePlanTopicAi(data: {
  planTopicId: string
  topicName: string
  subject: string
  classLevel: string
  durationMinutes?: number
}): Promise<TermPlanTopic> {
  if (!isTauri) throw new Error('Requires Tauri')
  return invoke<TermPlanTopic>('generate_plan_topic_ai', {
    planTopicId: data.planTopicId,
    topicName: data.topicName,
    subject: data.subject,
    classLevel: data.classLevel,
    durationMinutes: data.durationMinutes ?? 40,
  })
}

export async function suggestTermTopics(data: {
  subject: string
  classLevel: string
  term: number
  numWeeks: number
}): Promise<string[]> {
  if (!isTauri) return []
  return invoke<string[]>('suggest_term_topics', {
    subject: data.subject,
    classLevel: data.classLevel,
    term: data.term,
    numWeeks: data.numWeeks,
  })
}

// ── Curriculum Knowledge Base (RAG ingestion) ─────────

export interface CurriculumDocument {
  id: string
  title: string
  subject: string | null
  class_level: string | null
  source_type: string
  chunk_count: number
  created_at: string
}

export interface IngestResult {
  document_id: string
  chunks: number
}

export interface CurriculumStats {
  documents: number
  chunks: number
}

/** Ingest a curriculum document: chunk it and index every chunk for retrieval. */
export async function ingestCurriculumText(data: {
  title: string
  subject: string
  classLevel: string
  sourceType: string
  content: string
}): Promise<IngestResult> {
  return invoke<IngestResult>('ingest_curriculum_text', {
    title: data.title,
    subject: data.subject,
    classLevel: data.classLevel,
    sourceType: data.sourceType,
    content: data.content,
  })
}

export async function listCurriculumDocuments(): Promise<CurriculumDocument[]> {
  if (!isTauri) return []
  return invoke<CurriculumDocument[]>('list_curriculum_documents')
}

export async function deleteCurriculumDocument(documentId: string): Promise<void> {
  await invoke<void>('delete_curriculum_document', { documentId })
}

export async function curriculumStats(): Promise<CurriculumStats> {
  if (!isTauri) return { documents: 0, chunks: 0 }
  return invoke<CurriculumStats>('curriculum_stats')
}

export interface ImportSummary {
  documents: number
  chunks: number
  replaced: boolean
}

/** Export the whole knowledge base as a pack file; returns the saved path. */
export async function exportCurriculumPack(name: string, version: string): Promise<string> {
  return invoke<string>('export_curriculum_pack', { name, version })
}

/** Import a curriculum pack (school side — the "patch update"). */
export async function importCurriculumPack(packJson: string, replace: boolean): Promise<ImportSummary> {
  return invoke<ImportSummary>('import_curriculum_pack', { packJson, replace })
}

// ── Classroom Engine (Martha leads a class) ───────────

export interface LessonSegment {
  introduction: string
  teaching_points: string[]
  check_question: string
}

export interface AnswerEvaluation {
  is_correct: boolean
  feedback: string
  remediation: string | null
}

/** Martha begins a class: introduction + teaching points + a checking question. */
export async function classroomStartLesson(subject: string, topic: string, classLevel: string): Promise<LessonSegment> {
  return invoke<LessonSegment>('classroom_start_lesson', { subject, topic, classLevel })
}

export interface LessonPlan {
  title: string
  segment_titles: string[]
}

export interface BoardStep {
  action: string
  content: string
  narration: string
}

export interface TeachingSegment {
  board_steps: BoardStep[]
  check_question: string
}

/** Plan a full ~30-minute lesson as 8–10 short segments. */
export async function classroomPlanLesson(subject: string, topic: string, classLevel: string): Promise<LessonPlan> {
  return invoke<LessonPlan>('classroom_plan_lesson', { subject, topic, classLevel })
}

/** Teach one segment: whiteboard steps (written + narrated) + a check question. */
export async function classroomTeachSegment(args: {
  subject: string; topic: string; classLevel: string
  segmentTitle: string; segmentIndex: number; totalSegments: number
}): Promise<TeachingSegment> {
  return invoke<TeachingSegment>('classroom_teach_segment', {
    subject: args.subject, topic: args.topic, classLevel: args.classLevel,
    segmentTitle: args.segmentTitle, segmentIndex: args.segmentIndex, totalSegments: args.totalSegments,
  })
}

/** Martha evaluates a student's answer to the checking question. */
export async function classroomEvaluateAnswer(
  subject: string, topic: string, question: string, studentAnswer: string,
): Promise<AnswerEvaluation> {
  return invoke<AnswerEvaluation>('classroom_evaluate_answer', { subject, topic, question, studentAnswer })
}

export interface GeneratedSegment {
  title: string
  board_steps: BoardStep[]
  check_question: string
}

export interface GeneratedLesson {
  subject: string
  class_level: string
  topic: string
  title: string
  segments: GeneratedSegment[]
}

export interface GeneratedLessonMeta {
  subject: string
  class_level: string
  topic: string
  title: string | null
  segment_count: number
  created_at: string
}

/** PRODUCER: bake a full lesson (slow) and store it for instant playback later. */
export async function bakeLesson(subject: string, topic: string, classLevel: string): Promise<GeneratedLesson> {
  return invoke<GeneratedLesson>('bake_lesson', { subject, topic, classLevel })
}

/** SCHOOL: fetch a pre-generated lesson for instant playback (null if none). */
export async function getGeneratedLesson(subject: string, topic: string, classLevel: string): Promise<GeneratedLesson | null> {
  return invoke<GeneratedLesson | null>('get_generated_lesson', { subject, topic, classLevel })
}

export async function listGeneratedLessons(): Promise<GeneratedLessonMeta[]> {
  if (!isTauri) return []
  return invoke<GeneratedLessonMeta[]>('list_generated_lessons')
}

export interface LessonNote {
  title: string
  objectives: string[]
  key_points: string[]
  examples: string[]
  homework: string[]
}

export interface ClassQuizQuestion {
  question: string
  answer: string
}

export interface ClassQuiz {
  title: string
  questions: ClassQuizQuestion[]
}

/** Generate a lesson note (objectives, key points, examples, homework) for teacher review. */
export async function classroomLessonNote(subject: string, topic: string, classLevel: string): Promise<LessonNote> {
  return invoke<LessonNote>('classroom_lesson_note', { subject, topic, classLevel })
}

/** Generate a 3–5 question class quiz with answers (projector + read aloud). */
export async function classroomClassQuiz(subject: string, topic: string, classLevel: string): Promise<ClassQuiz> {
  return invoke<ClassQuiz>('classroom_class_quiz', { subject, topic, classLevel })
}

/** On-demand teacher command: 'class' = explain to everyone, 'simpler' = re-explain
 *  for a named student, 'prerequisites' = what the class must already know. */
export async function classroomExplain(
  subject: string, topic: string, classLevel: string,
  mode: 'class' | 'simpler' | 'prerequisites', studentName?: string,
): Promise<string> {
  return invoke<string>('classroom_explain', { subject, topic, classLevel, mode, studentName: studentName ?? null })
}

// ── Offline speech-to-text (Phase 4 push-to-talk) ─────

/** Is voice input usable right now? False when the Whisper engine/recorder is
 *  missing or free RAM is under the 6 GB voice budget (text-only fallback). */
export async function sttAvailable(): Promise<boolean> {
  if (!isTauri) return false
  return invoke<boolean>('stt_available')
}

/** Start recording the microphone (spacebar pressed). */
export async function sttStart(): Promise<void> {
  return invoke('stt_start')
}

/** Stop recording and transcribe; returns the transcript for teacher preview. */
export async function sttStop(): Promise<string> {
  return invoke<string>('stt_stop')
}

/** Discard the current recording. */
export async function sttCancel(): Promise<void> {
  return invoke('stt_cancel')
}

// ── Utility ───────────────────────────────────────────

export { isTauri }
