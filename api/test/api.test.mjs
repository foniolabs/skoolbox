// End-to-end test against a running API (npm run dev) and its real database.
// Creates throwaway schools/users/curriculum rows and deletes them afterwards.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.API_URL ?? "http://localhost:8787";
const ORIGIN = "http://localhost:3000";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = existsSync(join(root, ".dev.vars"))
    ? readFileSync(join(root, ".dev.vars"), "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))
    : undefined;
  if (!line) throw new Error("Set DATABASE_URL or create api/.dev.vars");
  return line.slice("DATABASE_URL=".length).trim();
}

const pool = new Pool({ connectionString: databaseUrl() });
const run = Date.now().toString(36);
const tag = `zz-test-${run}`;
const SUBJECT = `${tag}-subj`;
const TOPIC = `${tag}-topic`;

/** Tiny client that keeps its own cookie, like a browser tab. */
function client() {
  let cookie = "";
  return {
    get cookie() { return cookie; },
    async call(method, path, body, headers = {}) {
      const res = await fetch(API + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: ORIGIN,
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
      const text = await res.text();
      return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
    },
  };
}

const PW = "correct-horse-1";
let t1, t2, student1, studentId;

before(async () => {
  await pool.query("INSERT INTO subjects (id, name, class_level) VALUES ($1, 'Test subject', 'Pry 5')", [SUBJECT]);
  await pool.query("INSERT INTO topics (id, subject_id, name) VALUES ($1, $2, 'Test topic')", [TOPIC, SUBJECT]);
});

after(async () => {
  await pool.query("DELETE FROM schools WHERE name LIKE $1", [`${tag}%`]);
  await pool.query("DELETE FROM subjects WHERE id = $1", [SUBJECT]); // cascades to topics
  await pool.end();
});

test("unauthenticated requests are refused", async () => {
  const c = client();
  assert.equal((await c.call("GET", "/auth/me")).status, 401);
  assert.equal((await c.call("GET", "/students")).status, 401);
  assert.equal((await c.call("GET", "/subjects")).status, 401);
});

test("register a school: cookie is HttpOnly + SameSite, and /auth/me works", async () => {
  t1 = client();
  const res = await t1.call("POST", "/auth/register-school", {
    schoolName: `${tag} A`, fullName: "Teacher One", username: `${tag}-t1`, password: PW,
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.user.role, "teacher");
  const set = res.headers.get("set-cookie");
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  assert.equal(JSON.stringify(res.json).includes("password"), false);
  const me = await t1.call("GET", "/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.json.user.username, `${tag}-t1`);
});

test("validation and duplicate usernames", async () => {
  const c = client();
  const short = await c.call("POST", "/auth/register-school", {
    schoolName: `${tag} X`, fullName: "X", username: `${tag}-x`, password: "short",
  });
  assert.equal(short.status, 400);
  const dup = await c.call("POST", "/auth/register-school", {
    schoolName: `${tag} X`, fullName: "X", username: `${tag}-T1`.toUpperCase(), password: PW,
  });
  assert.equal(dup.status, 409);
  // the failed attempt must not leave an orphan school behind
  const orphans = await pool.query("SELECT 1 FROM schools WHERE name = $1", [`${tag} X`]);
  assert.equal(orphans.rowCount, 0);
});

test("wrong password and unknown user look the same; 5 misses lock the account", async () => {
  const c = client();
  const unknown = await c.call("POST", "/auth/login", { username: `${tag}-nobody`, password: PW });
  const wrong = await c.call("POST", "/auth/login", { username: `${tag}-t1`, password: "nope-nope-1" });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.json.error, wrong.json.error);
  for (let i = 0; i < 4; i++) await c.call("POST", "/auth/login", { username: `${tag}-t1`, password: "nope-nope-1" });
  const locked = await c.call("POST", "/auth/login", { username: `${tag}-t1`, password: PW });
  assert.equal(locked.status, 429);
  await pool.query("UPDATE users SET locked_until = NULL, failed_attempts = 0 WHERE lower(username) = $1", [`${tag}-t1`]);
  assert.equal((await c.call("POST", "/auth/login", { username: `${tag}-t1`, password: PW })).status, 200);
});

test("teacher creates a student; student signs in but cannot use teacher routes", async () => {
  const created = await t1.call("POST", "/students", {
    fullName: "Amina Test", classLevel: "Pry 5", username: `${tag}-s1`, password: PW,
  });
  assert.equal(created.status, 201);
  studentId = created.json.student.student_id;
  student1 = client();
  const login = await student1.call("POST", "/auth/login", { username: `${tag}-s1`, password: PW });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.role, "student");
  assert.equal(login.json.user.student_id, studentId);
  assert.equal((await student1.call("GET", "/students")).status, 403);
  assert.equal((await student1.call("POST", "/students", {
    fullName: "Sneaky", classLevel: "Pry 5", username: `${tag}-s2`, password: PW,
  })).status, 403);
});

test("schools cannot see or change each other's students", async () => {
  t2 = client();
  assert.equal((await t2.call("POST", "/auth/register-school", {
    schoolName: `${tag} B`, fullName: "Teacher Two", username: `${tag}-t2`, password: PW,
  })).status, 201);
  const list = await t2.call("GET", "/students");
  assert.equal(list.json.students.length, 0);
  assert.equal((await t2.call("PATCH", `/students/${studentId}`, { status: "suspended" })).status, 404);
  assert.equal((await t2.call("DELETE", `/students/${studentId}`)).status, 404);
  assert.equal((await t2.call("GET", `/students/${studentId}/progress`)).status, 404);
  const mine = await t1.call("GET", "/students");
  assert.equal(mine.json.students.length, 1);
});

test("progress and quiz attempts: server computes the score; teacher can read it", async () => {
  const p = await student1.call("PUT", "/me/progress", { topicId: TOPIC, status: "completed", score: 85, timeSpentSeconds: 120 });
  assert.equal(p.status, 200);
  assert.equal(p.json.mastery_level, "mastered");
  await student1.call("PUT", "/me/progress", { topicId: TOPIC, status: "completed", score: 85, timeSpentSeconds: 30 });
  assert.equal((await student1.call("PUT", "/me/progress", { topicId: "no-such-topic", status: "completed", score: 5 })).status, 400);
  const mine = await student1.call("GET", "/me/progress");
  assert.equal(mine.json.progress[0].time_spent_seconds, 150);

  const bad = await student1.call("POST", "/me/quiz-attempts", { topicId: TOPIC, quizType: "topic_quiz", totalQuestions: 5, correctAnswers: 9 });
  assert.equal(bad.status, 400);
  const ok = await student1.call("POST", "/me/quiz-attempts", {
    subjectId: SUBJECT, topicId: TOPIC, quizType: "topic_quiz", totalQuestions: 4, correctAnswers: 3,
    questionsData: [{ q: 1 }], score: 100, // a client-sent score must be ignored
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.attempt.score, 75);

  const view = await t1.call("GET", `/students/${studentId}/progress`);
  assert.equal(view.status, 200);
  assert.equal(view.json.attempts[0].score, 75);
  const overview = await t1.call("GET", "/class-overview");
  assert.deepEqual(overview.json.classes.map((x) => [x.class_level, x.students, x.average_score]), [["Pry 5", 1, 75]]);
  // a teacher cannot write a student's progress
  assert.equal((await t1.call("PUT", "/me/progress", { topicId: TOPIC, status: "completed", score: 1 })).status, 403);
});

test("curriculum is readable once signed in", async () => {
  const subjects = await student1.call("GET", "/subjects?classLevel=Pry%205");
  assert.ok(subjects.json.subjects.some((s) => s.id === SUBJECT));
  const topics = await student1.call("GET", `/subjects/${SUBJECT}/topics`);
  assert.equal(topics.json.topics[0].is_locked, true);
});

test("cross-site writes are refused", async () => {
  const res = await t1.call("POST", "/students", {
    fullName: "Evil", classLevel: "Pry 5", username: `${tag}-evil`, password: PW,
  }, { Origin: "https://evil.example" });
  assert.equal(res.status, 403);
});

test("changing a password signs out other devices but not this one", async () => {
  const other = client();
  assert.equal((await other.call("POST", "/auth/login", { username: `${tag}-t2`, password: PW })).status, 200);
  const wrong = await t2.call("POST", "/auth/change-password", { currentPassword: "wrong-wrong-1", newPassword: "brand-new-pass-1" });
  assert.equal(wrong.status, 400);
  const ok = await t2.call("POST", "/auth/change-password", { currentPassword: PW, newPassword: "brand-new-pass-1" });
  assert.equal(ok.status, 200);
  assert.equal((await t2.call("GET", "/auth/me")).status, 200);
  assert.equal((await other.call("GET", "/auth/me")).status, 401);
  assert.equal((await client().call("POST", "/auth/login", { username: `${tag}-t2`, password: PW })).status, 401);
  assert.equal((await client().call("POST", "/auth/login", { username: `${tag}-t2`, password: "brand-new-pass-1" })).status, 200);
});

test("suspending a student ends their session and blocks sign-in", async () => {
  const res = await t1.call("PATCH", `/students/${studentId}`, { status: "suspended" });
  assert.equal(res.status, 200);
  assert.equal((await student1.call("GET", "/auth/me")).status, 401);
  const login = await client().call("POST", "/auth/login", { username: `${tag}-s1`, password: PW });
  assert.equal(login.status, 403);
  await t1.call("PATCH", `/students/${studentId}`, { status: "active" });
  assert.equal((await client().call("POST", "/auth/login", { username: `${tag}-s1`, password: PW })).status, 200);
});

test("logout invalidates the session server-side", async () => {
  const c = client();
  await c.call("POST", "/auth/login", { username: `${tag}-t1`, password: PW });
  const saved = c.cookie;
  assert.equal((await c.call("GET", "/auth/me")).status, 200);
  await c.call("POST", "/auth/logout");
  const replay = await fetch(API + "/auth/me", { headers: { Cookie: saved } });
  assert.equal(replay.status, 401);
});

test("passwords are stored hashed, sessions only as a hash", async () => {
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE lower(username) = $1", [`${tag}-t1`]);
  assert.match(rows[0].password_hash, /^pbkdf2\$100000\$/);
  assert.equal(rows[0].password_hash.includes(PW), false);
  const s = await pool.query("SELECT token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE lower(u.username) = $1", [`${tag}-t1`]);
  for (const r of s.rows) assert.match(r.token_hash, /^[0-9a-f]{64}$/);
});
