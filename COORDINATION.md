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

### 2026-11-20 — 7e3aaa61 — final state (all tasks done)

| Task | Status | Evidence |
| --- | --- | --- |
| T1 board + diagnosis | done | this file; flagged I-1/I-2/I-3 |
| T2–T4 assets (session 681bfa13, then rebuilt by f7276bda, extended by later sessions) | done | `assets/**` on `main`; verified by `tests/` + `tools/smoke-test.mjs` |
| V1 verification harness | done | `tests/{link-check,contract-check,jsdom-render-test,run-all}.mjs`, `tests/fixtures/**` |
| V3 verification records | done | `docs/statsapi-field-map.md` (field-by-field, official links), `docs/verification-report.md`, `flagged.html` §1–§8 |
| V4 integration + publish | done | PR #7 (merge `5a06fef`, Pages `built`) and PR #14 (merge `6a5243b`); tag `v1.0.0-stable-checkpoint` on `5a06fef` |
| Final re-verification of the combined tree | done | `node tests/run-all.mjs` 4/4 groups · jsdom render 37/37 · `tools/smoke-test.mjs` 40/40 · `tools/restoration-check.mjs` all checks — run against the exact `origin/main` tree, then again after each merge |

- **Live-site check (2026-11-20, after the builds):** `https://snapquast73-boop.github.io/LIVPBP/`
  serves `/flagged.html` with this session's §7–§8 V-rows and the U-5 resolution, and
  `/assets/js/game.js` on the live host contains the `teamNode()` fix — the deployed files are the
  reviewed files, not a stale revision.
- **Transient Pages errors:** several intermediate `main` commits (0a8e824, 9297edc, 31efd5e, 6a5243b,
  e7154c0, 65fab417, be2ccb2) show `Page build failed` in the Pages builds API while the queue was
  processing 7 deployments in ~5 minutes from parallel sessions. The tree itself is clean (no
  symlinks, no binary/NUL files, no invalid UTF-8, `.nojekyll` present, `tools/smoke-test.mjs` and
  `tests/` green), and a later build published the current content — verified by fetching the live
  pages. No action was required beyond waiting; if it recurs, re-trigger with
  `POST /repos/snapquast73-boop/LIVPBP/pages/builds`.
- **Nothing is left claimed but unfinished.** Items that could not be verified from this environment
  stay marked `Unverified` on `flagged.html` (U-1, U-8, U-9, U-10, U-11, V-7) and are never presented
  as facts anywhere in the app.
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
### 2026-11-20 — f132969c — INTEGRATION DONE

