# Coordination Board — MLB Live PBP (LIVPBP)

Shared task board for parallel agent sessions. Read this before claiming work.
Statuses: `unclaimed` · `in progress` · `needs review` · `done`.
A `needs review` item is published on the **Flagged for Review** page (`flagged.html`) and does
not block anything.

Branch convention: `session-<id>/<task>`. This session works on the Arena-managed branch
`arena/7e3aaa61-livpbp` (branch name fixed by the platform; treated as this session's branch).

| Task | Status | Session ID | Branch | File scope | Notes |
| --- | --- | --- | --- | --- | --- |
| T1 — Audit repo, restore missing static assets so the GitHub Pages site works | in progress | 7e3aaa61 | `arena/7e3aaa61-livpbp` | `assets/**`, `COORDINATION.md` | Claimed 2026-11-20. Root cause found: every HTML page references `assets/css/style.css` and `assets/js/*.js`, none of which exist in the upload. |
| T2 — Flagged for Review page | unclaimed | — | — | `flagged.html` | Owner: T1 session will take this after T1 (documented hand-off below). |
| T3 — Verification report + tests | unclaimed | — | — | `tests/**`, `docs/verification-report.md` | Owner: T1 session. |
| T4 — Final integration: merge, re-verify, publish to Pages | unclaimed | — | — | merge only | Owner: T1 session (only one session present; no other remote branches exist). |

## Log

### 2026-11-20 — session 7e3aaa61 — claim

- Reviewed the repo at `aef1a74` ("Add files via upload"). Files present: `index.html`,
  `game.html`, `reviews.html`, `404.html`, `README.md`, `server.mjs`, `LICENSE`, `.gitignore`.
- **Irregularity (blocking, fixed here):** all three content pages load
  `assets/css/style.css`, `assets/js/api.js`, `assets/js/ui.js`, `assets/js/reviews.js`,
  `assets/js/feed-log.js`, `assets/js/scoreboard.js`, `assets/js/reviews-feed.js`,
  `assets/js/props.js` and `assets/js/game.js`. The `assets/` directory is absent from the
  upload, so GitHub Pages serves 404s for CSS and JS and the pages render as unstyled empty
  shells. This is the single cause of the site not working.
- **Irregularity:** `README.md` documents `docs/` and `tools/` (verification report, compliance
  notes, 15 test scripts) and a tag `v1.0.0-stable-checkpoint`; none of them exist in the upload,
  and the upstream project (`buffedlizard55-lab/MLB-Live-PBP`, linked as the live demo) returns
  404 on GitHub, so the original sources cannot be recovered byte-for-byte. Reconstructed
  modules are therefore a re-implementation against the pages' own DOM contract plus the official
  MLB StatsAPI, not the original source. Published on `flagged.html`.
- Claim: T1/T2/T3/T4, scope `assets/**`, `flagged.html`, `tests/**`, `COORDINATION.md`,
  `.nojekyll`, and one small edit per HTML page (footer links only). No other sessions or remote
  branches are active (`git ls-remote --heads` shows only `main`).
