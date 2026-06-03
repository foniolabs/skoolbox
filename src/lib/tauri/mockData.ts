/**
 * Mock data returned when running in browser (npm run dev without Tauri).
 * Mirrors the shapes returned by the Rust backend commands.
 */

import type {
  Student, Subject, Topic, Question, StudentProgress,
  ClassOverview, AILesson, TtsSettings,
} from './commands'

export const mockStudents: Student[] = [
  { id: 's1', full_name: 'Amina Johnson', class_level: 'Pry 5', avatar_url: null, streak_days: 12, total_points: 2450, created_at: '2026-01-15' },
  { id: 's2', full_name: 'David Okonkwo', class_level: 'Pry 5', avatar_url: null, streak_days: 5, total_points: 1820, created_at: '2026-01-15' },
  { id: 's3', full_name: 'Grace Peters', class_level: 'Pry 6', avatar_url: null, streak_days: 18, total_points: 3100, created_at: '2026-01-15' },
  { id: 's4', full_name: 'Samuel Kehinde', class_level: 'Pry 6', avatar_url: null, streak_days: 3, total_points: 980, created_at: '2026-01-15' },
  { id: 's5', full_name: 'Fatima Bello', class_level: 'JSS1', avatar_url: null, streak_days: 8, total_points: 1650, created_at: '2026-01-15' },
]

export const mockSubjects: Subject[] = [
  { id: 'maths-pry5', name: 'Mathematics', icon: 'calculator', class_level: 'Pry 5', description: 'Pry 5 Mathematics' },
  { id: 'maths-pry6', name: 'Mathematics', icon: 'calculator', class_level: 'Pry 6', description: 'Pry 6 Mathematics' },
  { id: 'maths-jss1', name: 'Mathematics', icon: 'calculator', class_level: 'JSS1', description: 'JSS1 Mathematics' },
  { id: 'maths-jss2', name: 'Mathematics', icon: 'calculator', class_level: 'JSS2', description: 'JSS2 Mathematics' },
  { id: 'eng-pry5', name: 'English', icon: 'book-open', class_level: 'Pry 5', description: 'Pry 5 English' },
  { id: 'eng-pry6', name: 'English', icon: 'book-open', class_level: 'Pry 6', description: 'Pry 6 English' },
  { id: 'eng-jss1', name: 'English', icon: 'book-open', class_level: 'JSS1', description: 'JSS1 English' },
  { id: 'eng-jss2', name: 'English', icon: 'book-open', class_level: 'JSS2', description: 'JSS2 English' },
  { id: 'sci-pry5', name: 'Basic Science', icon: 'flask-conical', class_level: 'Pry 5', description: 'Pry 5 Basic Science' },
  { id: 'sci-jss1', name: 'Basic Science', icon: 'flask-conical', class_level: 'JSS1', description: 'JSS1 Basic Science' },
  { id: 'sci-jss2', name: 'Basic Science', icon: 'flask-conical', class_level: 'JSS2', description: 'JSS2 Basic Science' },
  { id: 'soc-pry5', name: 'Social Studies', icon: 'globe', class_level: 'Pry 5', description: 'Pry 5 Social Studies' },
]

