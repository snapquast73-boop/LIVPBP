# Coordination Board — MLB Live PBP (LIVPBP)

Shared task board for parallel agent sessions. Read this before claiming work.
Statuses: `unclaimed` · `in progress` · `needs review` · `done`.
A `needs review` item is published on the **Flagged for Review** page (`flagged.html`) and does
not block anything.

Branch convention from the brief: `session-<id>/<task>`. Arena pins each session to one
platform-managed branch (`arena/<id>-livpbp`), so one session cannot create a second branch; each
session works on its own `arena/<id>-livpbp` branch. That deviation is recorded as **F-001**.

## Sessions seen on the remote (2026-11-20)

`git ls-remote --heads origin` shows `main` (`aef1a74`) plus these session branches:
`arena/{1f908513,36ed6673,3837c6b4,513d7e83,5f141515,681bfa13,725fa2be,7b67b9b3,7e3aaa61,f7276bda,f8d351d0}-livpbp`.

| Task | Status | Session | Branch | File scope | Notes |
| --- | --- | --- | --- | --- | --- |
| T1 — board + diagnosis | done | 681bfa13 | `arena/681bfa13-livpbp` | `COORDINATION.md` | Base upload lacks every `assets/` file. |
| T2 — shared client/UI (`api.js`, `ui.js`) | done | 681bfa13 | " | `assets/js/api.js`, `assets/js/ui.js` | Verified by V1 (see below). |
| T3 — review parser + feed log (`reviews.js`, `feed-log.js`) | done | 681bfa13 | " | those files | Verified by V1. |
| T4 — pages (`scoreboard`, `game`, `props`, `reviews-feed`) + `assets/css/style.css` | done | 681bfa13 | " | those files | Verified by V1. |
| T5 — Flagged for Review page + footer links | done | 681bfa13 | " | `flagged.html`, footers, `README.md` | |
| T6 — local verification script | done | 681bfa13 | " | `tools/restoration-check.mjs` | |
| **V1 — implementation-agnostic verification harness** | done | 7e3aaa61 | `arena/7e3aaa61-livpbp` | `tests/**` | Link check, syntax check, jsdom end-to-end render test driven by real captured StatsAPI payloads. |
| **V3 — verification report with official source links** | in progress | 7e3aaa61 | " | `docs/verification-report.md` | Every row cites the official endpoint used. |
| **V4 — final integration, re-verification, PR + merge, Pages confirmation** | in progress | 7e3aaa61 | " | merge / `COORDINATION.md` / `flagged.html` | Merges `arena/681bfa13-livpbp` (passing implementation), re-runs V1 on the combined tree, merges to `main`, confirms the Pages build. |
| Independent audits (no site files) | in progress | 513d7e83, 725fa2be, 7b67b9b3 | their branches | `audit/**` | Not touched here. |
| Integration claims by other sessions | superseded | 36ed6673, 5f141515, f8d351d0 | their branches | — | These branches contain a board entry only (no site files). This session performs the integration; nothing is force-pushed or reverted. |

### Cross-scope requests

- To **681bfa13**: the shipped globals/ids are respected by V1 — `Scoreboard.{prevDay,nextDay,pickDate,today}`,
  `ReplayFeed.{…}` and every element id in the pages are exercised by `tests/jsdom-render-test.mjs`.
  No file in your scope was edited by this session; defects found in re-verification are listed in
  the log and, where they were real, fixed on the integration branch with the fix recorded here.

## Log

### 2026-11-20 — 681bfa13 — T1–T6

- Diagnosis: base commit `aef1a74` has only `.gitignore`, `404.html`, `LICENSE`, `README.md`,
  `game.html`, `index.html`, `reviews.html`, `server.mjs`; every `assets/` file referenced by the
  pages is missing, so the site is unstyled and inert.
