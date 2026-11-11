-- SkoolBox web: schools, accounts, sessions, students, curriculum, progress.
-- Postgres (Neon). Every row a school owns carries school_id, and the API
-- always filters by the signed-in user's school_id.
-- Curriculum tables (subjects..questions) are shared by all schools.

CREATE TABLE IF NOT EXISTS schools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  class_level  text NOT NULL,
  avatar_url   text,
  streak_days  integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS students_school_class_idx ON students (school_id, class_level);

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  username        text NOT NULL,
  password_hash   text NOT NULL,
  full_name       text NOT NULL,
  role            text NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  student_id      uuid REFERENCES students(id) ON DELETE CASCADE,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'student') = (student_id IS NOT NULL))
);
-- One username across the whole platform, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));
CREATE INDEX IF NOT EXISTS users_school_idx ON users (school_id);

-- Only a SHA-256 of the cookie token is stored, never the token itself.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

-- Shared curriculum (ids are text so the desktop seed can be loaded as-is).
CREATE TABLE IF NOT EXISTS subjects (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  icon        text,
  class_level text NOT NULL,
  description text
);
CREATE INDEX IF NOT EXISTS subjects_class_idx ON subjects (class_level);

CREATE TABLE IF NOT EXISTS topics (
  id                text PRIMARY KEY,
  subject_id        text NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  sort_order        integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 30
);
CREATE INDEX IF NOT EXISTS topics_subject_idx ON topics (subject_id, sort_order);

CREATE TABLE IF NOT EXISTS lessons (
  id               text PRIMARY KEY,
  topic_id         text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title            text NOT NULL,
  content_markdown text,
  content_summary  text,
  sort_order       integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lessons_topic_idx ON lessons (topic_id, sort_order);

CREATE TABLE IF NOT EXISTS questions (
  id             text PRIMARY KEY,
  topic_id       text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_text  text NOT NULL,
  question_type  text NOT NULL DEFAULT 'mcq',
  options        jsonb,
  correct_answer text NOT NULL,
  explanation    text,
  difficulty     integer NOT NULL DEFAULT 3
);
CREATE INDEX IF NOT EXISTS questions_topic_idx ON questions (topic_id);

-- Which topics a school's teacher has unlocked / taught (per school, per topic).
CREATE TABLE IF NOT EXISTS school_topic_state (
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  topic_id   text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  is_locked  boolean NOT NULL DEFAULT true,
  is_taught  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (school_id, topic_id)
);

CREATE TABLE IF NOT EXISTS student_progress (
  student_id         uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id           text NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score              real NOT NULL DEFAULT 0,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  mastery_level      text NOT NULL DEFAULT 'needs_attention',
  last_accessed      timestamptz,
  PRIMARY KEY (student_id, topic_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id         text REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id           text REFERENCES topics(id) ON DELETE SET NULL,
  quiz_type          text NOT NULL,
  total_questions    integer NOT NULL,
  correct_answers    integer NOT NULL,
  score              real NOT NULL,
  time_taken_seconds integer,
  questions_data     jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_idx ON quiz_attempts (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS term_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  subject_id    text NOT NULL REFERENCES subjects(id),
  subject_name  text NOT NULL,
  class_level   text NOT NULL,
  term          integer NOT NULL CHECK (term BETWEEN 1 AND 3),
  academic_year text NOT NULL,
  title         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS term_plans_school_idx ON term_plans (school_id, class_level);

CREATE TABLE IF NOT EXISTS term_plan_topics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES term_plans(id) ON DELETE CASCADE,
  week_number      integer NOT NULL,
  topic_name       text NOT NULL,
  topic_id         text REFERENCES topics(id) ON DELETE SET NULL,
  lesson_notes     text,
  objectives       text,
  activities       text,
  duration_minutes integer NOT NULL DEFAULT 40,
  is_ai_generated  boolean NOT NULL DEFAULT false,
  is_taught        boolean NOT NULL DEFAULT false,
  taught_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS term_plan_topics_plan_idx ON term_plan_topics (plan_id, week_number);

CREATE TABLE IF NOT EXISTS ai_lessons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  teacher_command text NOT NULL,
  subject         text,
  class_level     text,
  mode            text NOT NULL,
  lesson_data     jsonb NOT NULL,
  duration_seconds integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_lessons_school_idx ON ai_lessons (school_id, created_at DESC);