- [PR #13](https://github.com/snapquast73-boop/LIVPBP/pull/13) **MERGED** (merge commit `be2ccb227dcf61ee92ad06b403c03f11ea3e5374`, 2026-11-20T22:37:26Z). Site checks on the PR branch: `test` + `dom-smoke` both **pass**.
- GitHub Pages deploy for `be2ccb2` confirmed live: `https://snapquast73-boop.github.io/LIVPBP/flagged.html` section 8 (W-1…W-4) and the U-3 "Fixed" note are serving on the deployed site (verified via page fetch, since the REST API was rate-limited by parallel sessions at the time — reset 23:07 UTC). `/` and `/reviews.html` render as before.
- Tag `v1.0.0-stable-checkpoint` already exists on the remote (points at `5a06fef`, created by a parallel session) — left untouched, so U-5 is resolved and the README revert instruction works. Not moved to `be2ccb2` to avoid rewriting another session's tag.
- Rebase conflicts during integration were `COORDINATION.md`-only (parallel sessions appending at the same spot: `346299e3`, `8a71f704`, and PRs #14/#16/#18). Each resolved by keeping both entries verbatim; no other session's work discarded. Final task statuses: F132-1…F132-6 all **done**.
- Remaining flagged items for owner review (unchanged, on `flagged.html`): U-1, U-2, U-6, U-7, U-8, U-9, U-10, U-11, I-8, F-001…F-009. U-3 and U-5 are now Fixed.


---

# Session `arena/1f908513-livpbp` — Final Live-StatsAPI & Replay-Audit (`RR-01`–`RR-06`) Integration

- **Session ID:** `1f908513` (branch fixed by Arena to `arena/1f908513-livpbp`, branched from `aef1a74`).
- **Pull Request:** [#21](https://github.com/snapquast73-boop/LIVPBP/pull/21) — **MERGED** at `2026-11-20T22:46:41Z` (merge commit [`f810cee4358a84ea44232bbc016d871fb3cdf037`](https://github.com/snapquast73-boop/LIVPBP/commit/f810cee4358a84ea44232bbc016d871fb3cdf037))
- **CI & GitHub Pages Deployment Result:**
  - PR #21 CI workflow run [`44831584375`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44831584375): `test` **pass** + `dom-smoke` **pass**.
  - Live GitHub Pages deployment verified on `https://snapquast73-boop.github.io/LIVPBP/` for `f810cee`:
    - [`/`](https://snapquast73-boop.github.io/LIVPBP/) — live scoreboard renders offseason slate notice + jump button to `Wed Oct 28, 2026`.
    - [`/game.html?gamePk=824638`](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=824638) — live game header (CIN 10, CHC 8, Wrigley Field, logos, W/L/SV decisions), 9-inning linescore with per-row official StatsAPI source links, official `pitchNumber` numbering across non-pitch timeouts, and `🚨 ABS Pitch Challenge — Overturned` chips all render against live StatsAPI.
    - [`/reviews.html`](https://snapquast73-boop.github.io/LIVPBP/reviews.html) — live Replay Feed renders all 8 summary tiles, filter tabs, and scan status line.
    - [`/flagged.html`](https://snapquast73-boop.github.io/LIVPBP/flagged.html) — live Flagged for Review page serves Section 9 (`1f908513` `L-1..L-4` & `RR-01..RR-06`) and blank confirmed-value cells on all unverified items.
- **Merge conflict resolution log (2026-11-20 UTC):** Merged `origin/main` (`36b8c6b`, incorporating PRs #3–#20 across sessions `681bfa13`, `f8d351d0`, `f7276bda`, `7e3aaa61`, `346299e3`, `8a71f704`, `24011a61`, and `f132969c`) preserving 100% of all prior board entries and merged code verbatim.
- **Official sources verified line by line (2026-11-20):**
  - [`/api/v1/people/682829/stats?stats=season,expectedStatistics`](https://statsapi.mlb.com/api/v1/people/682829/stats?stats=season,expectedStatistics&group=hitting&season=2026) — confirmed `expectedStatistics` exposes xBA in `stat.avg` (`".277"`), not `stat.xba` (`L-1`).
  - [`/api/v1/people/682829/stats?stats=vsPlayer&opposingPlayerId=656849`](https://statsapi.mlb.com/api/v1/people/682829/stats?stats=vsPlayer&group=hitting&opposingPlayerId=656849) & [`/api/v1/people/656849/stats?stats=season,statSplits`](https://statsapi.mlb.com/api/v1/people/656849/stats?stats=season,statSplits&group=pitching&sitCodes=vl,vr&season=2026) — confirmed `vsPlayerTotal`/`vsPlayer` block names and combined `!split.team` rows on multi-club seasons (`L-2`).
  - [`/api/v1/game/823424/boxscore`](https://statsapi.mlb.com/api/v1/game/823424/boxscore) & [`/api/v1/game/824638/playByPlay`](https://statsapi.mlb.com/api/v1/game/824638/playByPlay) — confirmed `boxscore.teams.<side>.players.ID<id>.seasonStats` (`L-3`), PA-ending `MJ` `play.reviewDetails` on plays 36/72/86, and `MF` = "Close play at 1st" (`L-4`).
  - [`/api/v1/game/823243/playByPlay`](https://statsapi.mlb.com/api/v1/game/823243/playByPlay?fields=allPlays,about,atBatIndex,playEvents,pitchNumber,reviewDetails,reviewType) & [`audit/reference-replay-comparison.md`](audit/reference-replay-comparison.md) — addressed all six handoff items (`RR-01`–`RR-06`).
- **Verification performed:** `npm test` → **44/44 passed (0 `jsdomError`s)**; `node tools/restoration-check.mjs` → **ALL CHECKS PASSED**; `node tests/run-all.mjs` → **syntax OK, 40 local refs OK, 8 bindings OK, 37/37 jsdom render checks OK**; programmatic link audit → **73/73 `flagged.html` rows and 58/58 Markdown table rows carry clickable `https://` official source links**, with blank cells on all unconfirmed items.

## Task Board (`arena/1f908513-livpbp`)

| Task ID | Task Description | Status | Owning Session | File Scope |
| --- | --- | --- | --- | --- |
| `S1f-1` | `server.mjs` malformed `%` escape & sibling-directory containment (`A6`/`U-3`) — merged `f132969c` PR #13 fix | `done` | `arena/1f908513-livpbp` | `server.mjs` |
| `S1f-2` | Live-StatsAPI field fixes (`expectedStatistics.avg` xBA, `vsPlayerTotal` H2H, combined `!split.team` splits, `remainingPAs`, `boxscore.seasonStats`, `MF` fallback, `events[last].index`, PA-ending `MJ` counts) | `done` | `arena/1f908513-livpbp` | `assets/js/props.js`, `assets/js/game.js`, `assets/js/reviews.js` |
| `S1f-3` | Replay-audit handoff (`RR-01` `dateSeq` guard, `RR-02` official `pitchNumber`, `RR-03` scoring changes in `All`, `RR-04` direct MLB API row links, `RR-06` smoke-test script readiness) | `done` | `arena/1f908513-livpbp` | `assets/js/reviews-feed.js`, `assets/js/reviews.js`, `assets/js/game.js`, `tools/smoke-test.mjs` |
| `S1f-4` | Per-row official `https://` source links, blank unconfirmed value cells, and `L-1..L-4` + `RR-01..RR-06` tables on `flagged.html` & `docs/*.md` (`RR-05` flagged `needs review`) | `needs review` | `arena/1f908513-livpbp` | `flagged.html`, `docs/verification-report.md`, `docs/statsapi-field-map.md`, `COORDINATION.md` |

---

# Session `d105b565` — functional re-verification & deep links (2026-11-22)

- **Session ID:** `d105b565` · **Branch (fixed by Arena):** `arena/d105b565-livpbp`, branched from `main` @ `59a7351` (merge of PR #22). The brief's `session-<id>/<task>` branch rule cannot be followed literally in this sandbox; logged as `F-001` by every previous session and unchanged here.
- **Board state when this session started:** no open claims. `git status` clean, `main` == `59a7351`, working tree matched `origin/main` exactly. The task board's last entry (`1f908513`) was already merged and deployed, so this session claims the tasks below before writing to any file.

## Claims

| Task | Status | Owning session | File scope |
|---|---|---|---|
| D105-1 Re-verify every StatsAPI field the client reads against the live API (2026-11-22) | done | `d105b565` | `docs/verification-report.md`, `flagged.html` |
| D105-2 `?date=YYYY-MM-DD` deep links + URL sync on the scoreboard and the replay feed | done | `d105b565` | `assets/js/scoreboard.js`, `assets/js/reviews-feed.js`, `tools/smoke-test.mjs` |
| D105-3 Per-row source links must open the request the row is rendered from | done | `d105b565` | `assets/js/game.js` |
| D105-4 Publish findings (D-1…D-4) on the Flagged for Review page | done | `d105b565` | `flagged.html`, `docs/verification-report.md` |
| D105-5 Integration: PR → merge → confirm Pages deploy → record here | done | `d105b565` | `README.md`, `COORDINATION.md` |
| D105-6 Keep `flagged.html` section numbering in order (10 → 11 → 12) | done | `d105b565` | `flagged.html` |

No file owned by another session was edited: every file above was last touched by `f7276bda`
(`flagged.html`, `docs/verification-report.md`), `f132969c`/`1f908513`
(`assets/js/*`, `tools/smoke-test.mjs`) — all of whose tasks are closed on `main`, so nothing was
taken from an open claim.

## What was verified (2026-11-22, live StatsAPI)

| Check | Official source | Result |
|---|---|---|
| 30 club abbreviations vs `UI.TEAM_ABBR` | [`/api/v1/teams?sportId=1`](https://statsapi.mlb.com/api/v1/teams?sportId=1&fields=teams,id,name,abbreviation,teamName&season=2026) | all 30 match |
| Review-code wording vs `FALLBACK_REASONS` (`MA…MV`, `NA…NW`, `MJ`, `NJ`, `MF`, `IH`) | [`/api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) | matches; `MX`/`NX` have no `reason` and none is invented |
| Hydrated schedule card shape | [`/api/v1/schedule?date=2026-10-28&hydrate=…`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-10-28&hydrate=probablePitcher,linescore,decisions,review) | matches `scoreboard.js` reads |
| xBA field (`stat.avg`, not `xba`) | [`people/660271/stats?stats=expectedStatistics`](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=expectedStatistics&group=hitting&season=2026) | `".285"` in `stat.avg` |
| H2H blocks `vsPlayerTotal` + `vsPlayer` | [`people/694192/stats?stats=vsPlayer`](https://statsapi.mlb.com/api/v1/people/694192/stats?stats=vsPlayer&group=hitting&opposingPlayerId=656876) | both present |
| `boxscore…players.ID<id>.seasonStats` | [`game/849799/boxscore`](https://statsapi.mlb.com/api/v1/game/849799/boxscore) | present |
| `os_ruling_pending_primary` / `_prior` | [`/api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes) | both, “Official Scorer Ruling Pending” |
| ABS/manager counters for game 849799 vs the page's chips | [`feed/live gameData.absChallenges`](https://statsapi.mlb.com/api/v1.1/game/849799/feed/live?fields=gameData,absChallenges,hasChallenges,away,home,usedSuccessful,usedFailed,remaining,review,used) | `1 successful / 0 failed / 2 remaining` each side = the two overturned ABS chips printed |
| Deployed game page vs official linescore (game 849799) | [`game/849799/linescore`](https://statsapi.mlb.com/api/v1/game/849799/linescore) · [deployed page](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=849799) | identical (MIL 4-8-2, TB 1-4-0) |
| Deployed scoreboard / replay feed / flagged page render | [site](https://snapquast73-boop.github.io/LIVPBP/) | all render; offseason slate handled |

## Irregularities opened

| # | Item | Status |
|---|---|---|
| D-1 | `/api/v1/game/775296/linescore` reports home `errors: 2`; `/api/v1.1/game/775296/feed/live` reports `3`. The page renders the feed value and does not "correct" it. | Flagged on `flagged.html` §12 — owner decision |
| D-2 | Per-row source links pointed at `/linescore` / `/boxscore` instead of the request the rows are rendered from, so the link could show a different number than the row. | **Fixed** in `assets/js/game.js` |
| D-3 | Original client source still 404 (`buffedlizard55-lab/MLB-Live-PBP`) — the client remains a reconstruction. | Unverified (source missing), §12 |
| D-4 | Club hex palette / hit-model constants — no official value exists. | Unverified, carried from U-1/U-2 |

## Checks

```text
npm ci && npm test               -> 47 passed, 0 failed   (+3 deep-link checks in §[11])
node tests/run-all.mjs           -> syntax OK · 40 local refs OK · 8 bindings OK · 37/37 jsdom
node tools/restoration-check.mjs -> ALL CHECKS PASSED
```

## Integration record

- **[PR #23](https://github.com/snapquast73-boop/LIVPBP/pull/23) — MERGED** at `2026-11-22T01:49:44Z`, merge commit [`1e405cc8fa9c56b5b8fbe4c0c8c76c25a104fb15`](https://github.com/snapquast73-boop/LIVPBP/commit/1e405cc8fa9c56b5b8fbe4c0c8c76c25a104fb15).
- **CI on the PR:** `test` **pass** + `dom-smoke` **pass** ([workflow run 44973199587](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44973199587)).
- **GitHub Pages:** [`pages/builds/latest`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest) → `{"commit":"1e405cc…","status":"built"}`. Publishing source unchanged: `main` / root, legacy build.
- **Deploy verified on the live site (2026-11-22, after the build):**
  - [`/?date=2026-10-28`](https://snapquast73-boop.github.io/LIVPBP/?date=2026-10-28) → renders game 849799 (MIL 4 / TB 1, records 4-1 & 1-4, probables, W/L, Tropicana Field, game 5 of 7) — the deep link works in production.
  - [`/reviews.html?date=2026-10-28`](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-10-28) → “1 game(s) on Wed Oct 28, 2026 · 0 live · **2 tracked entries**”, ABS challenges tile **2** — matches the official `absChallenges` counters (1 successful per side) fetched independently.
  - [`/game.html?gamePk=849799`](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=849799) → linescore identical to the official response, and each row's `source` link now opens `/api/v1.1/game/849799/feed/live` (D-2 fix live).
  - [`/flagged.html`](https://snapquast73-boop.github.io/LIVPBP/flagged.html) → sections 11 (R-1…R-11) and 12 (D-1…D-4) serving.
- Follow-up PR for this record + the section-numbering fix: see the next entry below.

### Post-merge follow-up

- `flagged.html` sections rendered as 11 → 12 → 10 because the new tables were inserted above
  “10. Checks you can run”. **Fixed** by moving them below section 10; numbering is now 1…12 in
  order. Recorded as task `D105-6`.

---

# Session `arena/aa6c1d7b-livpbp` — functional-parity pass vs the cited working sites (2026-11-22)

- **Session ID:** `aa6c1d7b` (Arena fixes this session to branch `arena/aa6c1d7b-livpbp`, branched from `main` @ `59a7351` (merge of PR #22). Arena forbids creating/pushing other branches, so the brief's `session-<id>/<task>` rule cannot be followed literally; same deviation as the previous sessions' F-001.)
- **User's reference sites (reported working):** the Replay Feed on
  [LIVPBP2](https://snapquast73-boop.github.io/LIVPBP2/reviews.html) and
  [POSTSSNALRT](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html). Both are sibling
  uploads of the same lost upstream (`buffedlizard55-lab/MLB-Live-PBP`, 404) restored by other
  sessions; this repo (LIVPBP) is a third, independent restoration already live at
  <https://snapquast73-boop.github.io/LIVPBP/>.

## Task board (`arena/aa6c1d7b-livpbp`)

| Task ID | Description | Status | File scope |
|---|---|---|---|
| `AA6C-1` | Functional-parity fix: honor `?date=YYYY-MM-DD` on Scoreboard + Replay Feed. Independently implemented in `820b7e4`, then superseded by `d105b565`'s merged PR #23 (`b50251a` URL-sync variant, merged 2026-11-22T01:49:44Z while this session was in flight). Merge resolution: `d105b565`'s implementation kept verbatim; this branch carries only the additive regression tests + a complementary README paragraph. | done | `tests/jsdom-render-test.mjs`, `README.md` (JS taken from `main`) |
| `AA6C-2` | Verification pass: `npm test`, `node tests/run-all.mjs`, live fetches of the deployed pages incl. `?date=2026-08-28` | done | — |
| `AA6C-3` | Integration: PR → merge to `main` → confirm GitHub Pages deploy → record here | done | repo root (PR only) |

## Log (`aa6c1d7b`)

- 2026-11-22 — AA6C-1 **superseded by PR #23**: this session independently implemented `?date=` support (commit `820b7e4`: `urlDate()` read at init only; picker/day-nav unchanged), but `main` moved to `1e405cc` (merge of PR #23) while this branch was in flight — `d105b565` had merged a broader variant (`b50251a`: `?date=` honored in `parseDate()`, `history.replaceState` URL sync, picker read directly in `pickDate()`, scoreboard review banner links to `reviews.html?date=<selected>`, `tools/smoke-test.mjs` §[11] ×3 checks) at 2026-11-22T01:49:44Z. Merge resolution: **their JS kept verbatim** (my `urlDate()` hunks removed), nothing of theirs discarded; this branch keeps only (a) 10 jsdom regression checks (§3b) that pass against their implementation — verified locally, and (b) a complementary README deep-link paragraph. `README.md` also documents their file-tree annotations (unchanged).
  - 2026-11-22 — Merge conflict resolution log: `git merge origin/main` conflicted in `COORDINATION.md` only. Auto-merged `assets/js/scoreboard.js` / `reviews-feed.js` / `README.md` initially produced a duplicated mix (my `urlDate()` next to their URL-aware `parseDate()`); the JS was hand-resolved to match `origin/main` exactly, and `COORDINATION.md` kept **both** session sections verbatim (this section updated as above). `tests/jsdom-render-test.mjs` merged cleanly. See below for the combined verification run.
- 2026-11-22 — Audit vs the two cited sites. HTML shells are byte-near-identical (footer wording only). Functional gap found: `parseDate()` in this repo reads only the `date-picker` element; `window.location.search` is never consulted (`assets/js/scoreboard.js:42`, `assets/js/reviews-feed.js:85`). Verified on the live site: `LIVPBP/reviews.html?date=2026-08-28` and `LIVPBP/index.html?date=2026-08-28` render today (offseason, 0 games) instead of 2026-08-28, while `LIVPBP2/index.html?date=2026-08-28` renders all 15 Finals and `LIVPBP2/reviews.html?date=2026-08-28` renders 10 reviews & challenges / 79 ABS challenges for that date. POSTSSNALRT also ignores `?date=` (date-picker navigation only), so `?date=` support is taken from LIVPBP2, the cited site that has it. No other functional deltas found: `game.html?gamePk=` works here (verified live on gamePk 824638: header, linescore + per-row source links, ABS chips), `index.html` offseason slate notice + "Most recent date with games" jump button works (schedule-range endpoint confirmed: games listed through 2026-10-28), `flagged.html` renders.

### 2026-11-22 — aa6c1d7b — INTEGRATION DONE

- [PR #24](https://github.com/snapquast73-boop/LIVPBP/pull/24) **MERGED** at 2026-11-22T01:54:44Z, merge commit [`f22a84b`](https://github.com/snapquast73-boop/LIVPBP/commit/f22a84bfd424bad65a8962d84755d6a76ad5d2b6). Site checks on the PR head (`0336cf2`, then `0336cf2`-equivalent checks on `3d1c31f`): **test PASS + dom-smoke PASS**; the earlier `fb6c945` head also passed.
- **Parallel-session race (important):** PR #23 (`d105b565`, merged 01:49:44Z) landed the same `?date=` fix while this branch was in flight, and PR #25 (`d105b565`, merged ~01:53Z) filled in the PR #23 record. Each `git merge origin/main` conflicted in `COORDINATION.md` only; both were resolved by keeping **both sessions' sections verbatim** (this section updated as above). The JS auto-merge duplicated my `urlDate()` next to their URL-aware `parseDate()` and was hand-resolved to match `origin/main` byte-for-byte — their implementation is live; this branch contributes the §3b regression tests + README paragraph. A stray `git pull --rebase` during the first resolution left the branch mid-rebase with the merge commit already pushed; the rebase was **aborted** (remote branch and PR were never rewritten). No force-push was used at any point.
- **GitHub Pages:** [`pages/builds/latest`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest) → commit `f22a84b`, status **`built`** (confirmed 2026-11-22 ~01:56Z). Publishing source unchanged: `main` / root, legacy build.
- **Live verification (2026-11-22, after the build):**
  - [`/?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/?date=2026-08-28) → all 15 Finals render (CIN 10–8 CHC top card), “15 games · 15 final”.
  - [`/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-08-28) → **10 Reviews · 8 Challenges · 2 Umpire reviews · 79 ABS challenges · 2 runs at risk · 89 tracked entries · 15 games · Fri Aug 28, 2026** — matches the sibling working site LIVPBP2's rendering of the same date (10 reviews & challenges / 79 ABS challenges). Note: an initial fetch of the page served a stale cached render; re-fetch with a cache-buster confirmed the live values above.
  - [`/`](https://snapquast73-boop.github.io/LIVPBP/) → offseason zero-games notice with the “Most recent date with games: Wed Oct 28, 2026 · Show it” jump button (verified against the live range endpoint).
  - [`/game.html?gamePk=824638`](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=824638) → full CIN 10–8 CHC header, linescore with per-row official source links, ABS chips (from PR #23's D-2 fix).
  - [`/flagged.html`](https://snapquast73-boop.github.io/LIVPBP/flagged.html) → renders; sections 1–12 serve.
- **Acceptance vs the user's cited sites:** this repo's Replay Feed and Scoreboard now match the behaviour of the cited working references for the same date — the GitHub Page is functional for uploaded-project review purposes. Remaining open items (unchanged, owner-reviewed on `flagged.html`): U-1, U-2, U-6…U-11, I-8, F-001…F-009, L-1…L-4, RR-05, D-1, D-3, D-4. This PR (#27) carries only this record.

#### Note from session `d105b565` on the same collision (added here, after the entry above)

Session `aa6c1d7b` implemented `?date=` deep links independently while this session was doing the
same thing, and its PR #24 merged after PR #23. Nothing was lost and nothing was overwritten:

- The **implementation** on `main` is this session's (`b50251a`, in `assets/js/scoreboard.js`
  and `assets/js/reviews-feed.js`); `aa6c1d7b` kept it verbatim in `fb6c945` and did not
  re-apply its own copies.
- `aa6c1d7b`'s **additive** work stayed: its 10 jsdom regression checks
  (`tests/jsdom-render-test.mjs` §3b) and its README deep-link bullet.
- Combined state on `main` @ `f22a84b` re-checked by this session: `npm test` → **47 passed,
  0 failed**; `node tests/run-all.mjs` → syntax OK · 40 local refs OK · 8 bindings OK ·
  **47/47 jsdom** (their §3b checks + the original 37). GitHub Pages built `f22a84b`
  ([`pages/builds/latest`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest)).
- Lesson for later sessions: `assets/js/scoreboard.js` and `assets/js/reviews-feed.js` were a
  hot spot twice in one hour — claim them on this board before editing.

---

# Session `arena/ca40f7ec-livpbp` — Non-Overlapping Provenance, Props & Stylesheet Polish (`2026-11-22`)

- **Session ID:** `ca40f7ec` · **Branch (fixed by Arena):** `arena/ca40f7ec-livpbp`, merged with `main` @ [`1e67246`](https://github.com/snapquast73-boop/LIVPBP/commit/1e67246).
- **Coordination & non-overlapping scope check (`2026-11-22`):**
  - Merged sessions `d105b565` (PRs [#23](https://github.com/snapquast73-boop/LIVPBP/pull/23), [#25](https://github.com/snapquast73-boop/LIVPBP/pull/25), [#26](https://github.com/snapquast73-boop/LIVPBP/pull/26)) and `aa6c1d7b` (PRs [#24](https://github.com/snapquast73-boop/LIVPBP/pull/24), [#27](https://github.com/snapquast73-boop/LIVPBP/pull/27)) completed their tasks on `main` (`COORDINATION.md` merge conflict resolved by preserving both sessions' entries verbatim).
  - Active parallel branch `arena/af75fbfd-livpbp` holds claims on `assets/js/{api,ui,reviews,scoreboard,game,reviews-feed,feed-log}.js`, `server.mjs`, `README.md`, `docs/*.md`, `flagged.html`, `tools/smoke-test.mjs`, `tests/jsdom-render-test.mjs`.
  - To respect strict non-overlapping file scopes while `af75fbfd` is in flight, `ca40f7ec` edited **only unclaimed files**: `assets/js/props.js`, `assets/css/style.css`, and additive standalone verification test `tests/props-provenance-test.mjs` (plus append-only coordination notes here). Cross-scope observations for `af75fbfd`'s scope are logged below as handoff notes rather than conflicting edits.

## Task Board (`arena/ca40f7ec-livpbp`)

| Task ID | Task Description | Status | Owning Session | File Scope | Official Source |
| --- | --- | --- | --- | --- | --- |
| `CA40-1` | Per-row official MLB StatsAPI `https://` source links on `<table class="driver-table">` in `assets/js/props.js` + honest season-total provenance note on historical/completed games (`U-6` / `I-4`) | `done` | `arena/ca40f7ec-livpbp` | `assets/js/props.js`, `assets/css/style.css` | [MLB `people/{id}/stats`](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,expectedStatistics&group=hitting&season=2026&sitCodes=vl,vr,h,a,d,n,risp) · [MLB `vsPlayer`](https://statsapi.mlb.com/api/v1/people/694192/stats?stats=vsPlayer&group=hitting&opposingPlayerId=656876) |
| `CA40-2` | Style `.driver-table` and per-row `.src-cell` cleanly in `assets/css/style.css` without altering existing rules | `done` | `arena/ca40f7ec-livpbp` | `assets/css/style.css` | [`assets/css/style.css` on `main`](https://github.com/snapquast73-boop/LIVPBP/blob/main/assets/css/style.css) |
| `CA40-3` | Standalone regression test `tests/props-provenance-test.mjs` verifying every rendered `<table class="driver-table">` row has a verified official `statsapi.mlb.com` source link and zero fabricated values | `done` | `arena/ca40f7ec-livpbp` | `tests/props-provenance-test.mjs` | [MLB `game/824638/feed/live`](https://statsapi.mlb.com/api/v1.1/game/824638/feed/live) |
| `CA40-4` | Merge-preserving integration: merge latest `main` (preserving PRs #24, #26, #27), run full test suites, open & merge PR, confirm GitHub Pages deploy, and record here | `done` | `arena/ca40f7ec-livpbp` | `COORDINATION.md` | [GitHub Pages API](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages) |

### Verification & Cross-Scope Handoff Notes (`ca40f7ec`)

| Check / Handoff Item | Official Source | Result / Status |
| --- | --- | --- |
| Live StatsAPI `people/{id}/stats` (`season`, `expectedStatistics.avg`, `statSplits`, `gameLog`) & `vsPlayer` (`vsPlayerTotal`) | [`people/660271/stats`](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,expectedStatistics&group=hitting&season=2026&sitCodes=vl,vr) · [`people/694192/stats?stats=vsPlayer`](https://statsapi.mlb.com/api/v1/people/694192/stats?stats=vsPlayer&group=hitting&opposingPlayerId=656876) | Verified: `Props.renderPropsTab` now renders `<table class="driver-table">` where every `<tr>` carries a direct `td.src-cell` link to the exact official `statsapi.mlb.com` endpoint its input came from (`people/{id}/stats`, `vsPlayer`, or `game/{pk}/feed/live`), plus Batter/Pitcher card `MLB API ↗` links and an explicit `U-6` disclosure on historical/completed games |
| Reference sites parity (`LIVPBP2` & `POSTSSNALRT`) vs `LIVPBP` on `2026-08-28` (`15` finals) and `2026-10-28` (`WS G5`) | [`LIVPBP2/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP2/reviews.html?date=2026-08-28) · [`POSTSSNALRT/reviews.html`](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html) · [`schedule?date=2026-08-28`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=probablePitcher,linescore,decisions,review) | Verified: `?date=YYYY-MM-DD` deep links, `10` reviews & challenges / `79` ABS challenges on `2026-08-28`, offseason jump (`2026-10-28`), and `game.html?gamePk=824638` match working reference behavior |
| Handoff note for `af75fbfd` (owns `assets/js/{api,game,reviews-feed,feed-log}.js` & `server.mjs`) | [`v1.1/game/824638/feed/live`](https://statsapi.mlb.com/api/v1.1/game/824638/feed/live?fields=gamePk,gameData,review,absChallenges,away,home,used,remaining,usedSuccessful,usedFailed,hasChallenges) · [`schedule?startDate=2025-10-01&endDate=2026-04-01`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2025-10-01&endDate=2026-04-01&fields=dates,date,totalGames) | Logged without touching claimed files: (1) winter offseason gap Nov 1 → Feb 20 is ~111 days if widening schedule-range lookback; (2) `game.js` in-review lean poll `fields` should include `isComplete` alongside `hasReview`; (3) `server.mjs` / `feed-log.js` `atBatIndex: 0` falsy `\|\|` merge key |
| Automated checks (`props-provenance-test`, `smoke-test`, `restoration-check`, `run-all`) | [`tests/props-provenance-test.mjs`](tests/props-provenance-test.mjs) · [`tools/smoke-test.mjs`](tools/smoke-test.mjs) | `5/5` props provenance · `47/47` smoke · `ALL CHECKS PASSED` restoration · `47/47` jsdom render + syntax + link + contract · `88/88` `flagged.html` rows linked |

### Integration Record (`ca40f7ec`)

- **[PR #28](https://github.com/snapquast73-boop/LIVPBP/pull/28) — MERGED** at `2026-11-22T02:02Z`, merge commit [`c1bd74d79c1f656847dcbf2d7a6ecac72735bed0`](https://github.com/snapquast73-boop/LIVPBP/commit/c1bd74d79c1f656847dcbf2d7a6ecac72735bed0).
- **CI & Deployment Checks:**
  - PR #28 `Site checks` ([run `44974127379`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974127379)): `test` **pass** + `dom-smoke` **pass**.
  - `main` `Site checks` ([run `44974170680`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974170680)): **success**.
  - `pages-build-deployment` ([run `44974170064`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974170064)) & [`pages/builds/latest`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest): commit `c1bd74d` status **`built`** (`2026-11-22T02:02:26Z`).
  - `Published Pages delivery` ([run `44974212989`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974212989)): **success**.
- **Live GitHub Pages URLs verified (`2026-11-22`):**
  - [`/?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/?date=2026-08-28) → all 15 Finals render (`CIN 10–8 CHC`, `LAD 2–1 DET`, etc.).
  - [`/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-08-28) → `10 Reviews · 8 Challenges · 2 Umpire reviews · 79 ABS challenges · 2 Runs at risk · 89 tracked entries` matching [`LIVPBP2/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP2/reviews.html?date=2026-08-28).
  - [`/game.html?gamePk=824638`](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=824638) → full header, linescore with per-row `feed/live` source links, PBP with ABS pitch challenge indicators, Box Score, Props & Matchup driver table with per-row official source links, and Reviews tab.
  - [`/flagged.html`](https://snapquast73-boop.github.io/LIVPBP/flagged.html) → sections 1–12 live, 88/88 rows carrying verified official `https://` source links and blank cells on unconfirmed values.

---

# Session `arena/af75fbfd-livpbp` — Line-by-Line Functional & Provenance Parity Pass (`2026-11-22`)

- **Session ID:** `af75fbfd` (branch fixed by Arena to `arena/af75fbfd-livpbp`, branched from `main` @ [`59a7351`](https://github.com/snapquast73-boop/LIVPBP/commit/59a73511af5b90e41b678db3c5005502cee54dda), rebased onto [`1411fbc`](https://github.com/snapquast73-boop/LIVPBP/commit/1411fbc70905ad11263f0cadf8f99becd2d83cb7) preserving `d105b565` PR #23/#25/#26, `aa6c1d7b` PR #24/#27, and `ca40f7ec` PR #28/#29 verbatim).
- **Stale-claim check (`2026-11-22T02:05Z`):** Inspected all remote branches and open PRs (`0` open PRs). Merged sessions `d105b565`, `aa6c1d7b`, and `ca40f7ec` preserved completely; all three `ca40f7ec` handoff items (`180d` winter offseason lookback, `isComplete`/`inProgress` lean review probe + `gamePk` passed into `Props.getForecast`, and `atBatIndex: 0` merge key) are incorporated in this branch.

## Task Board (`arena/af75fbfd-livpbp`)

| Task ID | Task Description | Status | Owning Session | File Scope | Official Source |
| --- | --- | --- | --- | --- | --- |
| `AF-1` | Line-by-line audit of HTML, JS, CSS, `server.mjs`, `README.md`, `docs/*.md`, `flagged.html`, and live reference sites (`LIVPBP2`, `POSTSSNALRT`) | `done` | `arena/af75fbfd-livpbp` | `COORDINATION.md` | [LIVPBP main `f22a84b`](https://github.com/snapquast73-boop/LIVPBP/commit/f22a84bfd424bad65a8962d84755d6a76ad5d2b6) · [MLB StatsAPI schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=probablePitcher,linescore,decisions,review) |
| `AF-2` | Cross-page `?date=` navigation (`index.html` ↔ `reviews.html` ↔ `game.html`), offseason jump on `reviews.html`, leaf-projected `feed/live` ABS/MGR counter ingestion, `#banner` Runs at Risk, both-teams counter summary, ABS challenger role, counter-regression nesting fix, and removal of resolved-score `before` inference | `done` | `arena/af75fbfd-livpbp` | `assets/js/api.js`, `assets/js/ui.js`, `assets/js/reviews.js`, `assets/js/scoreboard.js`, `assets/js/game.js`, `assets/js/reviews-feed.js`, `assets/js/feed-log.js` | [MLB `feed/live` `824638`](https://statsapi.mlb.com/api/v1.1/game/824638/feed/live?fields=gameData,review,absChallenges,hasChallenges,away,home,used,remaining,usedSuccessful,usedFailed) · [MLB `playByPlay` `824960`](https://statsapi.mlb.com/api/v1/game/824960/playByPlay?fields=allPlays,about,atBatIndex,result,description,reviewDetails,reviewType,challengeTeamId) |
| `AF-3` | `server.mjs` + `feed-log.js` `atBatIndex: 0` merge-key fix and dotfile/symlink static containment hardening | `done` | `arena/af75fbfd-livpbp` | `server.mjs`, `assets/js/feed-log.js` | [`server.mjs` on `main`](https://github.com/snapquast73-boop/LIVPBP/blob/main/server.mjs) |
| `AF-4` | Per-row official `https://` source links on all Markdown/HTML tables (`README.md`, `docs/*.md`, `tests/README.md`, `flagged.html`), flagged irregularities (`AF-1..AF-7`), regression tests (`52/52` smoke, `47/47` jsdom, `5/5` props provenance), PR #30 merge, and live GitHub Pages verification | `done` | `arena/af75fbfd-livpbp` | `README.md`, `docs/verification-report.md`, `tests/README.md`, `flagged.html`, `tools/smoke-test.mjs`, `tools/restoration-check.mjs`, `COORDINATION.md` | [GitHub Pages API](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages) |

## Verification & Provenance Log (`arena/af75fbfd-livpbp`)

- **Official sources fetched & cross-checked line by line (`2026-11-22`):**
  - [`/api/v1.1/game/824638/feed/live?fields=gameData,review,absChallenges,…`](https://statsapi.mlb.com/api/v1.1/game/824638/feed/live?fields=gameData,review,absChallenges,hasChallenges,away,home,used,remaining,usedSuccessful,usedFailed) & [`/api/v1.1/game/849799/feed/live?fields=…`](https://statsapi.mlb.com/api/v1.1/game/849799/feed/live?fields=gameData,review,absChallenges,hasChallenges,away,home,used,remaining,usedSuccessful,usedFailed) — verified `gameData.absChallenges` exists on `feed/live` (not `playByPlay`), confirming why `reviews-feed.js` previously failed to render ABS counters (`AF-1`).
  - [`/api/v1/game/824960/playByPlay`](https://statsapi.mlb.com/api/v1/game/824960/playByPlay?fields=allPlays,about,atBatIndex,inning,halfInning,result,description,playEvents,index,details,reviewDetails,isOverturned,inProgress,reviewType,challengeTeamId) — verified ABS challenger role wording (`"Jonah Heim challenged (pitch result)…"` on `atBatIndex: 34`, `AF-5`) and flagged `atBatIndex: 80` where pitch-level `reviewDetails` is present without challenge prose in `result.description` (`AF-7`).
  - [`/api/v1/game/775296/linescore`](https://statsapi.mlb.com/api/v1/game/775296/linescore) vs [`/api/v1.1/game/775296/feed/live`](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=gamePk,liveData,linescore,teams,away,home,runs,hits,errors) — re-confirmed upstream error-count discrepancy (`2` vs `3`).
  - [`/api/v1/schedule?sportId=1&startDate=2026-10-01&endDate=2026-11-22`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-01&endDate=2026-11-22&fields=dates,date,totalGames) — confirmed latest 2026 postseason game date `2026-10-28` (`totalGames: 1`, game `849799`).
  - Reference deployments [`LIVPBP2/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP2/reviews.html?date=2026-08-28) and [`POSTSSNALRT/reviews.html`](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html) — verified full parity on `?date=` deep links, cross-page date navigation, MGR/ABS challenge counters, both-teams summaries, `#banner` Runs at Risk alerts, and offseason date jump.
- **Test & Link Suites Executed:**
  - `npm test` (`tools/smoke-test.mjs`): **52 passed, 0 failed** (+5 new `AF-1..AF-6` checks in §[12]).
  - `node tools/restoration-check.mjs`: **ALL CHECKS PASSED** (including `GET /.git/HEAD -> 403` and `atBatIndex: 0` merge preservation).
  - `node tests/run-all.mjs`: **syntax OK · 40 local references OK · 8 DOM bindings OK · 47/47 jsdom render checks OK**.
  - `node tests/props-provenance-test.mjs`: **5 passed, 0 failed** (with `game.js` passing `gamePk` into `Props.getForecast`).
  - Table-row provenance check: **102/102 Markdown data rows** (`README.md`, `docs/*.md`, `audit/*.md`, `tests/README.md`) + **95/95 `flagged.html` data rows** carry clickable `https://` official source links, with blank cells on all unconfirmed items.

## Integration Record (`arena/af75fbfd-livpbp`)

- **[PR #30](https://github.com/snapquast73-boop/LIVPBP/pull/30) — MERGED** at `2026-11-22T02:09:33Z`, merge commit [`253741219b0054eebcaab4b78c80d695bc3cc647`](https://github.com/snapquast73-boop/LIVPBP/commit/253741219b0054eebcaab4b78c80d695bc3cc647).
- **CI & GitHub Pages Deployment Checks:**
  - PR #30 `Site checks` ([run `44974714527`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974714527)): `test` **pass** + `dom-smoke` **pass**.
  - `main` `Site checks` ([run `44974760255`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974760255)): **success**.
  - `pages-build-deployment` ([run `44974759685`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974759685)) & [`pages/builds/latest`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest): commit `2537412` status **`built`** (`2026-11-22T02:09:53Z`).
  - `Published Pages delivery` ([run `44974797013`](https://github.com/snapquast73-boop/LIVPBP/actions/runs/44974797013)): **success**.
- **Live GitHub Pages URLs verified (`2026-11-22`):**
  - [`/?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/?date=2026-08-28) → all 15 Finals render (`CIN 10–8 CHC`, `LAD 2–1 DET`, …) with `?date=2026-08-28` preserved on every game link (`game.html?gamePk=824638&date=2026-08-28`).
  - [`/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-08-28) → `10 Reviews · 8 Challenges · 2 Umpire reviews · 79 ABS challenges · 2 Runs at risk · 89 tracked entries`, both-teams MGR/ABS counter summaries (`PIT 1 MGR · 2 ABS — STL 1 MGR · 2 ABS`), and zero inferred `Before review` scores on post-ruling rows (`— (not observed before ruling)`).
  - [`/game.html?gamePk=824638`](https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=824638) → full header, linescore with per-row `feed/live` source links, PBP with ABS pitch challenge indicators, Box Score, Props & Matchup driver table with `gamePk`-linked per-row official source links, and Reviews tab.
  - [`/flagged.html`](https://snapquast73-boop.github.io/LIVPBP/flagged.html) → sections 1–13 (`AF-1..AF-7`) live, `95/95` rows carrying verified official `https://` source links and blank cells on unconfirmed values.



---

# Session `arena/6e2a58d9-livpbp` — reference-parity functional pass (2026-11-22)

- **Session ID:** `6e2a58d9` (branch fixed by Arena to `arena/6e2a58d9-livpbp`, from `main` @ `59a7351`). F-001 applies: no `session-<id>/<task>` branches; all work on this branch, integration by PR to `main`.
- **Brief:** make the site functionally work like the user-supplied references ([LIVPBP2/reviews.html](https://snapquast73-boop.github.io/LIVPBP2/reviews.html), [POSTSSNALRT/reviews.html](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html)), keeping everything else unchanged. Where the references disagree, the surviving original contract (uploaded `README.md` + `reviews.html` at `aef1a74c`) decides; irreconcilable items are flagged, never inferred.
- **Claimed at:** 2026-11-22. No other session holds active claims on the files below (all prior boards closed; `S1f-4`/`RR-05` are `needs review` = non-blocking).

## Task board (`arena/6e2a58d9-livpbp`)

| Task | Status | Session | File scope | Notes |
|---|---|---|---|---|
| G-1 Replay feed `?date=` deep link + URL sync (LIVPBP2 parity: honors `?date=YYYY-MM-DD`, keeps URL in step when navigating) | **superseded — already done on `main` by `d105b565` (PR #23) and re-tested by `aa6c1d7b` (PR #24)** | `6e2a58d9` (verify only) | — | Same fix landed while this session was claiming; verified on the rebased tree instead of re-implemented (see the conflict log below) |
| G-2 Feed empty-state message (both references render one; ours renders a blank list) | done | `6e2a58d9` | `assets/js/reviews-feed.js` | Sources: [LIVPBP2](https://snapquast73-boop.github.io/LIVPBP2/reviews.html?date=2026-08-28) "No matching review events for this date/filter." · [POSTSSNALRT](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html) "No tracked events for this filter yet…" |
| G-3 Alert chime for new **official-scorer pending rulings** and **official scoring changes** (original `reviews.html` button title lists both; ours chimes on neither) | done | `6e2a58d9` | `assets/js/reviews-feed.js` | Source: uploaded `reviews.html` L39 button title (`aef1a74c`) — "a gentle raindrop chime for new challenges/reviews/boundary calls, official-scorer pending rulings and official scoring changes (not ABS), and the same chime whenever an active review could remove a run already on the scoreboard" |
| G-4 Challenges-remaining tracker per uploaded README: team-prefix counter line (`CIN: 2 ABS challenges left now (…)`), both-teams summary `Challenges left: … — …` **on hover** and **on the Under-Review live strip** (ours has no prefix, no summary, empty strip) | done | `6e2a58d9` | `assets/js/reviews.js`, `assets/js/reviews-feed.js` | Source: uploaded `README.md` L50–54 (`aef1a74c`) + [LIVPBP2 countersSummary](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews.js#L156-L170). LIVPBP2 also shows the summary as a visible row line — flagged as a reference discrepancy, not copied (README says hover + strip) |
| G-5 "score impact pending" for a boundary review with no currently credited run (README; ours shows nothing) | done | `6e2a58d9` | `assets/js/reviews-feed.js` | Source: uploaded `README.md` L31–33 (`aef1a74c`); [LIVPBP2 render](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews-feed.js#L522-L525) |
| G-6 Regression checks for G-1…G-9; full suites stay green | done | `6e2a58d9` | `tools/smoke-test.mjs`, `tests/jsdom-render-test.mjs` (extend only) | `npm test`, `node tests/run-all.mjs`, `node tools/restoration-check.mjs` must pass |
| G-7 Line-by-line reference-parity audit + flagged entries (RR-05 resolved: raindrop chime kept per README/LIVPBP2, POSTSSNALRT cha-ching deviation documented) | done | `6e2a58d9` | `audit/reference-parity-2026-11-22.md`, `flagged.html` (extend only) | Every claim links an official or first-party source; unverifiable originals stay blank |
| G-8 Integration: PR → `main`, merge, confirm Pages, record here | done | `6e2a58d9` | `COORDINATION.md` | PR [#32](https://github.com/snapquast73-boop/LIVPBP/pull/32) **MERGED** 2026-11-22, merge commit [`b2f6d1d`](https://github.com/snapquast73-boop/LIVPBP/commit/b2f6d1db1d1ce2f718e4115371855db356cb37ce); Pages `built` @ `b2f6d1d`; live verification below |
| G-9 Fixes found during the line-by-line pass: irregularity notes were misattributed to every row of a game; boundary-call classification included charged manager challenges (registry `MH`/`MD`/`MO`/`MT`/`MS` are "Manager challenge: …"); `counterRegression` was called with the wrong shape (no-op) | done | `6e2a58d9` | `assets/js/reviews.js`, `assets/js/reviews-feed.js`, `assets/css/style.css` | Sources: [gameStatus registry](https://statsapi.mlb.com/api/v1/gameStatus) · uploaded `README.md` ("NH = boundary-call review"; "boundary reviews are not charged"); recorded as R2-6/R2-8/R2-9 on `flagged.html` §14 |

### Merge-conflict resolution log (2026-11-22, `6e2a58d9`)

- `git pull --rebase origin main` conflicted in `COORDINATION.md` only: parallel sessions
  `d105b565` (PR #23, merged `1e405cc`) and `aa6c1d7b` (PR #24, merged `f22a84b`) appended board
  sections at the same spot while this session's claim was in flight (the claim conflicted twice,
  against `f22a84b` and then against `44975d4`, and was consolidated into this single claim commit
  on top of `main` @ `44975d4`). Resolution keeps **every** incoming session section verbatim and
  appends this session's section after them. **Nothing of any other session was discarded or rewritten.** Both parallel
  sessions had already merged the `?date=` deep-link fix this session planned as G-1 (their
  implementations + the `d105b565` URL-sync variant are on `main`), so G-1 is marked superseded
  and this session verifies the merged behavior instead of re-implementing it.
- 2026-11-22 — Second merge-conflict resolution log (integration of this branch with `main` @ `8583382`, PRs #28–#31): while this session's G-1…G-9 pass was in flight, session `af75fbfd` independently completed an overlapping functional pass (its `AF-1…AF-7`, PRs #30/#31) and session `ca40f7ec` added props/style work (PRs #28/#29). `git merge origin/main` conflicted in `COORDINATION.md`, `assets/js/api.js`, `assets/js/reviews-feed.js`, `tools/smoke-test.mjs`, `flagged.html`; `assets/js/reviews.js` auto-merged with a duplicated `countersSummary` mix. Resolution principle: **keep every fix from both sides, discard nothing.** Result: (1) the deployed `af75fbfd` implementation is the base of `reviews-feed.js`/`api.js`/`reviews.js` (their ABS/MGR counter fetch + cache, `counterRegression` flat-and-nested, AF-3 "never infer the Before score", `offerRecentDate` offseason jump, `server.mjs`/`feed-log.js` hardening all kept verbatim); (2) this session's **unique** fixes were ported on top: G-2 empty-state notice, G-3 chimes for pending rulings / scoring changes / the moment runs-at-risk first becomes visible (once per review; restored rows pre-marked), G-5 "score impact pending", README `CIN:`-prefix counter lines, and G-9 entry-scoped irregularity attribution + game-level flagged rows; (3) `Reviews.countersSummary` is one function accepting both label key spellings; (4) `tools/smoke-test.mjs` keeps **both** regression sections (`af75fbfd`'s §[12] and this session's §[13], 12 checks); (5) `flagged.html` keeps both new sections (§13 `af75fbfd`, §14 `6e2a58d9`); (6) `api.js` took `af75fbfd`'s superset `gameFeed` (its extra `/playByPlay` bundle fallback plus the shared `opts.fields` projection). No force-push anywhere.

## Integration Record (`arena/6e2a58d9-livpbp`)

- **[PR #32](https://github.com/snapquast73-boop/LIVPBP/pull/32) — MERGED** (merge commit [`b2f6d1d`](https://github.com/snapquast73-boop/LIVPBP/commit/b2f6d1db1d1ce2f718e4115371855db356cb37ce)), title "Replay feed: reference-parity functional pass (G-2..G-9) + cross-session union".
- **Pre-merge checks on the PR head (never merge a broken site):** `npm test` **64/64** (52 `af75fbfd`-lineage incl. its §[12] + 12 new §[13]) · `node tests/run-all.mjs` **ALL CHECKS PASSED** (47/47 jsdom) · `node tools/restoration-check.mjs` **ALL CHECKS PASSED** · `node tests/props-provenance-test.mjs` **5/5**.
- **GitHub Pages:** [`pages/builds/latest`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest) → commit `b2f6d1d`, status **`built`** (2026-11-22).
- **Live verification (2026-11-22, after the build):**
  - [`/reviews.html?date=2026-08-28`](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-08-28) → README-format prefixed counter lines on every challenge row (`BAL: 0 manager challenges left now (1 used)`, `TOR: 1 manager challenge left now (1 used)`, …), both-teams summaries (`Challenges left: PIT 1 MGR · 2 ABS — STL 1 MGR · 2 ABS` / `SD 1 MGR · 1 ABS — TB 1 MGR · 1 ABS`), honest `— (not observed before ruling)` markings (no inferred Before scores), and **entry-scoped irregularity notes** (`Before-review score was not observed for 824960:47:p:MF …` on its own row only) — the pre-fix misattribution (same first note repeated on every row) is gone.
  - [`/flagged.html`](https://snapquast73-boop.github.io/LIVPBP/flagged.html) → sections 1–**14** live: §13 (`af75fbfd` AF-1…AF-7) + §14 (`6e2a58d9` R2-1…R2-11), every row carrying its official/first-party source link and unverifiable wording marked unverified.
