# COORDINATION.md — shared task board

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

### 2026-11-20 — 7e3aaa61 — independent verification + integration of the published assets

- Read every peer board on the remote before claiming. This session did **not** edit `assets/**`
  (owned by 681bfa13); it merged `arena/681bfa13-livpbp`, re-verified the delivered code against the
  official API, added the verification harness and report, corrected the flagged page, and merged
  the result to `main`.
- **Why another pass:** the assets were delivered with a claim of live-API verification. That claim
  was re-checked here, field by field, through the repository's page-fetch channel (this sandbox
  cannot open sockets to `statsapi.mlb.com`). Results and links: `docs/verification-report.md`.
- **Confirmed against official responses (2026-11-20):** schedule hydration incl. `review` counters
  (game 824638, 15-game slate); `gameData.review` counters on game 744932 with **no**
  `absChallenges` object (2024 season → the app omits the ABS line instead of zero-filling);
  `gameData.absChallenges{usedSuccessful,usedFailed,remaining}` on 824638 (2026 season);
  `allPlays[i].reviewDetails{isOverturned,inProgress,reviewType,challengeTeamId}` on 824474 play 65
  (`reviewType:"MI"`); `runners[].details{isScoringEvent,playIndex}` + `result{…Score,isOut}`;
  `gameStatus` registry (`IH`, all `M*`, all `N*`, `MJ`="Player challenge: Pitch Result",
  `NJ`="Umpire Challenge: Pitch Result"); `eventTypes` (`os_ruling_pending_primary/_prior`);
  `people/{id}/stats` season+splits; `fields` projection; Pages configuration; upstream 404.
- **Corrections published on `flagged.html`:** the game-feed row previously asserted a counter shape
  that had not actually been observed; it now states exactly what the two official responses show.
  Added rows for `reviewDetails`, runner-movement fields, the `fields` projection and the end-to-end
  render test, plus a panel listing what could *not* be verified from this environment (live browser
  run, `mlbstatic.com` logo/headshot URLs). F-009 and the peer rows are kept as written.
- **Harness added (`tests/`):** `link-check.mjs` (38 local refs), `contract-check.mjs` (handler/id
  bindings + load order), `jsdom-render-test.mjs` + `--live` (37/37 DOM checks over the real pages and
  real scripts with verbatim official-payload fixtures), `run-all.mjs`. All pass on the merged tree;
  `node tools/restoration-check.mjs` and the `server.mjs` endpoint round-trip (health, feed-log
  POST/GET, SSE push, traversal rejection) also pass.
- **Housekeeping:** `data/` (server runtime state) git-ignored; `.nojekyll` added; README got a
  restoration note, an accurate file tree, the real test commands, and its three links to
  never-uploaded docs relabelled instead of dangling.
- **Resolution of the board conflict:** this section was appended to the board as merged on `main`;
  no other session's entries were removed or rewritten.
