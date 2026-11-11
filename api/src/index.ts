import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";
import {
  COOKIE_NAME,
  burnPasswordCheck,
  clearedCookie,
  hashPassword,
  hashToken,
  newSessionToken,
  sessionCookie,
  verifyPassword,
} from "./auth";

type Env = { DATABASE_URL: string; ALLOWED_ORIGINS: string; COOKIE_DOMAIN?: string };
type Role = "admin" | "teacher" | "student";
type SessionUser = {
  id: string;
  school_id: string;
  username: string;
  full_name: string;
  role: Role;
  student_id: string | null;
};
type Vars = { sql: NeonQueryFunction<false, false>; user: SessionUser };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const allowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// ── CORS + CSRF ────────────────────────────────────────────────────────────
app.use("*", (c, next) =>
  cors({
    origin: (origin) => (allowedOrigins(c.env).includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 600,
  })(c, next),
);

// Browsers always send Origin on cross-site writes; refuse any that isn't ours.
app.use("*", async (c, next) => {
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(c.req.method);
  const origin = c.req.header("Origin");
  if (unsafe && origin && !allowedOrigins(c.env).includes(origin)) {
    return c.json({ error: "Origin not allowed" }, 403);
  }
  await next();
});

app.use("*", async (c, next) => {
  c.set("sql", neon(c.env.DATABASE_URL));
  await next();
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

const cookieOpts = (c: Ctx) => ({
  secure: new URL(c.req.url).protocol === "https:",
  domain: new URL(c.req.url).hostname.endsWith("skoolbox.xyz") ? c.env.COOKIE_DOMAIN || undefined : undefined,
});

async function startSession(c: Ctx, userId: string) {
  const sql = c.get("sql");
  const { token, tokenHash, expiresAt } = await newSessionToken();
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt.toISOString()})`;
  c.header("Set-Cookie", sessionCookie(token, expiresAt, cookieOpts(c)), { append: true });
}

const toPublic = (u: SessionUser) => ({
  id: u.id,
  username: u.username,
  full_name: u.full_name,
  role: u.role,
  student_id: u.student_id,
  school_id: u.school_id,
});

// ── Guards ─────────────────────────────────────────────────────────────────
async function requireUser(c: Ctx, next: Next) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return c.json({ error: "Please sign in." }, 401);
  const rows = await c.get("sql")`
    SELECT u.id, u.school_id, u.username, u.full_name, u.role, u.student_id, s.status AS student_status
    FROM sessions se
    JOIN users u ON u.id = se.user_id
    LEFT JOIN students s ON s.id = u.student_id
    WHERE se.token_hash = ${await hashToken(token)} AND se.expires_at > now()`;
  const row = rows[0];
  if (!row || row.student_status === "suspended") {
    return c.json({ error: "Please sign in." }, 401);
  }
  const { student_status: _ignored, ...user } = row;
  c.set("user", user as SessionUser);
  await next();
}

const requireTeacher = async (c: Ctx, next: Next) => {
  const role = c.get("user").role;
  if (role !== "teacher" && role !== "admin") return c.json({ error: "Teachers only." }, 403);
  await next();
};

const requireStudent = async (c: Ctx, next: Next) => {
  if (c.get("user").role !== "student" || !c.get("user").student_id) {
    return c.json({ error: "Students only." }, 403);
  }
  await next();
};

// ── Validation helpers ─────────────────────────────────────────────────────
const username = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores");
const password = z.string().min(8, "Password must be at least 8 characters").max(200);
const name = z.string().trim().min(1).max(120);

async function body<T extends z.ZodTypeAny>(c: Ctx, schema: T): Promise<z.infer<T> | Response> {
  const raw = await c.req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
  }
  return parsed.data;
}
const isResponse = (v: unknown): v is Response => v instanceof Response;
const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";
const uuid = z.string().uuid();

// ── Health ─────────────────────────────────────────────────────────────────
app.get("/health", async (c) => {
  await c.get("sql")`SELECT 1`;
  return c.json({ status: "ok" });
});

// ── Auth ───────────────────────────────────────────────────────────────────
// Creates a school and its first teacher account in one step.
app.post("/auth/register-school", async (c) => {
  const data = await body(
    c,
    z.object({ schoolName: name, fullName: name, username, password }),
  );
  if (isResponse(data)) return data;
  const hash = await hashPassword(data.password);
  try {
    const rows = await c.get("sql")`
      WITH s AS (INSERT INTO schools (name) VALUES (${data.schoolName}) RETURNING id)
      INSERT INTO users (school_id, username, password_hash, full_name, role)
      SELECT id, ${data.username}, ${hash}, ${data.fullName}, 'teacher' FROM s
      RETURNING id, school_id, username, full_name, role, student_id`;
    await startSession(c, rows[0].id);
    return c.json({ user: toPublic(rows[0] as SessionUser) }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: "That username is taken." }, 409);
    throw e;
  }
});

app.post("/auth/login", async (c) => {
  const data = await body(c, z.object({ username: z.string().trim().min(1), password: z.string().min(1) }));
  if (isResponse(data)) return data;
  const sql = c.get("sql");
  const bad = () => c.json({ error: "Incorrect username or password." }, 401);

  const rows = await sql`
    SELECT u.id, u.school_id, u.username, u.full_name, u.role, u.student_id, u.password_hash,
           u.failed_attempts, u.locked_until, s.status AS student_status
    FROM users u LEFT JOIN students s ON s.id = u.student_id
    WHERE lower(u.username) = lower(${data.username})`;
  const u = rows[0];
  if (!u) {
    await burnPasswordCheck(data.password);
    return bad();
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    return c.json({ error: "Too many wrong attempts. Try again in a few minutes." }, 429);
  }
  const ok = await verifyPassword(data.password, u.password_hash);
  if (!ok) {
    await sql`
      UPDATE users SET
        failed_attempts = CASE WHEN failed_attempts + 1 >= ${MAX_FAILED} THEN 0 ELSE failed_attempts + 1 END,
        locked_until = CASE WHEN failed_attempts + 1 >= ${MAX_FAILED}
                            THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE locked_until END
      WHERE id = ${u.id}`;
    return bad();
  }
  if (u.student_status === "suspended") {
    return c.json({ error: "This account has been suspended. Please contact your teacher." }, 403);
  }
  await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${u.id}`;
  await startSession(c, u.id);
  return c.json({ user: toPublic(u as SessionUser) });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token) await c.get("sql")`DELETE FROM sessions WHERE token_hash = ${await hashToken(token)}`;
  c.header("Set-Cookie", clearedCookie(cookieOpts(c)), { append: true });
  return c.json({ ok: true });
});