export const mockTopics: Record<string, Topic[]> = {
  'maths-pry5': [
    { id: 'maths-pry5-t1', subject_id: 'maths-pry5', name: 'Whole Numbers', description: 'Place value, ordering, and rounding', sort_order: 1, is_locked: false, is_taught: true, estimated_minutes: 35 },
    { id: 'maths-pry5-t2', subject_id: 'maths-pry5', name: 'Addition and Subtraction', description: 'Adding and subtracting large numbers', sort_order: 2, is_locked: false, is_taught: true, estimated_minutes: 30 },
    { id: 'maths-pry5-t3', subject_id: 'maths-pry5', name: 'Multiplication and Division', description: 'Multiplying and dividing by 2-digit numbers', sort_order: 3, is_locked: false, is_taught: true, estimated_minutes: 35 },
    { id: 'maths-pry5-t4', subject_id: 'maths-pry5', name: 'Fractions', description: 'Proper fractions and simple operations', sort_order: 4, is_locked: false, is_taught: true, estimated_minutes: 40 },
  ],
  'maths-jss2': [
    { id: 'maths-jss2-t1', subject_id: 'maths-jss2', name: 'Number Bases', description: 'Converting between number bases', sort_order: 1, is_locked: false, is_taught: true, estimated_minutes: 45 },
    { id: 'maths-jss2-t2', subject_id: 'maths-jss2', name: 'Fractions and Decimals', description: 'Operations with fractions and decimals', sort_order: 2, is_locked: false, is_taught: true, estimated_minutes: 40 },
    { id: 'maths-jss2-t3', subject_id: 'maths-jss2', name: 'Algebraic Expressions', description: 'Simplifying and evaluating expressions', sort_order: 3, is_locked: false, is_taught: true, estimated_minutes: 50 },
    { id: 'maths-jss2-t4', subject_id: 'maths-jss2', name: 'Linear Equations', description: 'Solving linear equations', sort_order: 4, is_locked: false, is_taught: true, estimated_minutes: 45 },
    { id: 'maths-jss2-t5', subject_id: 'maths-jss2', name: 'Geometry', description: 'Properties of shapes', sort_order: 5, is_locked: true, is_taught: false, estimated_minutes: 50 },
    { id: 'maths-jss2-t6', subject_id: 'maths-jss2', name: 'Statistics', description: 'Mean, median, mode', sort_order: 6, is_locked: true, is_taught: false, estimated_minutes: 40 },
  ],
  'eng-jss1': [
    { id: 'eng-jss1-t1', subject_id: 'eng-jss1', name: 'Parts of Speech', description: 'Nouns, verbs, adjectives, adverbs', sort_order: 1, is_locked: false, is_taught: true, estimated_minutes: 40 },
    { id: 'eng-jss1-t2', subject_id: 'eng-jss1', name: 'Sentence Structure', description: 'Subject, predicate, types of sentences', sort_order: 2, is_locked: false, is_taught: true, estimated_minutes: 35 },
    { id: 'eng-jss1-t3', subject_id: 'eng-jss1', name: 'Comprehension', description: 'Reading passages and answering questions', sort_order: 3, is_locked: false, is_taught: true, estimated_minutes: 45 },
    { id: 'eng-jss1-t4', subject_id: 'eng-jss1', name: 'Composition', description: 'Descriptive and narrative essay writing', sort_order: 4, is_locked: false, is_taught: true, estimated_minutes: 50 },
  ],
}

export const mockQuestions: Question[] = [
  { id: 'q1', topic_id: 'maths-jss2-t4', question_text: 'Solve for x: 2x + 5 = 15', question_type: 'mcq', options: '["x = 3", "x = 5", "x = 7", "x = 10"]', correct_answer: 'x = 5', explanation: 'Subtract 5 from both sides: 2x = 10. Divide by 2: x = 5.', difficulty: 2 },
  { id: 'q2', topic_id: 'maths-jss2-t4', question_text: 'Solve for x: 3x - 7 = 14', question_type: 'mcq', options: '["x = 7", "x = 3", "x = 21", "x = 5"]', correct_answer: 'x = 7', explanation: 'Add 7 to both sides: 3x = 21. Divide by 3: x = 7.', difficulty: 2 },
  { id: 'q3', topic_id: 'maths-jss2-t4', question_text: 'Solve for y: 5y + 3 = 28', question_type: 'mcq', options: '["y = 4", "y = 5", "y = 6", "y = 7"]', correct_answer: 'y = 5', explanation: 'Subtract 3: 5y = 25. Divide by 5: y = 5.', difficulty: 2 },
  { id: 'q4', topic_id: 'maths-jss2-t4', question_text: 'What is the value of x if 4x = 36?', question_type: 'mcq', options: '["x = 6", "x = 8", "x = 9", "x = 12"]', correct_answer: 'x = 9', explanation: 'Divide both sides by 4: x = 36/4 = 9.', difficulty: 1 },
  { id: 'q5', topic_id: 'maths-jss2-t4', question_text: 'Solve: x/3 + 4 = 10', question_type: 'mcq', options: '["x = 18", "x = 2", "x = 6", "x = 12"]', correct_answer: 'x = 18', explanation: 'Subtract 4: x/3 = 6. Multiply by 3: x = 18.', difficulty: 3 },
  { id: 'q6', topic_id: 'eng-jss1-t1', question_text: 'Which word is a noun in: "The boy runs fast"?', question_type: 'mcq', options: '["The", "boy", "runs", "fast"]', correct_answer: 'boy', explanation: 'A noun names a person, place, or thing. "Boy" names a person.', difficulty: 1 },
  { id: 'q7', topic_id: 'eng-jss1-t1', question_text: 'What part of speech is "beautiful" in "She is beautiful"?', question_type: 'mcq', options: '["Noun", "Verb", "Adjective", "Adverb"]', correct_answer: 'Adjective', explanation: 'An adjective describes a noun or pronoun.', difficulty: 1 },
  { id: 'q8', topic_id: 'eng-jss1-t1', question_text: 'Identify the verb: "The students studied hard for the exam."', question_type: 'mcq', options: '["students", "studied", "hard", "exam"]', correct_answer: 'studied', explanation: 'A verb shows action. "Studied" shows the action performed.', difficulty: 1 },
  { id: 'q9', topic_id: 'eng-jss1-t1', question_text: 'Which is an adverb in: "She sings beautifully"?', question_type: 'mcq', options: '["She", "sings", "beautifully", "None"]', correct_answer: 'beautifully', explanation: 'An adverb modifies a verb. "Beautifully" tells how she sings.', difficulty: 2 },
  { id: 'q10', topic_id: 'eng-jss1-t1', question_text: 'What is the pronoun in: "He gave it to them"?', question_type: 'mcq', options: '["He, it, them", "gave, to", "He only", "it only"]', correct_answer: 'He, it, them', explanation: 'Pronouns replace nouns. He, it, and them are all pronouns.', difficulty: 2 },
]

