# Coordination

- **Done — core Pages restoration and integration** — `arena/f8d351d0-livpbp` (sole session). Scope: site HTML, `assets/`, `.nojekyll`, `README.md`, optional server route and ignore rule, test tooling and workflow, this board. Claimed in [26ebad1](https://github.com/snapquast73-boop/LIVPBP/commit/26ebad1). No conflicting claims were present.
- **Needs review — original parity and advanced data** — [published review page](https://snapquast73-boop.github.io/LIVPBP/flagged.html). Initial upload omitted frontend assets. Upstream repository retrieval returned 404 and original demo retrieval failed. No original styling parity, forecasts, advanced replay attribution, or timing claims are presented as verified. The optional logging API is retained but not wired into the frontend.

## Verification

- Checked the sample [MLB schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-10-25&hydrate=probablePitcher,linescore,decisions,review): game 813026, teams, scores, probable pitcher names. Checked the [game feed](https://statsapi.mlb.com/api/v1.1/game/813026/feed/live), [linescore](https://statsapi.mlb.com/api/v1/game/813026/linescore) and [box score](https://statsapi.mlb.com/api/v1/game/813026/boxscore) for sample response shape and values.
- Checked the [structured review fields](https://statsapi.mlb.com/api/v1/game/813026/playByPlay?fields=allPlays,reviewDetails,isOverturned,reviewType,challengeTeamId) and [MLB status registry](https://statsapi.mlb.com/api/v1/gameStatus). These checks are historical/sample-based, not independent verification of all MLB games.
- Audited local page links, CSS and JS paths under `/LIVPBP/`; automated fixture checks cover the scoreboard, date navigation, game tabs and data tables, replay filters, official source links, blank cells, reported zeroes and HTTP errors. Static frontend requires no compilation. [GitHub Pages hosting reference](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Publication

- Integration pull request: [#3](https://github.com/snapquast73-boop/LIVPBP/pull/3). The PR timeline is the canonical merge record; see the [Pages deployment history](https://github.com/snapquast73-boop/LIVPBP/deployments/github-pages) for deployment status.
