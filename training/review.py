#!/usr/bin/env python3
"""Curriculum-reviewer sign-off workflow for the SkoolBox dataset.

The lint (`merge_dataset.py --strict`) catches mechanical problems. This tool
handles the part only a human can do: confirming the CONTENT is accurate and
curriculum-aligned, and recording who confirmed it.

Commands:

    review.py packet   Build a printable HTML review packet (what the reviewer reads)
    review.py sign     Record a sign-off decision in the ledger
    review.py status   Show what is approved / pending / stale
    review.py export   Write the dataset bundle the online reviewer portal serves
    review.py pull     Fetch portal submissions and fold them into the ledger

The ledger is `dataset/reviews.json`. Each entry stores a SHA-256 of the file's
content, so if anyone edits an approved file afterwards, its status
automatically becomes **stale** and it must be reviewed again — sign-off can
never silently drift away from what it approved.

Stdlib only; no dependencies.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import html
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = REPO_ROOT / "dataset"
LEDGER_PATH = DATASET_DIR / "reviews.json"

STATUS_APPROVED = "approved"
STATUS_CHANGES = "changes_requested"
VALID_STATUSES = (STATUS_APPROVED, STATUS_CHANGES)


# ── ledger ───────────────────────────────────────────────────────────────────

def file_hash(path: Path) -> str:
    """SHA-256 of the file's bytes — the fingerprint a sign-off is bound to."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_ledger() -> dict:
    if not LEDGER_PATH.exists():
        return {"reviews": {}}
    try:
        return json.loads(LEDGER_PATH.read_text())
    except json.JSONDecodeError as exc:
        sys.exit(f"{LEDGER_PATH} is not valid JSON ({exc}). Fix or delete it.")


def save_ledger(ledger: dict) -> None:
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")


def rel(path: Path) -> str:
    """Ledger keys are repo-relative POSIX paths, so they are stable across machines."""
    return path.resolve().relative_to(REPO_ROOT).as_posix()


def dataset_files(scope: str | None) -> list[Path]:
    """Every .jsonl under dataset/, optionally filtered by a path substring."""
    files = sorted(p for p in DATASET_DIR.rglob("*.jsonl") if p.is_file())
    if scope:
        files = [p for p in files if scope in rel(p)]
    return files


def file_state(path: Path, ledger: dict) -> tuple[str, dict | None]:
    """Return (state, entry) where state is approved/stale/changes_requested/pending."""
    entry = ledger.get("reviews", {}).get(rel(path))
    if not entry:
        return "pending", None
    if entry.get("sha256") != file_hash(path):
        return "stale", entry
    if entry.get("status") == STATUS_CHANGES:
        return "changes_requested", entry
    return "approved", entry


# ── examples ─────────────────────────────────────────────────────────────────

def read_examples(path: Path) -> list[dict]:
    """Parse one .jsonl file into {line, system, question, answer} records."""
    out = []
    for lineno, raw in enumerate(path.read_text().splitlines(), 1):
        raw = raw.strip()
        if not raw:
            continue
        try:
            msgs = json.loads(raw).get("messages", [])
        except json.JSONDecodeError:
            out.append({"line": lineno, "system": "", "question": "(invalid JSON)",
                        "answer": "This line could not be parsed — run merge_dataset.py --strict."})
            continue
        by_role = {m.get("role"): m.get("content", "") for m in msgs}
        out.append({
            "line": lineno,
            "system": by_role.get("system", ""),
            "question": by_role.get("user", ""),
            "answer": by_role.get("assistant", ""),
        })
    return out


# ── packet ───────────────────────────────────────────────────────────────────