export const mockStudentProgress: Record<string, StudentProgress[]> = {
  's1': [
    { id: 'sp1', student_id: 's1', topic_id: 'maths-jss2-t1', status: 'completed', score: 85, time_spent_seconds: 1200, last_accessed: '2026-03-25', mastery_level: 'mastered' },
    { id: 'sp2', student_id: 's1', topic_id: 'maths-jss2-t2', status: 'completed', score: 72, time_spent_seconds: 900, last_accessed: '2026-03-24', mastery_level: 'working_towards' },
    { id: 'sp3', student_id: 's1', topic_id: 'maths-jss2-t3', status: 'completed', score: 90, time_spent_seconds: 1500, last_accessed: '2026-03-23', mastery_level: 'mastered' },
    { id: 'sp4', student_id: 's1', topic_id: 'eng-jss1-t1', status: 'completed', score: 65, time_spent_seconds: 800, last_accessed: '2026-03-22', mastery_level: 'working_towards' },
    { id: 'sp5', student_id: 's1', topic_id: 'eng-jss1-t2', status: 'in_progress', score: 40, time_spent_seconds: 600, last_accessed: '2026-03-21', mastery_level: 'needs_attention' },
    { id: 'sp6', student_id: 's1', topic_id: 'eng-jss1-t3', status: 'completed', score: 88, time_spent_seconds: 1100, last_accessed: '2026-03-20', mastery_level: 'mastered' },
  ],
  's2': [
    { id: 'sp7', student_id: 's2', topic_id: 'maths-jss2-t1', status: 'completed', score: 55, time_spent_seconds: 1000, last_accessed: '2026-03-25', mastery_level: 'working_towards' },
    { id: 'sp8', student_id: 's2', topic_id: 'maths-jss2-t2', status: 'completed', score: 42, time_spent_seconds: 800, last_accessed: '2026-03-24', mastery_level: 'needs_attention' },
    { id: 'sp9', student_id: 's2', topic_id: 'eng-jss1-t1', status: 'completed', score: 78, time_spent_seconds: 1200, last_accessed: '2026-03-23', mastery_level: 'working_towards' },
    { id: 'sp10', student_id: 's2', topic_id: 'eng-jss1-t2', status: 'in_progress', score: 35, time_spent_seconds: 500, last_accessed: '2026-03-22', mastery_level: 'needs_attention' },
  ],
  's3': [
    { id: 'sp11', student_id: 's3', topic_id: 'maths-jss2-t1', status: 'completed', score: 95, time_spent_seconds: 1400, last_accessed: '2026-03-25', mastery_level: 'mastered' },
    { id: 'sp12', student_id: 's3', topic_id: 'maths-jss2-t2', status: 'completed', score: 92, time_spent_seconds: 1300, last_accessed: '2026-03-24', mastery_level: 'mastered' },
    { id: 'sp13', student_id: 's3', topic_id: 'maths-jss2-t3', status: 'completed', score: 88, time_spent_seconds: 1600, last_accessed: '2026-03-23', mastery_level: 'mastered' },
    { id: 'sp14', student_id: 's3', topic_id: 'eng-jss1-t1', status: 'completed', score: 90, time_spent_seconds: 1000, last_accessed: '2026-03-22', mastery_level: 'mastered' },
    { id: 'sp15', student_id: 's3', topic_id: 'eng-jss1-t2', status: 'completed', score: 85, time_spent_seconds: 1100, last_accessed: '2026-03-21', mastery_level: 'mastered' },
  ],
  's4': [
    { id: 'sp16', student_id: 's4', topic_id: 'maths-jss2-t1', status: 'completed', score: 38, time_spent_seconds: 700, last_accessed: '2026-03-25', mastery_level: 'needs_attention' },
    { id: 'sp17', student_id: 's4', topic_id: 'maths-jss2-t2', status: 'in_progress', score: 30, time_spent_seconds: 400, last_accessed: '2026-03-24', mastery_level: 'needs_attention' },
    { id: 'sp18', student_id: 's4', topic_id: 'eng-jss1-t1', status: 'completed', score: 52, time_spent_seconds: 900, last_accessed: '2026-03-23', mastery_level: 'working_towards' },
  ],
  's5': [
    { id: 'sp19', student_id: 's5', topic_id: 'maths-jss2-t1', status: 'completed', score: 70, time_spent_seconds: 1100, last_accessed: '2026-03-25', mastery_level: 'working_towards' },
    { id: 'sp20', student_id: 's5', topic_id: 'maths-jss2-t2', status: 'completed', score: 80, time_spent_seconds: 1000, last_accessed: '2026-03-24', mastery_level: 'mastered' },
    { id: 'sp21', student_id: 's5', topic_id: 'eng-jss1-t1', status: 'completed', score: 68, time_spent_seconds: 950, last_accessed: '2026-03-23', mastery_level: 'working_towards' },
    { id: 'sp22', student_id: 's5', topic_id: 'eng-jss1-t2', status: 'in_progress', score: 45, time_spent_seconds: 600, last_accessed: '2026-03-22', mastery_level: 'needs_attention' },
  ],
}

