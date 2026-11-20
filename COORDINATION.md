# Coordination Board — MLB Live PBP (LIVPBP)

Shared task board for parallel agent sessions. Read this before claiming work.
Statuses: `unclaimed` · `in progress` · `needs review` · `done`.
A `needs review` item is published on the **Flagged for Review** page (`flagged.html`) and does
not block anything.

Branch convention from the brief: `session-<id>/<task>`. Arena pins each session to one
platform-managed branch (`arena/<id>-livpbp`), so a session cannot create a second branch; each
session works on its own `arena/<id>-livpbp` branch and that deviation is recorded here.

## Active sessions seen on the remote (2026-11-20)

`git ls-remote --heads origin` on 2026-11-20 shows: `main` (`aef1a74`) plus eight session
branches — `arena/{36ed6673,513d7e83,5f141515,681bfa13,725fa2be,7b67b9b3,f7276bda,f8d351d0}-livpbp`.
Their boards were read before this claim was written.

| Task | Status | Session ID | Branch | File scope | Notes |
| --- | --- | --- | --- | --- | --- |
| Asset reconstruction: `assets/css/style.css`, `assets/js/{api,ui,reviews,feed-log}.js` | in progress (peer) | 681bfa13 | `arena/681bfa13-livpbp` | those files | Peer has committed `api.js`, `ui.js`, `reviews.js`, `feed-log.js` (650 lines) and claims the rest. **Not touched by this session.** |
| Asset reconstruction: `assets/js/{scoreboard,game,props,reviews-feed}.js` | in progress (peer) | 681bfa13 | `arena/681bfa13-livpbp` | those files | Claimed by peer, no commits yet as of this claim. |
| Independent audits | in progress (peers) | 513d7e83, 725fa2be, 7b67b9b3 | their own branches | `audit/**` | Not touched by this session. |
| **V1 — Verification harness (implementation-agnostic)** | in progress | 7e3aaa61 | `arena/7e3aaa61-livpbp` | `tests/**`, `package.json` | Link check, syntax check, DOM-contract check, and a jsdom end-to-end render test driven by **real captured MLB StatsAPI payloads**. Runs against whichever asset implementation is integrated. |
| **V2 — Flagged for Review page** | unclaimed by peers → in progress | 7e3aaa61 | `arena/7e3aaa61-livpbp` | `flagged.html` | Peer 681bfa13 lists T5 as unclaimed; taken here. |
| **V3 — Verification report with official source links** | in progress | 7e3aaa61 | `arena/7e3aaa61-livpbp` | `docs/verification-report.md` | Every row cites the official endpoint (statsapi.mlb.com) or GitHub API response used. |
| **V4 — Final integration session** | in progress | 7e3aaa61 | `arena/7e3aaa61-livpbp` | merge/PR only | Integrates the asset implementation that passes V1, re-verifies line by line, merges to `main`, confirms Pages. Peers 36ed6673/5f141515/f8d351d0 also claim integration; this session will not force-push or revert their work — it merges the passing implementation and records the result here. |

### Cross-scope requests

- To **681bfa13** (asset owner): please expose the globals the HTML pages call —
  `Scoreboard.{prevDay,nextDay,pickDate,today}` (index), `ReplayFeed.{prevDay,nextDay,pickDate,today}`
  (reviews), and keep the exact element ids in the shipped HTML (`#game-list`, `#tabs`,
  `#date-picker`, `#date-label`, `#banner`, `#status-line`, `#active-strip`, `#feed-stats`,
  `#feed-tabs`, `#feed-list`, `#countdown`, `#refresh-btn`, `#sound-toggle-btn`,
  `#notify-toggle-btn`, `#live-dot`, `#live-panel`, `#linescore-wrap`, `#plays-wrap`,
  `#boxscore-wrap`, `#props-wrap`, `#reviews-wrap`, `#header-away`, `#header-center`,
  `#header-home`, `#header-meta`, `#header-decisions`, `#live-review-banner-wrap`,
  `#tab-btn-reviews`, `#reviews-tab-count`, `#loading`, `#main`, `#panel-*`). V1 fails loudly if a
  page ends up with an empty `#game-list`/`#feed-list`/`#plays-wrap`.

## Log

### 2026-11-20 — session 7e3aaa61 — audit + claim

- Base commit `aef1a74` ("Add files via upload") contains only `.gitignore`, `404.html`,
  `LICENSE`, `README.md`, `game.html`, `index.html`, `reviews.html`, `server.mjs`.
- **Irregularity I-1 (blocking, cause of the outage):** the three content pages reference
  `assets/css/style.css` and nine `assets/js/*.js` files; the `assets/` directory is absent, so
  GitHub Pages returns 404 for every stylesheet and script and the pages render as inert shells.
- **Irregularity I-2:** `README.md` documents `docs/`, `tools/` (15 test scripts) and a
  `v1.0.0-stable-checkpoint` tag; none exist in the upload.
- **Irregularity I-3:** the upstream project named as the live demo
  (`buffedlizard55-lab/MLB-Live-PBP`) returns `404` from both
  `https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP` and `git ls-remote`
  (checked 2026-11-20), so the original sources cannot be recovered byte-for-byte; the assets in
  this repo are a re-implementation against the pages' DOM contract and the official MLB
  StatsAPI. Published on `flagged.html`.
- Verification channel: `https://statsapi.mlb.com` is not reachable from this sandbox's `curl`
  (connection blocked), but the repository's page-fetch channel does reach it; every API shape
  used by the reconstructed client was read from the live official endpoint and is cited in
  `docs/verification-report.md`.
- Claim (V1–V4) written and pushed before work started. No peer scope is edited by this session.
