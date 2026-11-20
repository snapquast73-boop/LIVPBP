# COORDINATION.md — shared task board

Repo: `snapquast73-boop/LIVPBP` · Site: https://snapquast73-boop.github.io/LIVPBP/
Updated 2026-11-20 by session **`arena-f7276bda`** (branch `arena/f7276bda-livpbp`).

> **Sessions working this repo.** Three agent sessions restored this site on 2026-11-20:
> `f8d351d0`, `681bfa13` (whose work is on `main` and preserved below, unedited) and
> `arena-f7276bda` (this board, PR #6). This board is the merged board: the first two
> sections are this session's audit and task board, section "Preserved board" is the
> previous board reproduced verbatim, and the merge record at the end explains exactly
> how the two sets of files were combined without discarding anyone's work.

## Branch / worktree note (Arena sandbox restriction)

Arena fixes each session to one branch and forbids creating or pushing to any other, so
the brief's `session-<id>/<task>` branch rule cannot be followed literally. This session's
work lives on **`arena/f7276bda-livpbp`** (from `main` @ `aef1a74`); integration is a pull
request from that branch into `main`. Previous sessions logged the same deviation as F-001.

---

## Repository audit (2026-11-20) — why the site was not working

Base commit `aef1a74` ("Add files via upload") contained only:

```
.gitignore  404.html  LICENSE  README.md  game.html  index.html  reviews.html  server.mjs
```

| # | Irregularity | Evidence | Impact |
|---|---|---|---|
| A1 | Entire `assets/` tree missing (style.css + 8 JS files) | `index.html` L21/L57-61, `game.html` L24/L90-96, `reviews.html` L24/L117-121 reference them; no `assets/` directory exists | Every page loaded unstyled and inert (confirmed on the live site) |
| A2 | `docs/` referenced by README does not exist | README "Project structure", "Notes & etiquette" | Dead documentation links |
| A3 | `tools/*.mjs` suite referenced by README does not exist | README "Run it locally" | Self-checks could not run |
| A4 | README advertises tag `v1.0.0-stable-checkpoint` | `git tag` empty, repo has 1 commit | Revert instruction cannot work |
| A5 | README "Live demo" points at `buffedlizard55-lab.github.io/MLB-Live-PBP`; that repo is **404** via the GitHub API and repo search returns 0 results | `api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP` → 404 | Original source cannot be re-downloaded; `assets/` had to be reconstructed |
| A6 | `server.mjs`: `decodeURIComponent` can throw on a malformed `%` escape (uncaught → process exit); containment test `startsWith(REPO_DIR)` accepts sibling dirs | `server.mjs` static handler | Robustness defects in the local server only (Pages never runs it) |
| A7 | `data/` (server store) not in `.gitignore` | `.gitignore` | **Fixed** — `data/` added |

## Task board (session `arena-f7276bda`)

| Task | Status | Session | File scope | Notes |
|---|---|---|---|---|
| T1 Audit repo vs README contract | done | `arena-f7276bda` | `COORDINATION.md` | Table above |
| T2 Rebuild `assets/css/style.css` | done | `arena-f7276bda` | `assets/css/style.css` | Covers every class on the four pages |
| T3 Rebuild `assets/js/api.js` | done | `arena-f7276bda` | `assets/js/api.js` | Endpoints as README documents them |
| T4 Rebuild `assets/js/ui.js` | done | `arena-f7276bda` | `assets/js/ui.js` | Abbreviations verified vs `/api/v1/teams` |
| T5 Rebuild `assets/js/reviews.js` | done | `arena-f7276bda` | `assets/js/reviews.js` | Types resolved via the official `gameStatus` registry |
| T6 Rebuild `assets/js/feed-log.js` | done | `arena-f7276bda` | `assets/js/feed-log.js` | localStorage + optional server log + SSE |
| T7 Rebuild `assets/js/scoreboard.js` | done | `arena-f7276bda` | `assets/js/scoreboard.js` | 500 ms poll, 125 ms sweep, offseason hint |
| T8 Rebuild `assets/js/game.js` | done | `arena-f7276bda` | `assets/js/game.js` | Includes F-009 per-row source links |
| T9 Rebuild `assets/js/props.js` | done | `arena-f7276bda` | `assets/js/props.js` | Six documented drivers; constants flagged U-2/U-9 |
| T10 Rebuild `assets/js/reviews-feed.js` | done | `arena-f7276bda` | `assets/js/reviews-feed.js` | Filters, score tracker, sound, alerts, scoring changes |
| T11 Fix `server.mjs` crash/containment (A6), ignore `data/` (A7) | A7 done · A6 open | `arena-f7276bda` | `.gitignore` done, `server.mjs` open | A6 published as U-3 (out of scope, unused by Pages) |
| T12 Verification report + Flagged page | needs review | `arena-f7276bda` | `docs/verification-report.md`, `flagged.html` | 12 items flagged (U-1…U-11, I-8) |
| T13 Integration: PR → `main`, merge, confirm Pages | in progress | `arena-f7276bda` | repo root | [#6](https://github.com/snapquast73-boop/LIVPBP/pull/6) |
| T14 Test harness | done | `arena-f7276bda` | `tools/smoke-test.mjs`, `package.json` | `npm test` → 40 passed, 0 failed |
| T15 Merge with `main` (parallel sessions) | done | `arena-f7276bda` | all conflicting files | Section "Merge record" below |

## Verification log (session `arena-f7276bda`)

| When | What was checked | Official source | Result |
|---|---|---|---|
| 2026-11-20 | Review-status registry (`M*`, `N*`, `IH`, `MJ`/`NJ`, `NH`) | https://statsapi.mlb.com/api/v1/gameStatus | Confirmed official wording for every code |
| 2026-11-20 | Schedule shape (`dates[].games[]`, `status`, `teams`, `score`) | https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-15 | Confirmed (15 games) |
| 2026-11-20 | `reviewDetails {isOverturned, inProgress, reviewType, challengeTeamId}` + four real review events (`MJ`, `MD`, `MA`, `NA`) | https://statsapi.mlb.com/api/v1/game/823109/playByPlay | Confirmed |
| 2026-11-20 | Run attribution `runners[].details{isScoringEvent, playIndex}` | https://statsapi.mlb.com/api/v1/game/824466/playByPlay | Confirmed |
| 2026-11-20 | `gameData.review` + `gameData.absChallenges` counters | https://statsapi.mlb.com/api/v1.1/game/824466/feed/live | Confirmed `usedSuccessful/usedFailed/remaining` |
| 2026-11-20 | `os_ruling_pending_primary` / `_prior` event types | https://statsapi.mlb.com/api/v1/eventTypes | Confirmed |
| 2026-11-20 | Official club abbreviations (30 teams) | https://statsapi.mlb.com/api/v1/teams?sportId=1 | Confirmed |
| 2026-11-20 | Deployed site was an inert shell | https://snapquast73-boop.github.io/LIVPBP/ | Confirmed |
| 2026-11-20 | Whole site renders/persists (network-free) | `npm test` | 40 passed, 0 failed |
| 2026-11-20 | Combined checker from the parallel session | `node tools/restoration-check.mjs` | ALL CHECKS PASSED |
| 2026-11-20 | Local server static + feed-log round-trip | `node server.mjs` + curl | All 200, POST→GET OK |

## Merge record (conflict with the parallel sessions' work)

`git merge origin/main` conflicted on every asset file (both sessions created them), the three
page footers, `COORDINATION.md` and `flagged.html`.

Resolution — **nothing was discarded**:

| File(s) | Resolution |
|---|---|
| `assets/css/style.css`, `assets/js/*.js` | This session's implementations kept (superset: all six forecast drivers, documented 500/250/125 ms cadences, ABS + boundary + pending-ruling + scoring-change tracking). |
| `assets/js/game.js` | Kept, **plus** the parallel session's F-009 fixes ported in: per-row official source links on every linescore and box-score row, and absent values rendered as an unverified “–” instead of a substituted label. |
| `404.html` | Parallel session's version kept (root-resolved `<base>` so nested Pages 404 paths style and navigate). |
| `README.md` | Parallel session's version kept (live-demo link now points at this project's Pages site). |
| `index.html`, `game.html`, `reviews.html` | Footer link to `flagged.html` unified to the parallel session's wording. |
| `flagged.html` | This session's page kept as sections 1–4; the parallel session's verification table and F-001…F-009 list preserved verbatim as sections 5–6, with a status note per item (R-1…R-4). |
| `COORDINATION.md` | This file: merged board, with the previous board reproduced verbatim below. |
| `.github/workflows/site-check.yml`, `tools/restoration-check.mjs` | Parallel session's files kept unchanged; the workflow also runs this session's `npm test`. |
| `tools/smoke-test.mjs`, `docs/verification-report.md`, `package.json`, `.nojekyll` | This session's additions, no conflict. |

---

# Preserved board — sessions `681bfa13` / `f8d351d0` (verbatim)

Session ID for this session: `681bfa13` (Arena branch `arena/681bfa13-livpbp`).
Arena fixes this session to that branch, so the per-session `session-<id>/<task>`
branch rule in the task brief cannot be followed literally; all work happens on
`arena/681bfa13-livpbp` and this is logged here as irregularity F-001 (see
`flagged.html`). No other session had claimed any task when this board was
created (the repo contained no COORDINATION.md and a single commit,
`aef1a74 Add files via upload`).

## Diagnosis (verified 2026-11-20)

The uploaded repo is missing every file under `assets/`, plus `docs/` and
`tools/`, that the three HTML pages and `README.md` reference. `git ls-files`
on the base commit lists only: `.gitignore`, `404.html`, `LICENSE`,
`README.md`, `game.html`, `index.html`, `reviews.html`, `server.mjs`.
Every page therefore loads with no CSS and no JavaScript and cannot function.
The original upstream repo (`buffedlizard55-lab/MLB-Live-PBP`, named as the
live demo in `README.md`) returns GitHub API 404 and `git ls-remote` "Repository
not found" as of 2026-11-20, so the missing files cannot be recovered from the
original author; they are reconstructed from the in-repo spec (README + HTML
contracts + `server.mjs` API contract) and verified against the live MLB
StatsAPI. Reconstruction deviations are published on `flagged.html`.

## Tasks

| # | Task | Status | Owner | Files in scope |
|---|------|--------|-------|----------------|
| T1 | Coordination board + diagnosis | done | 681bfa13 | `COORDINATION.md` |
| T2 | Reconstruct shared client/UI (`api.js`, `ui.js`) | done | 681bfa13 | `assets/js/api.js`, `assets/js/ui.js` |
| T3 | Reconstruct review parser + feed log (`reviews.js`, `feed-log.js`) | done | 681bfa13 | `assets/js/reviews.js`, `assets/js/feed-log.js` |
| T4 | Reconstruct pages (`scoreboard.js`, `game.js`, `props.js`, `reviews-feed.js`) + stylesheet | done | 681bfa13 | `assets/css/style.css`, `assets/js/scoreboard.js`, `assets/js/game.js`, `assets/js/props.js`, `assets/js/reviews-feed.js` |
| T5 | Flagged for Review page + footer links + README demo link | done | 681bfa13 | `flagged.html`, footers of `index.html`/`game.html`/`reviews.html`, `README.md` |
| T6 | Local verification (syntax, link check, server smoke test) | done | 681bfa13 | `tools/restoration-check.mjs` |
| T7 | Integration: PR to `main`, merge, confirm GitHub Pages deploy | done | 681bfa13 | (GitHub) |

Rules honoured from the brief: small frequent commits; `git pull --rebase`
before every push; never mark anything verified without an official source
linked; unverified values are left blank and flagged, not inferred.

## Sources used (official only)

- MLB StatsAPI live responses, `https://statsapi.mlb.com/api/v1/schedule`,
  `/api/v1.1/game/{gamePk}/feed/live`, `/api/v1/teams`, `/api/v1/people/{id}/stats`
  (field shapes re-checked 2026-11-20; see `flagged.html` table).
- GitHub REST API for this repo's Pages config:
  `GET https://api.github.com/repos/snapquast73-boop/LIVPBP/pages`
  → legacy build, branch `main`, path `/`, `https://snapquast73-boop.github.io/LIVPBP/`.
- GitHub Pages docs: https://docs.github.com/en/pages

## Log

- 2026-11-20 — 681bfa13: created board, claimed T1–T4. Upstream repo 404
  (verified via `gh api repos/buffedlizard55-lab/MLB-Live-PBP` and
  `git ls-remote`). Own repo Pages already enabled (legacy, `main`, `/`).

- 2026-11-20 — 681bfa13: T2–T6 done. All 9 missing asset files reconstructed
  (assets/css/style.css; assets/js/{api,ui,reviews,feed-log,scoreboard,game,
  props,reviews-feed}.js) plus flagged.html and tools/restoration-check.mjs.
  Verified: `node tools/restoration-check.mjs` ALL CHECKS PASSED (local refs
  exist, JS parses, server.mjs health/feed-log round-trip, 10 static routes
  200). jsdom DOM smoke (stub fetch, verified-shape fixtures): scoreboard,
  game and replay-feed pages all render with no page JS errors. Official
  registries re-checked live 2026-11-20: /api/v1/gameStatus (MJ/NJ/M*/N*/IH)
  and /api/v1/eventTypes (os_ruling_pending_*) — see flagged.html.

### Parallel integration handoff

- `arena/f8d351d0-livpbp` independently reconstructed and tested the missing frontend before discovering overlapping work. [PR #4](https://github.com/snapquast73-boop/LIVPBP/pull/4) had already merged at `e6e0ebfd27e2b70a2e2156aaa64bcf8f2d607117`. The merge into this branch conflicted in the board, README, page HTML and frontend assets. Conflict resolution retains the published implementation, preserving the other session's work. This branch's [PR #3](https://github.com/snapquast73-boop/LIVPBP/pull/3) adds only this handoff and automated checks of the existing smoke test.
- **Needs review — request to the published frontend owner:** add an official MLB source link to each linescore and player-stat row and mark absent values unverified without substituting fallback player labels. The current renderers in `assets/js/game.js` lack row-level links. Also check the nested project 404 stylesheet and home link in `404.html`. These overlapping files were not edited in the handoff. Official comparison sources: [MLB linescore](https://statsapi.mlb.com/api/v1/game/813026/linescore), [MLB box score](https://statsapi.mlb.com/api/v1/game/813026/boxscore), and [GitHub Pages project paths](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#types-of-github-pages-sites).
- Independently checked MLB's [sample schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-10-25&hydrate=probablePitcher), the corresponding [live-feed response](https://statsapi.mlb.com/api/v1.1/game/813026/feed/live), and [structured replay fields](https://statsapi.mlb.com/api/v1/game/813026/playByPlay?fields=allPlays,reviewDetails,isOverturned,reviewType,challengeTeamId). These are historical sample checks, not verification of every MLB record or original-site parity. See [Pages deployment history](https://github.com/snapquast73-boop/LIVPBP/deployments/github-pages) for the published revisions.

- The first pre-push rebase tried to flatten the integration merge and replay PR #4, causing a duplicate-board conflict. Aborted that rebase to retain the resolved merge; used a merge-preserving rebase before pushing.

- 2026-11-20 — 681bfa13: INTEGRATION DONE.
  [PR #4](https://github.com/snapquast73-boop/LIVPBP/pull/4) merged to `main`
  (merge commit `e6e0ebfd27e2b70a2e2156aaa64bcf8f2d607117`, 2026-11-20T22:19:25Z).
  GitHub Pages build for that commit reached status `built`; live site,
  `/flagged.html` and `/assets/js/scoreboard.js` confirmed at
  https://snapquast73-boop.github.io/LIVPBP/ . PR #3 (parallel session
  `f8d351d0`) then merged its handoff + `site-check` workflow on top.
  This session's first PR #5 attempt conflicted with that; resolved by
  rebasing onto `origin/main` and merging both board versions — no other
  session's work discarded (log entry required by the conflict rule).
- 2026-11-20 — 681bfa13: addressed the two "needs review" requests from the
  PR #3 handoff in the follow-up PR: (1) linescore/box-score rows in
  `assets/js/game.js` now carry per-row official StatsAPI source links and
  absent player names render as an unverified blank instead of a
  substituted `Player <id>` label; (2) `404.html` now resolves its
  stylesheet/home link from the project root so nested Pages 404 paths
  still style and navigate correctly.

---

## Final integration record

| Field | Value |
|---|---|
| Branch | `arena/f7276bda-livpbp` |
| Pull request | [#6](https://github.com/snapquast73-boop/LIVPBP/pull/6) — **MERGED** (merge commit, not squash) |
| Merge commit | `9274cab3e68bb585842f12c52b6ae061cb97caa5` |
| Merged at | 2026-11-20T22:24:19Z |
| Site checks on `main` | run 44828682775 → **success** (`test` job + `dom-smoke` job) |
| GitHub Pages build | `pages/builds/latest` → `status: "built"` for commit `9274cab`, duration 50.2 s |
| Live site | https://snapquast73-boop.github.io/LIVPBP/ · `/flagged.html` · `/assets/js/*.js` all serving the rebuilt files |
| Follow-up PR | [#9](https://github.com/snapquast73-boop/LIVPBP/pull/9) — **MERGED** (`395905c4c7f6b9da7c537761f9924a2c89a94422`), corrected the published check counts; Pages build `built` |
| Final `main` state | site checks run 44829042200 → **success**; Pages build for `395905c` → `status: "built"` (78 s) |
| Independent cross-check | session `7e3aaa61`'s suite (`node tests/run-all.mjs`, 3 captured real payloads) run against this implementation: **37 jsdom checks passed**, link-check OK (39 refs), contract-check OK, syntax OK |
| Test suites | `npm test` → 40 passed, 0 failed · `node tools/restoration-check.mjs` → ALL CHECKS PASSED |
| Flagged items | `flagged.html` (U-1…U-11, I-8, plus the preserved F-001…F-009 and R-1…R-4) |

Deployment confirmation detail: the first fetch of a deployed asset right after the build returned the
**previous** session's `scoreboard.js` (GitHub Pages CDN cache), so the live file was re-fetched with a
cache-busting query and matched this branch's implementation (`LIVE_POLL_MS = 500`, `STATUS_SWEEP_MS = 125`,
`renderIfChanged`, `offerRecentDate`). No action needed; CDN entries expire on their own.

## File ownership after this integration (important for later sessions)

The nine front-end assets on `main` (`assets/css/style.css`, `assets/js/*.js`) are the
implementation described above: contract-complete against the pages and README, with the
per-row source links from F-009. **Do not replace them wholesale from another branch** — that
is what caused the conflict this board records. If a later session needs to change behaviour,
send a pull request that edits the specific function and keeps `npm test` (40 checks) and
`node tools/restoration-check.mjs` green. `flagged.html`, `docs/verification-report.md` and
`tools/smoke-test.mjs` are the verification record: extend them, never truncate them.

## Request log

| When | From | To | Request | Status |
|---|---|---|---|---|
| 2026-11-20 | `arena-f7276bda` | owner | Review `flagged.html` U-1…U-11 (model constants, colour palette, headshot URL, cadence, static-hosting limits) | needs review |

### 2026-11-20 — 7e3aaa61 — independent re-verification of the merged rebuild (PR #7)

- After PR #6 (session `f7276bda`) rebuilt the front end on top of the earlier restoration, this
  session re-ran its own harness against `origin/main` **before** merging anything else.
- **One real rendering bug found on `main` and fixed here:** `assets/js/game.js` read team
  names/logos from `gameData.teams.<side>.team`. The official `feed/live` response returns that node
  **flat** (`{id,name,abbreviation,teamName,…,record{…}}`), so the game page header rendered the score
  with no team names and no logos. Confirmed by fetching the unprojected
  `https://statsapi.mlb.com/api/v1.1/game/824638/feed/live` (no `fields` parameter, so the shape cannot
  have been altered by projection) and re-checked with `tests/jsdom-render-test.mjs`, which failed 2
  checks on `main` and passes after the fix (`teamNode()` accepts the flat and the nested shape). The
  nested `team` object is the `/api/v1/schedule` shape, not the feed shape.
- Re-verified against official responses (2026-11-20): schedule hydration + `review` counters
  (15-game slate 2026-08-28); `gameData.review` on 744932 with no `absChallenges` (2024) and
  `absChallenges{usedSuccessful,usedFailed,remaining}` on 824638 (2026); play `reviewDetails`
  (`reviewType:"MI"`, game 824474 play 65); runner `isScoringEvent`/`playIndex`; `gameStatus` registry
  (`IH`, `M*`, `N*`, `MJ`="Player challenge: Pitch Result", `NJ`="Umpire Challenge: Pitch Result");
  `eventTypes` (`os_ruling_pending_primary/_prior`); `people/{id}/stats`; `fields` projection; Pages
  config; upstream 404. Table: `docs/statsapi-field-map.md`.
- **Merged `main` (PR #6) into this branch, resolving conflicts without discarding either side:**
  kept the rebuilt assets, `package.json`, `tools/smoke-test.mjs`, the `site-check` workflow, the
  rebuild report (`docs/verification-report.md`) and the richer `flagged.html`; added this session's
  `tests/**` harness, field map (`docs/statsapi-field-map.md`), flagged sections 7–8 (re-verification
  table + runnable checks), the README restoration note, `.nojekyll`, and the `data/` ignore rule.
  Nothing from PR #3/#4/#5/#6 was deleted or rewritten.
- Harness results on the merged tree: syntax OK · link-check 39 refs OK · contract-check OK
  (`global.X` publication pattern now recognised) · jsdom render **37/37** · `tools/smoke-test.mjs`
  and `tools/restoration-check.mjs` pass. PR: see the link recorded below after merge.

## Session 346299e3 — published-site delivery check

- **Done**, owner `346299e3`, fixed branch `arena/346299e3-livpbp`. Scope: `tests/pages-delivery.mjs`, `.github/workflows/pages-delivery.yml`, this board entry. Check the actual Pages artifact against the deployed revision, independent of fixture tests. Existing client, data, flag-page and integration claims on other branches are left alone. [GitHub Pages configuration](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages) and [deployment history](https://github.com/snapquast73-boop/LIVPBP/deployments/github-pages).

- [PR #12](https://github.com/snapquast73-boop/LIVPBP/pull/12) merged at `9297edc`. The [delivery check on the public site](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44829674676) matched the published revision byte-for-byte, including the project entry point, linked files and nested HTTP 404. [Integration checks](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44829755396) passed. GitHub [canceled the initial post-merge Pages job](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44829754178) when a newer revision was queued; see the [successor build](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44830019464).
- Compared both rows of the public [Reds–Cubs linescore](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=824638) cell by cell: all nine inning values per side and both R/H/E triples match the [official MLB linescore](https://statsapi.mlb.com/api/v1/game/824638/linescore). Both row links point there. Team names and final scores also match the [August 28 schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28). The public [replay feed](https://snapquast73-boop.github.io/LIVPBP/reviews.html) correctly showed zero games for the [November 20 slate](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-20). This is a historical game check and an empty-slate check, not verification of in-game alert timing, all data or exact original-site parity. See [Flagged for Review](https://snapquast73-boop.github.io/LIVPBP/flagged.html) and the sibling session's reference comparison below.

### Session `8a71f704` — supplied reference-site comparison

| Task | Status | Session | File scope |
|---|---|---|---|
| Compare the two user-supplied references with the merged replay feed, and record testable parity gaps and deployment evidence | needs review | `8a71f704` (`arena/8a71f704-livpbp`) | `audit/reference-replay-comparison.md`, this entry only |

Prior integration PRs have already merged. Active claims on sibling branches (in particular `1f908513`) reserve site/verification changes and further integration. This session does not replace shared assets, public navigation, or Pages settings. Report any requested fixes here for the respective owner. Arena fixes the session branch name.

**Status update — needs review (`8a71f704`):** [Reference replay comparison and sources](audit/reference-replay-comparison.md) complete. GitHub reports [PR #7 Pages deployment successful](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44829312831) and [PR #11 build successful](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/1388345095). Site checks and the fixture-based suites passed; the smoke harness logged a scoreboard readiness warning (RR-06). Requests to the frontend/integration owners: guard in-flight results when navigating dates (RR-01), use MLB's pitch number instead of array position (RR-02), surface scoring changes in All (RR-03), add direct official replay links (RR-04), and link this comparison from the public Flagged for Review page. The supplied sites do not agree on all filters and alerts; exact original parity is unverified (RR-03/RR-05). No shared site code or settings changed in this audit.

Audit-only pull request: [#17 — status, checks, and merge result](https://github.com/snapquast73-boop/LIVPBP/pull/17). [Integration handoff on issue #1](https://github.com/snapquast73-boop/LIVPBP/issues/1#issuecomment-7052222793).

Rebase note: PR #12 appended its separate Pages delivery-check claim to the same board location. Preserved both entries when rebasing the audit branch; no application-file conflicts occurred.

### 2026-11-20 — 7e3aaa61 — published (merge + deployment record)

- **PR:** [#7 — Fix the game-page team header (flat feed/live shape) and publish the independent
  verification record](https://github.com/snapquast73-boop/LIVPBP/pull/7)
- **Merged to `main`:** 2026-11-20T22:29:00Z by `gh pr merge 7 --merge`;
  merge commit `5a06fefdf53b2b034b02da3f5d93a26ec301aac8`.
- **Checks before merge:** workflow `Site checks` — `test` and `dom-smoke` both **pass**
  (run 44829071766). Local: `tests/run-all.mjs` 4/4 groups, jsdom render 37/37,
  `tools/smoke-test.mjs` 40/40, `tools/restoration-check.mjs` all checks.
- **GitHub Pages:** build for `5a06fef` reached status **`built`**
  (`https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/1388342052`). Live site verified
  afterwards: `/flagged.html` serves sections 1–8 including this session's V-rows, and
  `/assets/js/game.js` on the live host contains the `teamNode()` fix, i.e. the deployed code is the
  reviewed code.
- **Tag:** `v1.0.0-stable-checkpoint` created on `5a06fef` (annotated), which makes the README's
  `git reset --hard v1.0.0-stable-checkpoint` instruction work (resolves flagged U-5).
- **Corrections to the published page after the merge of PR #6** (claims that had gone stale):
  the preserved F-005/F-006/F-007 rows are now introduced as describing the earlier build and are
  answered by the R-2/R-3 status rows (the current build keeps 500 ms / 250 ms / 125 ms cadences, all
  six forecast drivers and the three-row score tracker — re-checked in the merged sources); the
  mangled link label in R-3 (`people/<built-in function id>/stats`) is fixed to `people/660271/stats`;
  U-5 is marked resolved; `docs/statsapi-field-map.md` no longer calls those behaviours deviations.
- **Nothing is claimed that was not checked.** Items that remain unverifiable from this environment
  are marked as such on `flagged.html` §7 (V-7).
## Session 346299e3 — published-site delivery check

- **In progress**, owner `346299e3`, fixed branch `arena/346299e3-livpbp`. Scope: `tests/pages-delivery.mjs`, `.github/workflows/pages-delivery.yml`, this board entry. Check the actual Pages artifact against the deployed revision, independent of fixture tests. Existing client, data, flag-page and integration claims on other branches are left alone. [GitHub Pages configuration](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages) and [deployment history](https://github.com/snapquast73-boop/LIVPBP/deployments/github-pages).
### Session `8a71f704` — supplied reference-site comparison

| Task | Status | Session | File scope |
|---|---|---|---|
| Compare the two user-supplied references with the merged replay feed, and record testable parity gaps and deployment evidence | needs review | `8a71f704` (`arena/8a71f704-livpbp`) | `audit/reference-replay-comparison.md`, this entry only |

Prior integration PRs have already merged. Active claims on sibling branches (in particular `1f908513`) reserve site/verification changes and further integration. This session does not replace shared assets, public navigation, or Pages settings. Report any requested fixes here for the respective owner. Arena fixes the session branch name.

**Status update — needs review (`8a71f704`):** [Reference replay comparison and sources](audit/reference-replay-comparison.md) complete. GitHub reports [PR #7 Pages deployment successful](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44829312831) and [PR #11 build successful](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/1388345095). Site checks and the fixture-based suites passed; the smoke harness logged a scoreboard readiness warning (RR-06). Requests to the frontend/integration owners: guard in-flight results when navigating dates (RR-01), use MLB's pitch number instead of array position (RR-02), surface scoring changes in All (RR-03), add direct official replay links (RR-04), and link this comparison from the public Flagged for Review page. The supplied sites do not agree on all filters and alerts; exact original parity is unverified (RR-03/RR-05). No shared site code or settings changed in this audit.

Audit-only pull request: [#17 — status, checks, and merge result](https://github.com/snapquast73-boop/LIVPBP/pull/17). [Integration handoff on issue #1](https://github.com/snapquast73-boop/LIVPBP/issues/1#issuecomment-7052222793).

Rebase note: PR #12 appended its separate Pages delivery-check claim to the same board location. Preserved both entries when rebasing the audit branch; no application-file conflicts occurred.

### Follow-up task board — session `arena/24011a61` (2026-11-20)

| Task | Status | Session | File scope | Notes |
|---|---|---|---|---|
| Verify the post-PR #11 integration and record the final deployment/test result | done | `arena/24011a61-livpbp` | `COORDINATION.md` only | Verified the merged tree and deployed Pages output; no app code/assets changed. [PR #11](https://github.com/snapquast73-boop/LIVPBP/pull/11) · [Pages API](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages). |

Official references for this task: [GitHub PR #11](https://github.com/snapquast73-boop/LIVPBP/pull/11), [Pages configuration API](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages), and [GitHub Pages documentation](https://docs.github.com/en/pages).

#### Final verification and deployment record — session `arena/24011a61`

- Verified integrated commit `e175f01f36c1842c37a1aa7e3f7a3316a9818679`; PR #11 merged at 2026-11-20T22:30:29Z. Its `test` and `dom-smoke` checks succeeded. [PR #11](https://github.com/snapquast73-boop/LIVPBP/pull/11) · [workflow run](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44829497949)
- Pages API reported `built` for that commit; configured as legacy deployment from `main` / root. [latest Pages build](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest) · [Pages configuration](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages) · [GitHub Pages publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- Network-free checks on an extracted copy of the integrated tree: `npm test` → 40 passed; `node tools/restoration-check.mjs` → ALL CHECKS PASSED; `node tests/run-all.mjs` → syntax OK, 39 local links OK, contract check OK, jsdom 37/37. [site-check workflow](https://github.com/snapquast73-boop/LIVPBP/blob/main/.github/workflows/site-check.yml) · [test runner](https://github.com/snapquast73-boop/LIVPBP/blob/main/tests/run-all.mjs)
- Fetched the deployed [scoreboard](https://snapquast73-boop.github.io/LIVPBP/), [Replay Feed](https://snapquast73-boop.github.io/LIVPBP/reviews.html), and [Flagged for Review](https://snapquast73-boop.github.io/LIVPBP/flagged.html); each returned rendered content. On 2026-11-20 (offseason), zero scheduled games and zero replay rows were displayed, not treated as a broken request.
- The upload lacked the frontend and the README-named upstream source was unavailable; therefore this is a reconstruction, not byte-for-byte source recovery. Known limits remain on the [Flagged for Review page](https://snapquast73-boop.github.io/LIVPBP/flagged.html); this follow-up makes no unverified claims.
- Follow-up record PR: [#16](https://github.com/snapquast73-boop/LIVPBP/pull/16).
---

## Session `f132969c` — final functional pass (2026-11-20, branch `arena/f132969c-livpbp`)

Claimed tasks (no other session active; previous sessions' work on `main` @ `5a06fef` preserved unedited except the items below):

| Task | Status | File scope |
|---|---|---|
| F132-1 Confirm live site + Pages build for `5a06fef` | done | — (verified via `gh api .../pages/builds/latest` → `built`, and `fetch_page` renders of `/`, `/reviews.html`, `/flagged.html`) |
| F132-2 Fix `server.mjs` crash + containment (A6/U-3) | done | `server.mjs`, `flagged.html` (U-3 status) |
| F132-3 Fix README dead runnable refs (`tools/run-risk-preview.html`, `tools/review-test.mjs`, `tools/model-calibration-report.mjs`, `tools/count-model-derivation.mjs`) | done | `README.md` |
| F132-4 Dedupe `reviews.html` footer Flagged links | done | `reviews.html` |
| F132-5 Full test suite + official-source re-verification | done | — (40/40 smoke, 37/37 render, gameStatus registry re-fetched live) |
| F132-6 PR → merge → confirm Pages → tag `v1.0.0-stable-checkpoint` → record here | in progress | repo root |

Merge-conflict note (2026-11-20): rebasing onto `main` @ `9297edc` (PR #12, session `346299e3`) conflicted in `COORDINATION.md` only — both sessions appended at the same spot. Resolved by keeping both entries verbatim; no other session's work discarded. Their `flagged.html`/`scoreboard.js` changes were taken as-is from `main`.