PACKET_CSS = """
:root { --bg:#fff; --fg:#1a1a1a; --muted:#666; --line:#e2e2e2; --accent:#0a7d3f; --warn:#b45309; }
* { box-sizing:border-box; }
body { margin:0; padding:2rem 1.25rem 4rem; background:var(--bg); color:var(--fg);
  font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
.wrap { max-width:52rem; margin:0 auto; }
h1 { font-size:1.6rem; margin:0 0 .25rem; }
.sub { color:var(--muted); margin:0 0 2rem; }
.file { margin:2.5rem 0 1rem; padding:.6rem .9rem; background:#f4f6f5;
  border-left:4px solid var(--accent); border-radius:4px; }
.file h2 { font-size:1.05rem; margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.file .meta { color:var(--muted); font-size:.85rem; margin-top:.2rem; }
.ex { border:1px solid var(--line); border-radius:8px; padding:1rem 1.1rem; margin:1rem 0; }
.ex .ref { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.78rem;
  color:var(--muted); margin-bottom:.5rem; }
.q { font-weight:600; margin:0 0 .6rem; }
.a { margin:0; white-space:pre-wrap; }
.sys { color:var(--muted); font-size:.8rem; margin-top:.7rem; padding-top:.5rem;
  border-top:1px dashed var(--line); }
.checks { margin-top:.8rem; padding-top:.6rem; border-top:1px solid var(--line);
  font-size:.85rem; color:var(--muted); }
.checks label { margin-right:1rem; white-space:nowrap; }
.legend { background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:1rem 1.1rem; }
.legend h3 { margin:.1rem 0 .5rem; font-size:.95rem; }
.legend ul { margin:.3rem 0 0; padding-left:1.1rem; }
.legend code { background:#fff; padding:.1rem .3rem; border-radius:3px; }
@media print {
  body { padding:0; font-size:11pt; }
  .ex { break-inside:avoid; page-break-inside:avoid; }
  .legend { break-after:page; }
}
@media (prefers-color-scheme: dark) {
  :root { --bg:#16181a; --fg:#e8e8e8; --muted:#9a9a9a; --line:#333; }
  .file { background:#1e2224; }
  .legend { background:#2a2418; border-color:#5c4813; }
  .legend code { background:#16181a; }
}
"""


def build_packet(files: list[Path], ledger: dict, out_path: Path, only_pending: bool) -> int:
    shown, total_examples = [], 0
    for path in files:
        state, _ = file_state(path, ledger)
        if only_pending and state == "approved":
            continue
        examples = read_examples(path)
        total_examples += len(examples)
        shown.append((path, state, examples))

    today = _dt.date.today().isoformat()
    parts = [
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
        "<meta name='viewport' content='width=device-width,initial-scale=1'>",
        f"<title>SkoolBox dataset review packet — {today}</title>",
        f"<style>{PACKET_CSS}</style></head><body><div class='wrap'>",
        "<h1>SkoolBox dataset — curriculum review packet</h1>",
        f"<p class='sub'>Generated {today} · {len(shown)} file(s) · {total_examples} example(s)"
        f"{' · pending only' if only_pending else ''}</p>",
        "<div class='legend'><h3>How to use this packet</h3><ul>"
        "<li>Read each example against the checklist in <code>dataset/REVIEW_CHECKLIST.md</code>"
        " — accuracy, curriculum alignment, class level, working shown, Nigerian context.</li>"
        "<li>Note the reference (e.g. <code>maths/jss2/statistics.jsonl:4</code>) of anything wrong.</li>"
        "<li>Then record your decision per file:<br>"
        "<code>python training/review.py sign &lt;file&gt; --reviewer \"Your Name\" --status approved</code><br>"
        "<code>python training/review.py sign &lt;file&gt; --reviewer \"Your Name\" --status changes_requested "
        "--notes \"line 4: wrong LCM\"</code></li>"
        "<li>Editing a file after approval automatically marks it <b>stale</b>, so it comes back for review.</li>"
        "</ul></div>",
    ]

    for path, state, examples in shown:
        badge = {"approved": "already approved", "stale": "⚠ changed since approval — re-review",
                 "changes_requested": "⚠ changes were requested", "pending": "not yet reviewed"}[state]
        parts.append(
            f"<div class='file'><h2>{html.escape(rel(path))}</h2>"
            f"<div class='meta'>{len(examples)} example(s) · {badge}</div></div>"
        )
        for ex in examples:
            parts.append(
                "<div class='ex'>"
                f"<div class='ref'>{html.escape(rel(path))}:{ex['line']}</div>"
                f"<p class='q'>Q{ex['line']}. {html.escape(ex['question'])}</p>"
                f"<p class='a'>{html.escape(ex['answer'])}</p>"
                f"<div class='sys'>System prompt: {html.escape(ex['system'])}</div>"
                "<div class='checks'>"
                "<label>☐ accurate</label><label>☐ on-curriculum</label>"
                "<label>☐ right level</label><label>☐ working shown</label>"
                "<label>☐ Nigerian context</label></div>"
                "</div>"
            )

    parts.append("</div></body></html>")
    out_path.write_text("".join(parts))
    return total_examples


# ── commands ─────────────────────────────────────────────────────────────────

def cmd_packet(args) -> int:
    files = dataset_files(args.scope)
    if not files:
        print("No .jsonl files matched.")
        return 1
    ledger = load_ledger()
    out = Path(args.output).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    count = build_packet(files, ledger, out, args.pending_only)
    print(f"Wrote {out} ({count} examples).")
    print("Open it in a browser; print to PDF if the reviewer prefers paper.")
    return 0


