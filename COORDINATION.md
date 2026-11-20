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
- Claim is being committed and pushed before implementation begins. Any later verification and irregularities will be recorded below.
