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
| T7 | Integration: PR to `main`, merge, confirm GitHub Pages deploy | in progress | 681bfa13 | (GitHub) |

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