def cmd_sign(args) -> int:
    path = Path(args.file).resolve()
    if not path.exists():
        sys.exit(f"No such file: {args.file}")
    if path.suffix != ".jsonl":
        sys.exit("Sign-off applies to .jsonl dataset files.")
    if args.status not in VALID_STATUSES:
        sys.exit(f"--status must be one of: {', '.join(VALID_STATUSES)}")

    ledger = load_ledger()
    ledger.setdefault("reviews", {})[rel(path)] = {
        "status": args.status,
        "reviewer": args.reviewer,
        "date": args.date or _dt.date.today().isoformat(),
        "sha256": file_hash(path),
        "examples": len(read_examples(path)),
        "notes": args.notes or "",
    }
    save_ledger(ledger)
    print(f"Recorded {args.status} for {rel(path)} by {args.reviewer}.")
    return 0


def cmd_status(args) -> int:
    files = dataset_files(args.scope)
    ledger = load_ledger()
    buckets: dict[str, list[tuple[Path, dict | None]]] = {
        "approved": [], "stale": [], "changes_requested": [], "pending": []}
    total_examples = approved_examples = 0

    for path in files:
        state, entry = file_state(path, ledger)
        buckets[state].append((path, entry))
        n = len(read_examples(path))
        total_examples += n
        if state == "approved":
            approved_examples += n

    label = {"approved": "APPROVED", "stale": "STALE (edited after approval)",
             "changes_requested": "CHANGES REQUESTED", "pending": "PENDING REVIEW"}
    for state in ("pending", "stale", "changes_requested", "approved"):
        rows = buckets[state]
        if not rows:
            continue
        print(f"\n{label[state]} — {len(rows)} file(s)")
        for path, entry in rows:
            suffix = ""
            if entry:
                suffix = f"   [{entry.get('reviewer','?')}, {entry.get('date','?')}]"
                if entry.get("notes"):
                    suffix += f" — {entry['notes']}"
            print(f"  {rel(path)}{suffix}")

    pct = (approved_examples / total_examples * 100) if total_examples else 0.0
    print(f"\nSigned off: {approved_examples}/{total_examples} examples ({pct:.0f}%) "
          f"across {len(files)} file(s).")

    if args.strict and (buckets["pending"] or buckets["stale"] or buckets["changes_requested"]):
        print("\nFAIL (--strict): every dataset file must be approved before a training run.")
        return 1
    return 0


# ── online portal: export / pull ──────────────────────────────────────────────

def cmd_export(args) -> int:
    """Write the JSON bundle the reviewer portal serves (reviewer/public/dataset.json).

    The portal is a static site, so the dataset travels with it — no server-side
    reads of the repo. Re-run this whenever dataset content changes, then redeploy.
    """
    files = dataset_files(args.scope)
    if not files:
        print("No .jsonl files matched.")
        return 1
    ledger = load_ledger()

    bundle_files = []
    total = 0
    for path in files:
        examples = read_examples(path)
        total += len(examples)
        state, entry = file_state(path, ledger)
        parts = rel(path).split("/")  # dataset/<curriculum>/<subject>/<phase>/<class>/<topic>.jsonl
        bundle_files.append({
            "path": rel(path),
            "sha256": file_hash(path),
            "curriculum": parts[1] if len(parts) > 1 else "",
            "subject": parts[2] if len(parts) > 2 else "",
            "class_level": parts[4] if len(parts) > 4 else "",
            "topic": path.stem,
            "ledger_state": state,
            "ledger_reviewer": (entry or {}).get("reviewer", ""),
            "examples": [
                {"line": e["line"], "question": e["question"],
                 "answer": e["answer"], "system": e["system"]}
                for e in examples
            ],
        })

    bundle = {
        "generated": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "example_count": total,
        "file_count": len(bundle_files),
        "files": bundle_files,
    }
    out = Path(args.output).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n")
    size_kb = out.stat().st_size / 1024
    print(f"Wrote {out} — {total} examples in {len(bundle_files)} files ({size_kb:.0f} KB).")
    print("Redeploy the portal to publish it:  cd reviewer && npx wrangler pages deploy public")
    return 0