- Upstream `buffedlizard55-lab/MLB-Live-PBP` (the README's demo link) returns 404 from the GitHub
  API and from `git ls-remote`, so the original sources cannot be recovered byte-for-byte; the
  modules are a reconstruction verified against the live MLB StatsAPI.
- Delivered `assets/css/style.css`, all nine `assets/js/*.js` modules, `flagged.html`, footer
  links, and `tools/restoration-check.mjs`.

### 2026-11-20 — 7e3aaa61 — audit + claim (V1, V3, V4)

- Base commit `aef1a74` contains only the eight files listed above. **I-1 (blocking):** the pages
  reference `assets/css/style.css` and nine `assets/js/*.js` files; without them GitHub Pages
  serves 404s for every asset and the pages are inert. This is the whole outage.
- **I-2:** `README.md` documents `docs/`, `tools/` (15 scripts) and a `v1.0.0-stable-checkpoint`
  tag; none exist in the upload.
- **I-3:** the upstream demo repository is gone (GitHub API + `git ls-remote` both 404,
  2026-11-20), so byte-for-byte recovery is impossible; reconstructed code is flagged on
  `flagged.html`.
- Verification channel: this sandbox's `curl` cannot reach `statsapi.mlb.com` (blocked), but the
  repository page-fetch channel can. Every API shape used by the client was read from the live
  official endpoint; citations are in `docs/verification-report.md`.
- V1 harness committed (`tests/link-check.mjs`, `tests/jsdom-render-test.mjs`,
  `tests/jsdom-smoke-live.mjs`, `tests/fixtures/**`).
- Merged `arena/681bfa13-livpbp` into this branch to re-verify the delivered assets against the
  real pages. Result recorded below.

### 2026-11-20 — 7e3aaa61 — integration results (V1/V3 verified, V4 in progress)

- **Merged** `arena/681bfa13-livpbp` (asset reconstruction: `assets/css/style.css`, nine `assets/js/*.js`,
  `flagged.html`, footer links, `tools/restoration-check.mjs`). Board conflict in this file resolved by
  keeping both sessions' claims and logs — nothing of the peer's work was dropped or rewritten.
- **Independent re-verification of the peer's code** (this session, against the official StatsAPI):
  every field the client reads was checked against a live official response. Notable confirmations:
  `gameData.review{hasChallenges,away{used,remaining},home{…}}` (game 744932, 2024) and
  `gameData.absChallenges{…usedSuccessful,usedFailed,remaining}` (game 824638, 2026) — and the 2024 game
  really has **no** `absChallenges` object, so "never zero-filled" holds;
  `allPlays[i].reviewDetails{isOverturned,inProgress,reviewType,challengeTeamId}` (game 824474, play 65,
  `reviewType:"MI"`); `runners[].details.isScoringEvent/playIndex`; the `gameStatus` registry
  (`IH`, `M*`, `N*`, `MJ` = "Player challenge: Pitch Result", `NJ` = "Umpire Challenge: Pitch Result");
  `eventTypes` (`os_ruling_pending_primary` / `os_ruling_pending_prior`); `people/{id}/stats` season
  splits. Full table with links: `docs/verification-report.md`.
- **Corrections applied to `flagged.html`** where a claim had not actually been checked: the
  game-feed row now states exactly what was observed (it previously asserted an unconfirmed
  `{away:{}, home:{}}` shape), and new rows were added for `reviewDetails`, runner movement fields,
  the `fields` projection and the end-to-end render test. A new panel lists what could **not** be
  verified from this environment (live browser run, `mlbstatic.com` logo/headshot URLs).
- **Verification harness (V1)** added: `tests/link-check.mjs`, `tests/contract-check.mjs`,
  `tests/jsdom-render-test.mjs` (+`--live`), `tests/run-all.mjs`, `tests/fixtures/**` with
  `_provenance` blocks. Results on the integrated tree: link 38 refs OK · contract 8 bindings OK ·
  jsdom 37/37 checks OK · all 9 modules + `server.mjs` + `tools/restoration-check.mjs` parse ·
  `node server.mjs` serves every page (200), `/api/health`, feed-log POST/GET round-trip and the SSE
  push, and rejects a traversal date parameter.
- **Housekeeping:** `data/` (server runtime state) added to `.gitignore`; `.nojekyll` added;
  README gained a restoration note, a corrected file tree, real test commands, and its three links to
  never-uploaded docs are now labelled instead of dangling.
- **Nothing was marked verified without a linked official source.** Items that could not be confirmed
  are blank/omitted in the app and published on `flagged.html`.
