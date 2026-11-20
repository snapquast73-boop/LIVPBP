# Shared coordination board

## Session and branch rules

- Session: `36ed6673` (Arena; started 2026-11-20 UTC).
- Assigned working/integration branch: `arena/36ed6673-livpbp`.
- Arena requires this session to stay on its assigned branch. No additional branch or worktree will be created.
- At initial inspection, the only locally tracked remote branch was `main`, no pull requests were returned by the initial query, and no coordination board existed in this checkout. Later full GitHub branch enumeration revealed parallel sessions; see the handoff below. The initial inspection was not a complete inventory of all remote branch claims.
- Other sessions: do not edit a claimed scope. Record cross-scope requests here instead. `needs review` items are non-blocking and will be published on `flagged-for-review.html`.

## Tasks

| Task | Status | Owner | File scope | Evidence / notes |
| --- | --- | --- | --- | --- |
| Recover the missing original application and audit the uploaded files | in progress | `36ed6673` | `assets/**`, `tools/**`, `docs/**`, `LICENSE`, `server.mjs`, `.gitignore` | Initial upload contains HTML referencing an absent `assets/` directory. Identify the original commit from the upstream repository and preserve its design/behavior. |
| Final integration, official-source verification, and review notices | in progress | `36ed6673` | `index.html`, `game.html`, `reviews.html`, `404.html`, `flagged-for-review.html`, `README.md`, `COORDINATION.md`, `package.json`, `package-lock.json`, `.github/**`, `.nojekyll` | This is the final integration session. Audit all restored content; test navigation, data provenance, and static hosting. No other task owners exist at claim time. |
| Publish and confirm the project's own GitHub Pages deployment | in progress | `36ed6673` | GitHub PR / Pages / repository settings; deployment evidence in `COORDINATION.md` and `docs/**` | Existing Pages source is `main:/`; URL returned by GitHub: https://snapquast73-boop.github.io/LIVPBP/ . Create and merge a PR only after validation. |

## Verification policy

- Preserve upstream code where possible; distinguish source recovery from verification of baseball statistics or predictions.
- Link every displayed data-table row to the relevant official MLB source. Missing/unconfirmed official values must remain blank rather than be inferred.
- Do not call historical README assertions, undocumented codes, estimates, or test fixtures independently verified facts.
- Official GitHub API responses and pinned upstream GitHub files will document recovery/deployment. Official MLB endpoints are the authority for displayed baseball data.
- If this environment cannot access a source, record that limitation explicitly and publish it on the review page; do not fabricate a successful check.

## Activity log

### 2026-11-20 — initial claim (`36ed6673`)

- Read the complete repository root listing and the initial application entry points. The upload has only eight files; all CSS, browser JavaScript, tools, and referenced verification documents are missing.
- Confirmed clean branch `arena/36ed6673-livpbp` at `aef1a74c40143a7fff9d24853418002e008b79b1`, no existing coordination board, no competing remote branches, and no open PRs.
- GitHub Pages is enabled with the legacy `main:/` source. Official API: https://api.github.com/repos/snapquast73-boop/LIVPBP/pages .
- Claim committed and pushed before implementation: `0b517b7`.

### 2026-11-20 — application reconstruction (`36ed6673`)

- GitHub's official API returns HTTP 404 for both the original account and `buffedlizard55-lab/MLB-Live-PBP`; direct original Pages and asset fetches also failed. Sources: https://api.github.com/users/buffedlizard55-lab and https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP . Exact source recovery and pixel/behavior parity are **unverified**, not claimed.
- Read every line of all eight uploaded files. Reconstructed the missing stylesheet and eight browser scripts against the existing HTML structure; retained the three page names, controls, tabs, dark scoreboard layout, and optional persistence architecture. Syntax checks (`node --check`) pass for all new browser scripts. Functional tests are still in progress.
- Checked actual official responses: https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-20 (no games); https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=probablePitcher,linescore,decisions,review ; https://statsapi.mlb.com/api/v1.1/game/824638/feed/live ; https://statsapi.mlb.com/api/v1/game/824638/playByPlay ; https://statsapi.mlb.com/api/v1/game/824638/boxscore ; https://statsapi.mlb.com/api/v1/gameStatus ; https://statsapi.mlb.com/api/v1/eventTypes . Projections of these endpoints confirmed review fields, nine ABS review records, per-team counters, and linescore shapes for game 824638.
- Unverified projections remain blank. No custom hit forecast, inferred alternate score, inferred challenger, invented missing statistic, or reconstructed pre-observation scoring history is displayed.
- Safer polling replaces unverified README sub-second claims: scoreboard 10s live, game 5s live / 2s under review, replay feed 10s live; hidden pages pause, requests do not overlap, and HTTP 429 Retry-After is honored. MLB publishes no rate guarantee; this is not a claim of authorization. Official terms checked: https://www.mlb.com/official-information/terms-of-use .
- GitHub Pages is static, so cross-browser disk persistence/SSE remains optional on the Node server, not promised on Pages. Official reference: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages . These limitations will appear on the review page.

### 2026-11-20 22:34 UTC — parallel-session discovery and scope handoff

- A fresh `git fetch origin` revealed that other sessions had merged a separate reconstruction into `main` through PR #4/#6/#7 and follow-ups while this session worked. Full remote branch enumeration now shows the parallel branches. Source: https://github.com/snapquast73-boop/LIVPBP/pulls?q=is%3Apr+is%3Amerged .
- **Stop wholesale reconstruction/integration:** this session will keep the published implementation, not overwrite the other sessions' assets with its independent reconstruction. This branch's earlier reconstruction is retained in Git history as comparison evidence only. The existing merged board and verification reports will be preserved verbatim when integrating `main`.
- Local independent draft checks before handoff: 28 unit/server tests and 48 desktop/mobile browser assertions passed against this session's separate draft. These results **do not certify the different implementation on `main`**.
- New narrowed claim: independent Chromium verification of the combined site and official-source/blank-value regressions. Scope: new uniquely named `tools/independent-*` files and fixture paths, `.github/workflows/independent-browser.yml`, dev-dependency additions, and an additive report `docs/independent-verification-36ed6673.md`. Existing `tests/**`, `tools/smoke-test.mjs`, `tools/restoration-check.mjs`, and existing deployment workflows remain owned by their current sessions and will not be replaced.
- Active overlapping scopes observed: PR #13 owns `server.mjs`, README dead references and footer deduplication; PR #14 owns existing flag/report corrections; PR #12 owns delivery checking. This session will not edit those active scopes. Front-end changes, if necessary, will be narrowly scoped regression fixes to completed tasks, recorded explicitly before implementation, never wholesale replacements.
- Request to integration owners: the official-data policy requires blank unknown numerical fields, no null-to-zero coercion, and official links on every data-table row. Independent browser checks will exercise the current implementation and record specific findings with official source URLs. Forecast-model estimates cannot be certified as official MLB values.