def cmd_pull(args) -> int:
    """Fetch submissions from the deployed portal and fold them into the ledger.

    A file becomes `approved` only when every example in it was marked accurate
    by at least one reviewer AND none was marked inaccurate; any inaccurate
    verdict makes it `changes_requested`, carrying the reviewers' notes across
    so the writer knows exactly what to fix.
    """
    import urllib.error
    import urllib.request

    url = args.url.rstrip("/") + "/api/verdicts"
    # Cloudflare's bot protection rejects the default "Python-urllib/x.y" agent
    # with a 403 before the request ever reaches our Worker, so identify properly.
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "skoolbox-review/1.0 (+https://github.com/foniolabs/skoolbox)",
    })
    if args.token:
        req.add_header("Authorization", f"Bearer {args.token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        sys.exit(f"Portal returned HTTP {exc.code}: {exc.reason}. "
                 "If it needs a token, pass --token (ADMIN_TOKEN from the Worker).")
    except urllib.error.URLError as exc:
        sys.exit(f"Could not reach {url}: {exc.reason}")

    verdicts = payload.get("verdicts", [])
    if not verdicts:
        print("No submissions yet.")
        return 0

    # Group verdicts by dataset file.
    by_file: dict[str, list[dict]] = {}
    for v in verdicts:
        by_file.setdefault(v.get("file_path", ""), []).append(v)

    ledger = load_ledger()
    ledger.setdefault("reviews", {})
    updated = skipped = 0

    for file_path, rows in sorted(by_file.items()):
        path = REPO_ROOT / file_path
        if not path.exists():
            print(f"  skip (file no longer exists): {file_path}")
            skipped += 1
            continue

        current_hash = file_hash(path)
        # Only honour verdicts cast against the file's CURRENT content.
        fresh = [r for r in rows if r.get("file_sha256") == current_hash]
        if not fresh:
            print(f"  skip (all verdicts predate the current content): {file_path}")
            skipped += 1
            continue

        total_examples = len(read_examples(path))
        reviewed_lines = {r["line"] for r in fresh}
        inaccurate = [r for r in fresh if r.get("verdict") == "inaccurate"]
        reviewers = sorted({r.get("reviewer_name", "") for r in fresh if r.get("reviewer_name")})

        if inaccurate:
            status = STATUS_CHANGES
            notes = "; ".join(
                f"line {r['line']}: {r.get('note') or 'marked inaccurate'}" for r in inaccurate)
        elif len(reviewed_lines) >= total_examples:
            status = STATUS_APPROVED
            notes = "all examples marked accurate via the review portal"
        else:
            print(f"  skip (partial: {len(reviewed_lines)}/{total_examples} reviewed): {file_path}")
            skipped += 1
            continue

        latest = max((r.get("submitted_at", "") for r in fresh), default="")
        ledger["reviews"][file_path] = {
            "status": status,
            "reviewer": ", ".join(reviewers) or "review portal",
            "date": (latest[:10] or _dt.date.today().isoformat()),
            "sha256": current_hash,
            "examples": total_examples,
            "notes": notes,
            "source": "portal",
        }
        updated += 1
        print(f"  {status:18} {file_path}")

    if args.dry_run:
        print(f"\nDRY RUN — would update {updated} file(s), skip {skipped}. Ledger untouched.")
        return 0

    save_ledger(ledger)
    print(f"\nUpdated {updated} file(s) in {LEDGER_PATH.name} ({skipped} skipped).")
    print("Review the changes, then commit the ledger.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)

    p = sub.add_parser("packet", help="build a printable HTML review packet")
    p.add_argument("-o", "--output", default="training/review_packet.html")
    p.add_argument("-s", "--scope", help="only files whose path contains this (e.g. jss1)")
    p.add_argument("--pending-only", action="store_true",
                   help="skip files already approved and unchanged")
    p.set_defaults(func=cmd_packet)

    p = sub.add_parser("sign", help="record a reviewer's decision for one file")
    p.add_argument("file")
    p.add_argument("--reviewer", required=True, help="reviewer's full name")
    p.add_argument("--status", required=True, choices=VALID_STATUSES)
    p.add_argument("--notes", help="required changes / context")
    p.add_argument("--date", help="ISO date (defaults to today)")
    p.set_defaults(func=cmd_sign)

    p = sub.add_parser("status", help="show approved / pending / stale files")
    p.add_argument("-s", "--scope", help="only files whose path contains this")
    p.add_argument("--strict", action="store_true",
                   help="exit non-zero unless every file is approved (pre-training gate)")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("export", help="write the dataset bundle the online portal serves")
    p.add_argument("-o", "--output", default="reviewer/public/dataset.json")
    p.add_argument("-s", "--scope", help="only files whose path contains this")
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("pull", help="fetch portal submissions into the ledger")
    p.add_argument("--url", required=True,
                   help="portal base URL, e.g. https://review.skoolbox.xyz")
    p.add_argument("--token", help="ADMIN_TOKEN if the Worker requires one")
    p.add_argument("--dry-run", action="store_true", help="show changes without writing")
    p.set_defaults(func=cmd_pull)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
