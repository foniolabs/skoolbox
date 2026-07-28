-- SkoolBox reviewer portal — D1 (SQLite) schema.
--
-- Two tables:
--   submissions — one row per reviewer per file submitted (who, when, summary)
--   verdicts    — one row per example reviewed (the actual accurate/inaccurate call)
--
-- Apply with:
--   npx wrangler d1 execute skoolbox-reviews --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS submissions (
  id             TEXT PRIMARY KEY,
  reviewer_name  TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  affiliation    TEXT,
  file_path      TEXT NOT NULL,
  file_sha256    TEXT NOT NULL,
  total          INTEGER NOT NULL,   -- examples in the file at review time
  accurate       INTEGER NOT NULL,   -- how many were marked accurate
  inaccurate     INTEGER NOT NULL,
  overall_note   TEXT,
  submitted_at   TEXT NOT NULL       -- ISO-8601 UTC
);

CREATE TABLE IF NOT EXISTS verdicts (
  id             TEXT PRIMARY KEY,
  submission_id  TEXT NOT NULL REFERENCES submissions(id),
  file_path      TEXT NOT NULL,
  file_sha256    TEXT NOT NULL,      -- binds the verdict to exact content reviewed
  line           INTEGER NOT NULL,   -- line number within the .jsonl file
  verdict        TEXT NOT NULL CHECK (verdict IN ('accurate','inaccurate')),
  note           TEXT,
  reviewer_name  TEXT NOT NULL,
  submitted_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verdicts_file     ON verdicts(file_path);
CREATE INDEX IF NOT EXISTS idx_verdicts_sub      ON verdicts(submission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_file  ON submissions(file_path);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(reviewer_email);
