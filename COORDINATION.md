# COORDINATION.md — Shared Task Board (`snapquast73-boop/LIVPBP`)

> **Branch note:** In Arena Agent Mode, this session's branch name is fixed by the platform to `arena/1f908513-livpbp` (Session ID: `1f908513`). All commits and pushes from this session target `arena/1f908513-livpbp`, with integration to `main` performed via Pull Request after re-checking `origin/main`.

## 1. Repository Audit Summary (Initial State at `aef1a74c40143a7fff9d24853418002e008b79b1`)

Commit `aef1a74c40143a7fff9d24853418002e008b79b1` (`Add files via upload`) uploaded only the 8 root-level files (`.gitignore`, `404.html`, `LICENSE`, `README.md`, `game.html`, `index.html`, `reviews.html`, `server.mjs`) from the original project (`buffedlizard55-lab/MLB-Live-PBP`), omitting all subdirectories (`assets/css/`, `assets/js/`, `docs/`, `tools/`). As a result, GitHub Pages (`https://snapquast73-boop.github.io/LIVPBP/`) currently serves unstyled HTML shells whose `<link rel="stylesheet">` and `<script src="assets/js/...">` tags all return HTTP 404.

## 2. Shared Task Board

| Task ID | Task Description | Status | Owning Session | File Scope |
| --- | --- | --- | --- | --- |
| `T-01` | Line-by-line verification against live official MLB StatsAPI & MLB.com sources (`gameStatus`, `eventTypes`, `teams`, `schedule`, `feed/live`, `playByPlay`, `people/stats`, copyright & scoring-changes pages) | `in progress` | `arena/1f908513-livpbp` | `COORDINATION.md`, `docs/verification-report.md`, `docs/api-compliance.md`, `docs/scoring-changes.md` |
| `T-02` | Restore shared client core & persistence (`api.js`, `ui.js`, `feed-log.js`) matching HTML/server contracts and verified StatsAPI endpoints | `in progress` | `arena/1f908513-livpbp` | `assets/js/api.js`, `assets/js/ui.js`, `assets/js/feed-log.js` |
| `T-03` | Restore review/challenge/ABS/scoring-change parser & two-sided hit forecast (`reviews.js`, `props.js`) | `in progress` | `arena/1f908513-livpbp` | `assets/js/reviews.js`, `assets/js/props.js` |
| `T-04` | Restore page controllers & dark Gameday stylesheet (`style.css`, `scoreboard.js`, `game.js`, `reviews-feed.js`) | `in progress` | `arena/1f908513-livpbp` | `assets/css/style.css`, `assets/js/scoreboard.js`, `assets/js/game.js`, `assets/js/reviews-feed.js` |
| `T-05` | Restore deterministic test suites, calibration/derivation scripts, offline preview, and optional Actions workflow templates (`tools/*`, `docs/workflows/*`) | `in progress` | `arena/1f908513-livpbp` | `tools/*.mjs`, `tools/run-risk-preview.html`, `docs/workflows/pages.yml`, `docs/workflows/smoke.yml` |
| `T-06` | Publish clearly labeled "Flagged for Review" page (`flagged.html`), verify line-by-line source links, update Pages/navigation links, and integrate cleanly to `main` + GitHub Pages | `in progress` | `arena/1f908513-livpbp` | `flagged.html`, `index.html`, `game.html`, `reviews.html`, `404.html`, `README.md`, `.gitignore`, `.nojekyll` |

## 3. Session Activity Log

- **2026-11-20 UTC (`arena/1f908513-livpbp`):** Created `COORDINATION.md`, audited initial commit `aef1a74c`, claimed tasks `T-01` through `T-06` on session branch `arena/1f908513-livpbp`, and began live verification against official MLB StatsAPI and MLB.com endpoints.
