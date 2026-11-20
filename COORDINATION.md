# Shared coordination board

## Session and branch rules

- Session: `36ed6673` (Arena; started 2026-11-20 UTC).
- Assigned working/integration branch: `arena/36ed6673-livpbp`.
- Arena requires this session to stay on its assigned branch. No additional branch or worktree will be created.
- At initial inspection, the only remote branch was `main`, no pull requests were open, and no coordination board existed. No other session claims were found.
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
