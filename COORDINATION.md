# COORDINATION.md — shared task board

Repo: `snapquast73-boop/LIVPBP` · Site: https://snapquast73-boop.github.io/LIVPBP/
Last updated: 2026-11-20 (session `arena-f7276bda`)

> **How to use this board.** Claim a task by writing your session ID + file scope in the
> row below, commit and push that claim *before* starting work, and never start a task
> another session has claimed. Keep scopes non-overlapping: one session per file set.
> If a task needs a file another session owns, log a request row here instead of editing
> it. `needs review` means the item is published on `flagged.html` and does not block
> anything. A claim older than 60 minutes with no commits may be taken over (note the
> handoff in the log).

## Branch / worktree note (Arena sandbox restriction)

The Arena session that owns this work is bound to the branch **`arena/f7276bda-livpbp`**
(branched from `main` @ `aef1a74`). Arena tracks the session by that branch and forbids
creating or pushing to any other branch, so `session-<id>/<task>` branches are **not**
used here; instead every task below is scoped to a file set on that one branch and
integration is done by a pull request from `arena/f7276bda-livpbp` → `main`.
This deviation from the usual branch-per-session rule is recorded here deliberately.

All pushes: `git pull --rebase origin <branch>` first. Conflicts are resolved in place,
never by discarding another session's work.

---

## Repository audit (2026-11-20) — why the site is not working

`main` @ `aef1a74` ("Add files via upload") contains only:

```
.gitignore  404.html  LICENSE  README.md  game.html  index.html  reviews.html  server.mjs
```

and **nothing else**. Consequences, verified by reading the shipped HTML:

| # | Irregularity | Evidence | Impact |
|---|---|---|---|
| A1 | Entire `assets/` tree missing: `assets/css/style.css` and `assets/js/{api,ui,reviews,feed-log,scoreboard,game,props,reviews-feed}.js` | `index.html` L21/L57-61, `game.html` L24/L90-96, `reviews.html` L24/L117-121 reference them; `find . -type f` shows no `assets/` directory | Every page loads unstyled and inert; deployed page renders only the static shell (confirmed on the live site: the scoreboard is empty and no script runs) |
| A2 | `docs/` referenced by README does not exist (`docs/verification-report.md`, `docs/api-compliance.md`, `docs/scoring-changes.md`, `docs/workflows/pages.yml`, `docs/workflows/smoke.yml`) | README "Project structure", "Notes & etiquette", "Deploy to GitHub Pages" | Documentation/citation links are dead |
| A3 | `tools/*.mjs` test suite referenced by README (17 scripts) does not exist | README "Run it locally" | Self-checks cannot be run |
| A4 | README claims a stable tag `v1.0.0-stable-checkpoint` | README L3-8; `git tag` is empty, repo has 1 commit | Checkpoint instructions cannot work |
| A5 | README's "Live demo" points at `buffedlizard55-lab.github.io/MLB-Live-PBP`; the upstream repo is **404** via the GitHub API (`/repos/buffedlizard55-lab/MLB-Live-PBP`) and GitHub code search for the project name returns 0 results | `curl api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP` → 404 | The original source cannot be re-downloaded; `assets/` must be reconstructed from the contract in the HTML + README |
| A6 | `server.mjs`: `decodeURIComponent(pathname)` can throw on a malformed `%` escape and take the process down; containment test `filePath.startsWith(REPO_DIR)` accepts sibling dirs sharing the prefix | `server.mjs` static handler | Small robustness defects (local server only; Pages never runs it) |
| A7 | `data/` (server persistence store) not covered by `.gitignore` | `.gitignore` | **Fixed** — `data/` added to `.gitignore` |

## Task board

| Task | Status | Session | File scope | Notes |
|---|---|---|---|---|
| T1 Audit repo vs README contract | done | `arena-f7276bda` | `COORDINATION.md` | Table above; sources in `docs/verification-report.md` |
| T2 Rebuild `assets/css/style.css` | in progress | `arena-f7276bda` | `assets/css/style.css` | Dark Gameday-style theme for every class used by the three pages |
| T3 Rebuild `assets/js/api.js` (StatsAPI client) | in progress | `arena-f7276bda` | `assets/js/api.js` | Endpoints exactly as README documents them |
| T4 Rebuild `assets/js/ui.js` (logos, colors, count/runners) | in progress | `arena-f7276bda` | `assets/js/ui.js` | |
| T5 Rebuild `assets/js/reviews.js` (review/ABS parser) | in progress | `arena-f7276bda` | `assets/js/reviews.js` | Official `gameStatus` registry is the source of review types |
| T6 Rebuild `assets/js/feed-log.js` (persistence) | in progress | `arena-f7276bda` | `assets/js/feed-log.js` | localStorage + optional `POST/GET /api/feed-log` + SSE |
| T7 Rebuild `assets/js/scoreboard.js` | in progress | `arena-f7276bda` | `assets/js/scoreboard.js` | `Scoreboard.prevDay/nextDay/pickDate/today` + docs `onclick` targets |
| T8 Rebuild `assets/js/game.js` | in progress | `arena-f7276bda` | `assets/js/game.js` | All `game.html` element IDs |
| T9 Rebuild `assets/js/props.js` (hit forecast) | in progress | `arena-f7276bda` | `assets/js/props.js` | log5 model per README §"Two-sided hit forecast" |
| T10 Rebuild `assets/js/reviews-feed.js` | in progress | `arena-f7276bda` | `assets/js/reviews-feed.js` | `ReplayFeed.prevDay/nextDay/pickDate/today` + filters |
| T11 Fix `server.mjs` crash/containment defects (A6), ignore `data/` (A7) | data/ part done · server.mjs part unclaimed | `arena-f7276bda` | `.gitignore` (done), `server.mjs` (open) | A7 fixed; A6 left flagged as U-3 (server not used by Pages) |
| T12 Verification report + Flagged for Review page | in progress | `arena-f7276bda` | `docs/verification-report.md`, `flagged.html` | Every claim carries an official source link; unverifiable values left blank |
| T13 Integration: PR → `main`, merge, confirm Pages deploy | in progress | `arena-f7276bda` | repo root | PR link + merge result recorded here when done |

## Verification log

| When | Session | What was checked | Official source | Result |
|---|---|---|---|---|
| 2026-11-20 | `arena-f7276bda` | Official game-status registry (review `statusCode`s: `M*`, `N*`, `IH`, `MJ`/`NJ`) | https://statsapi.mlb.com/api/v1/gameStatus | Confirmed: `MF`, `MA`, `MU`, `MM`, `MC`, `MP`, `ME`, `MH`, `MO`, `MD`, `MT`, `MI`, `MB`, … (manager challenges), `IH` "Instant Replay" + `reason:"Review"` |
| 2026-11-20 | `arena-f7276bda` | Schedule shape + `officialDate` / `status` / `teams.*.score` fields | https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-15 | Confirmed (15 games returned; fields as parsed) |
| 2026-11-20 | `arena-f7276bda` | Deployed site currently broken (no `assets/`) | https://snapquast73-boop.github.io/LIVPBP/ | Confirmed: static shell only, scoreboard list empty |

## Request log

_(requests to edit another session's files go here)_

| When | From | To | Request | Status |
|---|---|---|---|---|
| — | — | — | — | — |
