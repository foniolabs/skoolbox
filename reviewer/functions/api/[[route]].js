/**
 * SkoolBox reviewer portal — API (Cloudflare Pages Functions, backed by D1).
 *
 * Routes:
 *   POST /api/submit    save one reviewer's verdicts for one dataset file
 *   GET  /api/progress  public progress summary (drives the portal's counters)
 *   GET  /api/verdicts  full export for `python training/review.py pull` (token-gated)
 *   GET  /api/health    connectivity check
 *
 * Bindings (see wrangler.toml): DB = D1 database.
 * Secret: ADMIN_TOKEN — required by /api/verdicts. Set it with
 *   npx wrangler pages secret put ADMIN_TOKEN
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const VALID_VERDICTS = new Set(['accurate', 'inaccurate']);
const MAX_NOTE = 2000;
const MAX_VERDICTS = 500; // a single file never has this many examples

/** Trim to a max length; treat blank/non-strings as empty. */
function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function handleSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON.' }, 400);
  }

  const reviewerName = clean(body.reviewer_name, 120);
  const reviewerEmail = clean(body.reviewer_email, 200);
  const affiliation = clean(body.affiliation, 200);
  const filePath = clean(body.file_path, 300);
  const fileSha = clean(body.file_sha256, 64);
  const overallNote = clean(body.overall_note, MAX_NOTE);
  const verdicts = Array.isArray(body.verdicts) ? body.verdicts : [];

  if (!reviewerName || !reviewerEmail) {
    return json({ error: 'Your name and email are required.' }, 400);
  }
  if (!reviewerEmail.includes('@')) {
    return json({ error: 'That email address does not look valid.' }, 400);
  }
  if (!filePath || !fileSha) {
    return json({ error: 'Missing file identification.' }, 400);
  }
  if (verdicts.length === 0) {
    return json({ error: 'No verdicts submitted.' }, 400);
  }
  if (verdicts.length > MAX_VERDICTS) {
    return json({ error: 'Too many verdicts in one submission.' }, 400);
  }

  // Validate every verdict before writing anything.
  const rows = [];
  for (const v of verdicts) {
    const line = Number(v.line);
    const verdict = clean(v.verdict, 20);
    if (!Number.isInteger(line) || line < 1) {
      return json({ error: `Invalid line number: ${v.line}` }, 400);
    }
    if (!VALID_VERDICTS.has(verdict)) {
      return json({ error: `Invalid verdict: ${v.verdict}` }, 400);
    }
    rows.push({ line, verdict, note: clean(v.note, MAX_NOTE) });
  }

  const submissionId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const accurate = rows.filter((r) => r.verdict === 'accurate').length;

  const statements = [
    env.DB.prepare(
      `INSERT INTO submissions
         (id, reviewer_name, reviewer_email, affiliation, file_path, file_sha256,
          total, accurate, inaccurate, overall_note, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      submissionId, reviewerName, reviewerEmail, affiliation, filePath, fileSha,
      rows.length, accurate, rows.length - accurate, overallNote, submittedAt
    ),
    ...rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO verdicts
           (id, submission_id, file_path, file_sha256, line, verdict, note,
            reviewer_name, submitted_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(
        crypto.randomUUID(), submissionId, filePath, fileSha, r.line,
        r.verdict, r.note, reviewerName, submittedAt
      )
    ),
  ];

  // batch() is atomic in D1 — a partial submission can never be stored.
  await env.DB.batch(statements);

  return json({ ok: true, submission_id: submissionId, saved: rows.length });
}

async function handleProgress(env) {
  const { results } = await env.DB.prepare(
    `SELECT file_path,
            COUNT(*)                                  AS submissions,
            SUM(accurate)                             AS accurate,
            SUM(inaccurate)                           AS inaccurate,
            MAX(submitted_at)                         AS last_submitted,
            COUNT(DISTINCT reviewer_email)            AS reviewers
       FROM submissions
      GROUP BY file_path`
  ).all();
  return json({ files: results ?? [] });
}

/** Shared admin gate: true if allowed. When ADMIN_TOKEN is unset, the endpoint
 *  is open (dev convenience) — set the secret before sharing the URL. */
function adminAllowed(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return true;
  const auth = request.headers.get('authorization') || '';
  const q = new URL(request.url).searchParams.get('token');
  return auth === `Bearer ${expected}` || q === expected;
}

async function handleVerdicts(request, env) {
  if (!adminAllowed(request, env)) return json({ error: 'Unauthorized.' }, 401);
  const { results } = await env.DB.prepare(
    `SELECT file_path, file_sha256, line, verdict, note, reviewer_name, submitted_at
       FROM verdicts
      ORDER BY file_path, line, submitted_at`
  ).all();
  return json({ verdicts: results ?? [] });
}

/** Full submission records — reviewer identity + overall notes — for the dashboard. */
async function handleSubmissions(request, env) {
  if (!adminAllowed(request, env)) return json({ error: 'Unauthorized.' }, 401);
  const { results } = await env.DB.prepare(
    `SELECT id, reviewer_name, reviewer_email, affiliation, file_path, file_sha256,
            total, accurate, inaccurate, overall_note, submitted_at
       FROM submissions
      ORDER BY submitted_at DESC`
  ).all();
  return json({ submissions: results ?? [] });
}

export async function onRequest(context) {
  const { request, env } = context;
  const { pathname } = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    if (pathname === '/api/health') {
      return json({ ok: true, time: new Date().toISOString() });
    }
    if (pathname === '/api/submit' && request.method === 'POST') {
      return await handleSubmit(request, env);
    }
    if (pathname === '/api/progress' && request.method === 'GET') {
      return await handleProgress(env);
    }
    if (pathname === '/api/verdicts' && request.method === 'GET') {
      return await handleVerdicts(request, env);
    }
    if (pathname === '/api/submissions' && request.method === 'GET') {
      return await handleSubmissions(request, env);
    }
    return json({ error: 'Not found.' }, 404);
  } catch (err) {
    // Surface the message: this API is internal-facing and debuggability wins.
    return json({ error: `Server error: ${err?.message ?? err}` }, 500);
  }
}
