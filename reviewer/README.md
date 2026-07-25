# `reviewer/` — Online curriculum review portal

A small website you send to academic reviewers. They read the checklist, page
through the generated training examples, mark each one **Accurate** or **Needs
correction**, and submit. Responses land in a database; you pull them back into
`dataset/reviews.json` so the existing sign-off ledger stays the single source of
truth.

**Stack:** Cloudflare Pages (static site + API functions) + D1 (SQLite).
Free tier, no server to run, and D1 never pauses for inactivity.

```
reviewer/
├── public/
│   ├── index.html      the reviewer-facing app (one file, no build step)
│   └── dataset.json    generated — the examples being reviewed
├── functions/api/      Pages Functions: /api/submit, /api/progress, /api/verdicts
├── schema.sql          D1 tables
├── wrangler.toml       Pages + D1 binding (paste your database_id once)
└── package.json        convenience scripts
```

---

## One-time setup

You need a free Cloudflare account. Everything below runs from this folder.

### 0. Authenticate

Either browser OAuth **or** an API token. The token route is more reliable (it is
also what CI would use), and it sidesteps the OAuth cookie errors some browsers
produce — see [Troubleshooting](#troubleshooting-authentication).

```bash
cd reviewer
npx wrangler login          # option A: browser OAuth
```

**Option B — API token (recommended).** In the Cloudflare dashboard go to
**My Profile → API Tokens → Create Token → Create Custom Token** and grant:

| Type | Resource | Permission |
| --- | --- | --- |
| Account | Cloudflare Pages | Edit |
| Account | D1 | Edit |
| Account | Account Settings | Read |

Then, in the terminal you will run wrangler from:

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
npx wrangler whoami          # should print your account
```

Add that `export` to `~/.bashrc` so it persists. **Never commit the token.**

### 1. Create the database

```bash
npx wrangler d1 create skoolbox-reviews
```

Copy the printed `database_id` into `wrangler.toml` (replace
`PASTE_DATABASE_ID_HERE`). It is not a secret — commit it.

### 2. Create the tables

```bash
npx wrangler d1 execute skoolbox-reviews --file=schema.sql --remote
```

### 3. Export the dataset the reviewers will see

```bash
cd .. && python3 training/review.py export && cd reviewer
```

Writes `public/dataset.json`. **Re-run this and redeploy whenever dataset content
changes** — the site is static, so the examples travel with it.

### 4. Deploy

```bash
npx wrangler pages deploy public --project-name=skoolbox-review
```

You get a URL like `https://skoolbox-review.pages.dev`. Test it before wiring up
the domain.

### 5. Protect the export endpoint

`/api/verdicts` returns every response, so gate it with a token:

```bash
npx wrangler pages secret put ADMIN_TOKEN --project-name=skoolbox-review
```

Enter any long random string and keep it — you pass it to `review.py pull`.
(Without the secret set, the endpoint stays open; set it before sharing the URL.)

### 6. Point `review.skoolbox.xyz` at it

In the Cloudflare dashboard: **Workers & Pages → skoolbox-review → Custom
domains → Set up a custom domain →** enter `review.skoolbox.xyz`.

If `skoolbox.xyz` is already on Cloudflare DNS, the record is created for you and
is live in a minute. If the domain is registered elsewhere, add a `CNAME` for
`review` pointing to `skoolbox-review.pages.dev` at your DNS provider.

---

## Running a review round

**Send reviewers the URL.** No login, no account — they enter their name, email
and institution on the first screen, which is stored with every verdict so
sign-off is attributable.

**Watch progress** any time:

```bash
curl https://review.skoolbox.xyz/api/progress | python3 -m json.tool
```

**Pull the results into the ledger** when reviewers are done:

```bash
python3 training/review.py pull --url https://review.skoolbox.xyz --token YOUR_ADMIN_TOKEN --dry-run
python3 training/review.py pull --url https://review.skoolbox.xyz --token YOUR_ADMIN_TOKEN
```

How verdicts become a ledger status:

| What reviewers did | Ledger status |
| --- | --- |
| every example marked accurate | `approved` |
| any example marked inaccurate | `changes_requested`, with their notes attached |
| only some examples reviewed | skipped (still pending) |

Then check and commit:

```bash
python3 training/review.py status
git add dataset/reviews.json && git commit -m "chore(dataset): reviewer sign-off"
```

**The integrity guarantee:** every verdict stores a SHA-256 of the file content
it was cast against. If a file changes after review, `pull` ignores those stale
verdicts and `status` shows the file as STALE. An approval can never silently
cover content that has since changed.

---

## Local development

```bash
npx wrangler d1 execute skoolbox-reviews --file=schema.sql --local   # once
npx wrangler pages dev public                                        # http://localhost:8788
```

The local run uses a local SQLite file, so you can submit test reviews freely
without touching production data. Inspect them with:

```bash
npx wrangler d1 execute skoolbox-reviews --local \
  --command "SELECT reviewer_name, file_path, accurate, inaccurate FROM submissions"
```

---

## Troubleshooting authentication

**`npx wrangler login` fails with `request_forbidden` / "No CSRF value available
in the session cookie".** The browser dropped the session cookie wrangler set at
the start of the OAuth handshake. Common causes: strict privacy settings or a
cookie blocker, the callback opening in a *different* browser from the one that
began the flow, or a stale half-finished attempt.

Fixes, in order of how reliably they work:

1. **Use an API token instead** (step 0, Option B). This avoids OAuth entirely
   and is the recommended path.
2. Clear the stale state and retry, pasting the printed URL into the browser you
   are already signed into Cloudflare with:
   ```bash
   npx wrangler logout
   rm -rf ~/.config/.wrangler
   npx wrangler login
   ```
3. Try a normal window rather than private/incognito, and disable cookie-blocking
   extensions for `dash.cloudflare.com` during the login.

Check what wrangler thinks it is authenticated as at any time:

```bash
npx wrangler whoami
```

## Notes

- **Privacy:** reviewer names and emails are stored in your D1 database only.
  The page is marked `noindex`, but anyone with the link can submit a review —
  fine for a small invited panel. If you need real access control, put
  Cloudflare Access in front of the Pages project.
- **Cost:** comfortably inside the free tier (5 M D1 row reads/day, 100 k
  writes/day; a full 427-example review round is a few hundred writes).
- **The offline path still exists.** `python3 training/review.py packet` builds
  the printable HTML packet for reviewers who prefer paper or have poor
  connectivity; record those with `review.py sign`. Both routes write to the same
  ledger.
