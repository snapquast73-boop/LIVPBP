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
| T2 | Reconstruct shared client/UI (`api.js`, `ui.js`) | in progress | 681bfa13 | `assets/js/api.js`, `assets/js/ui.js` |
| T3 | Reconstruct review parser + feed log (`reviews.js`, `feed-log.js`) | in progress | 681bfa13 | `assets/js/reviews.js`, `assets/js/feed-log.js` |
| T4 | Reconstruct pages (`scoreboard.js`, `game.js`, `props.js`, `reviews-feed.js`) + stylesheet | in progress | 681bfa13 | `assets/css/style.css`, `assets/js/scoreboard.js`, `assets/js/game.js`, `assets/js/props.js`, `assets/js/reviews-feed.js` |
| T5 | Flagged for Review page + footer links + README demo link | unclaimed | — | `flagged.html`, footers of `index.html`/`game.html`/`reviews.html`, `README.md` |
| T6 | Local verification (syntax, link check, server smoke test) | unclaimed | — | `tools/restoration-check.mjs` |
| T7 | Integration: PR to `main`, merge, confirm GitHub Pages deploy | unclaimed | — | (GitHub) |

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