export const mockClassOverview: ClassOverview = {
  total_students: 5,
  average_score: 68,
  mastered_count: 2,
  working_towards_count: 2,
  needs_attention_count: 1,
  total_work_assigned: 22,
}

export const mockAiLessons: AILesson[] = [
  { id: 'al1', teacher_command: 'Teach algebraic expressions', subject: 'Mathematics', class_level: 'JSS2', mode: 'whiteboard', lesson_data: '{}', duration_seconds: 300, created_at: '2026-03-25' },
  { id: 'al2', teacher_command: 'Explain parts of speech', subject: 'English', class_level: 'JSS1', mode: 'slideshow', lesson_data: '{}', duration_seconds: 240, created_at: '2026-03-24' },
  { id: 'al3', teacher_command: 'Teach the solar system', subject: 'Basic Science', class_level: 'JSS2', mode: 'narrated', lesson_data: '{}', duration_seconds: 360, created_at: '2026-03-19' },
]

export const mockTtsSettings: TtsSettings = {
  voice: 'Ezinne',
  speed: '1.0',
  azure_key: '',
  azure_region: 'westeurope',
}

const mockSettings: Record<string, string> = {
  school_name: 'SkoolBox Demo School',
  tts_voice: 'Ezinne',
  tts_speed: '1.0',
  offline_mode: 'false',
  azure_tts_region: 'westeurope',
  claude_api_key: '',
  azure_tts_key: '',
}

export function getMockSetting(key: string): string | null {
  return mockSettings[key] ?? null
}

export function setMockSetting(key: string, value: string): void {
  mockSettings[key] = value
}