app.get("/auth/me", requireUser, (c) => c.json({ user: toPublic(c.get("user")) }));

app.post("/auth/change-password", requireUser, async (c) => {
  const data = await body(c, z.object({ currentPassword: z.string().min(1), newPassword: password }));
  if (isResponse(data)) return data;
  const sql = c.get("sql");
  const me = c.get("user");
  const [row] = await sql`SELECT password_hash FROM users WHERE id = ${me.id}`;
  if (!row || !(await verifyPassword(data.currentPassword, row.password_hash))) {
    return c.json({ error: "Current password is incorrect." }, 400);
  }
  await sql`UPDATE users SET password_hash = ${await hashPassword(data.newPassword)} WHERE id = ${me.id}`;
  // Sign out every other device; keep this one.
  const token = getCookie(c, COOKIE_NAME);
  await sql`DELETE FROM sessions WHERE user_id = ${me.id} AND token_hash <> ${await hashToken(token!)}`;
  return c.json({ ok: true });
});

// ── Students (teachers manage their own school's students) ─────────────────
app.get("/students", requireUser, requireTeacher, async (c) => {
  const rows = await c.get("sql")`
    SELECT s.id, s.full_name, s.class_level, s.status, s.streak_days, s.total_points,
           s.created_at, u.username
    FROM students s LEFT JOIN users u ON u.student_id = s.id
    WHERE s.school_id = ${c.get("user").school_id}
    ORDER BY s.class_level, s.full_name`;
  return c.json({ students: rows });
});

app.post("/students", requireUser, requireTeacher, async (c) => {
  const data = await body(
    c,
    z.object({ fullName: name, classLevel: z.string().trim().min(1).max(20), username, password }),
  );
  if (isResponse(data)) return data;
  const hash = await hashPassword(data.password);
  try {
    const rows = await c.get("sql")`
      WITH st AS (
        INSERT INTO students (school_id, full_name, class_level)
        VALUES (${c.get("user").school_id}, ${data.fullName}, ${data.classLevel}) RETURNING id
      )
      INSERT INTO users (school_id, username, password_hash, full_name, role, student_id)
      SELECT ${c.get("user").school_id}, ${data.username}, ${hash}, ${data.fullName}, 'student', id FROM st
      RETURNING id, username, full_name, student_id`;
    return c.json({ student: rows[0] }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: "That username is taken." }, 409);
    throw e;
  }
});

app.patch("/students/:id", requireUser, requireTeacher, async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Not found" }, 404);
  const data = await body(
    c,
    z.object({
      fullName: name.optional(),
      classLevel: z.string().trim().min(1).max(20).optional(),
      status: z.enum(["active", "suspended"]).optional(),
    }),
  );
  if (isResponse(data)) return data;
  const sql = c.get("sql");
  const rows = await sql`
    UPDATE students SET
      full_name = COALESCE(${data.fullName ?? null}, full_name),
      class_level = COALESCE(${data.classLevel ?? null}, class_level),
      status = COALESCE(${data.status ?? null}, status),
      updated_at = now()
    WHERE id = ${id.data} AND school_id = ${c.get("user").school_id}
    RETURNING id, full_name, class_level, status`;
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  if (data.status === "suspended") {
    await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE student_id = ${id.data})`;
  }
  return c.json({ student: rows[0] });
});

app.delete("/students/:id", requireUser, requireTeacher, async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Not found" }, 404);
  const rows = await c.get("sql")`
    DELETE FROM students WHERE id = ${id.data} AND school_id = ${c.get("user").school_id} RETURNING id`;
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ── Curriculum (shared by every school; read-only) ─────────────────────────
app.get("/subjects", requireUser, async (c) => {
  const level = c.req.query("classLevel");
  const rows = level
    ? await c.get("sql")`SELECT * FROM subjects WHERE class_level = ${level} ORDER BY name`
    : await c.get("sql")`SELECT * FROM subjects ORDER BY class_level, name`;
  return c.json({ subjects: rows });
});

app.get("/subjects/:id/topics", requireUser, async (c) => {
  const rows = await c.get("sql")`
    SELECT t.id, t.subject_id, t.name, t.description, t.sort_order, t.estimated_minutes,
           COALESCE(st.is_locked, true) AS is_locked, COALESCE(st.is_taught, false) AS is_taught
    FROM topics t
    LEFT JOIN school_topic_state st ON st.topic_id = t.id AND st.school_id = ${c.get("user").school_id}
    WHERE t.subject_id = ${c.req.param("id")}
    ORDER BY t.sort_order`;
  return c.json({ topics: rows });
});

app.get("/topics/:id/lessons", requireUser, async (c) => {
  const rows = await c.get("sql")`
    SELECT * FROM lessons WHERE topic_id = ${c.req.param("id")} ORDER BY sort_order`;
  return c.json({ lessons: rows });
});

app.get("/topics/:id/questions", requireUser, async (c) => {
  const rows = await c.get("sql")`
    SELECT id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty
    FROM questions WHERE topic_id = ${c.req.param("id")}`;
  return c.json({ questions: rows });
});

// ── Progress and quizzes ───────────────────────────────────────────────────
app.put("/me/progress", requireUser, requireStudent, async (c) => {
  const data = await body(
    c,
    z.object({
      topicId: z.string().min(1),
      status: z.enum(["not_started", "in_progress", "completed"]),
      score: z.number().min(0).max(100),
      timeSpentSeconds: z.number().int().min(0).max(86_400).default(0),
    }),
  );
  if (isResponse(data)) return data;
  const mastery = data.score >= 80 ? "mastered" : data.score >= 50 ? "developing" : "needs_attention";
  try {
    await c.get("sql")`
      INSERT INTO student_progress (student_id, topic_id, status, score, time_spent_seconds, mastery_level, last_accessed)
      VALUES (${c.get("user").student_id}, ${data.topicId}, ${data.status}, ${data.score},
              ${data.timeSpentSeconds}, ${mastery}, now())
      ON CONFLICT (student_id, topic_id) DO UPDATE SET
        status = EXCLUDED.status, score = EXCLUDED.score, mastery_level = EXCLUDED.mastery_level,
        time_spent_seconds = student_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
        last_accessed = now()`;
  } catch (e) {
    if ((e as { code?: string }).code === "23503") return c.json({ error: "Unknown topic." }, 400);
    throw e;
  }
  return c.json({ ok: true, mastery_level: mastery });
});

app.get("/me/progress", requireUser, requireStudent, async (c) => {
  const rows = await c.get("sql")`
    SELECT topic_id, status, score, time_spent_seconds, mastery_level, last_accessed
    FROM student_progress WHERE student_id = ${c.get("user").student_id}`;
  return c.json({ progress: rows });
});

app.post("/me/quiz-attempts", requireUser, requireStudent, async (c) => {
  const data = await body(
    c,
    z.object({
      subjectId: z.string().optional(),
      topicId: z.string().optional(),
      quizType: z.string().min(1).max(40),
      totalQuestions: z.number().int().min(1).max(500),
      correctAnswers: z.number().int().min(0),
      timeTakenSeconds: z.number().int().min(0).optional(),
      questionsData: z.unknown().optional(),
    }),
  );
  if (isResponse(data)) return data;
  if (data.correctAnswers > data.totalQuestions) {
    return c.json({ error: "correctAnswers cannot exceed totalQuestions" }, 400);
  }
  // The score is worked out here so a student can't submit a score that doesn't match.
  const score = (data.correctAnswers / data.totalQuestions) * 100;
  try {
    const rows = await c.get("sql")`
      INSERT INTO quiz_attempts (student_id, subject_id, topic_id, quiz_type, total_questions,
                                 correct_answers, score, time_taken_seconds, questions_data)
      VALUES (${c.get("user").student_id}, ${data.subjectId ?? null}, ${data.topicId ?? null}, ${data.quizType},
              ${data.totalQuestions}, ${data.correctAnswers}, ${score}, ${data.timeTakenSeconds ?? null},
              ${data.questionsData === undefined ? null : JSON.stringify(data.questionsData)}::jsonb)
      RETURNING id, score`;
    return c.json({ attempt: rows[0] }, 201);
  } catch (e) {
    if ((e as { code?: string }).code === "23503") return c.json({ error: "Unknown subject or topic." }, 400);
    throw e;
  }
});

// Teacher views: one student's progress, and the class overview.
app.get("/students/:id/progress", requireUser, requireTeacher, async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Not found" }, 404);
  const sql = c.get("sql");
  const [student] = await sql`
    SELECT id, full_name, class_level, status FROM students
    WHERE id = ${id.data} AND school_id = ${c.get("user").school_id}`;
  if (!student) return c.json({ error: "Not found" }, 404);
  const progress = await sql`
    SELECT topic_id, status, score, time_spent_seconds, mastery_level, last_accessed
    FROM student_progress WHERE student_id = ${id.data}`;
  const attempts = await sql`
    SELECT id, subject_id, topic_id, quiz_type, total_questions, correct_answers, score, created_at
    FROM quiz_attempts WHERE student_id = ${id.data} ORDER BY created_at DESC LIMIT 50`;
  return c.json({ student, progress, attempts });
});

app.get("/class-overview", requireUser, requireTeacher, async (c) => {
  const rows = await c.get("sql")`
    SELECT s.class_level,
           count(*)::int AS students,
           COALESCE(round(avg(q.avg_score)::numeric, 1), 0)::float AS average_score,
           count(*) FILTER (WHERE q.avg_score >= 80)::int AS strong,
           count(*) FILTER (WHERE q.avg_score >= 50 AND q.avg_score < 80)::int AS developing,
           count(*) FILTER (WHERE q.avg_score < 50)::int AS needs_attention
    FROM students s
    LEFT JOIN (SELECT student_id, avg(score) AS avg_score FROM quiz_attempts GROUP BY student_id) q
           ON q.student_id = s.id
    WHERE s.school_id = ${c.get("user").school_id} AND s.status = 'active'
    GROUP BY s.class_level ORDER BY s.class_level`;
  return c.json({ classes: rows });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
