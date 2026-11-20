# ⚾ MLB Live PBP

[Open the scoreboard](https://snapquast73-boop.github.io/LIVPBP/) · [Replay Feed](https://snapquast73-boop.github.io/LIVPBP/reviews.html) · [Flagged for Review](https://snapquast73-boop.github.io/LIVPBP/flagged.html)

An unofficial MLB scoreboard and game viewer. Choose a date to see the MLB schedule, open a game for the linescore, box score and pitch-by-pitch results, or browse structured challenge and review entries by date. The app uses MLB responses directly; each data row links to its source. Missing values are left blank and marked unverified, not replaced with estimates or zeroes.

## Official sources for manual review

| Surface | Verified sample / reference |
| --- | --- |
| Schedule and game ID | [MLB schedule for October 25, 2025](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-10-25) |
| Game status and play descriptions | [MLB game feed, game 813026](https://statsapi.mlb.com/api/v1.1/game/813026/feed/live) |
| Inning runs and R/H/E | [MLB linescore, game 813026](https://statsapi.mlb.com/api/v1/game/813026/linescore) |
| Batting and pitching stats | [MLB box score, game 813026](https://statsapi.mlb.com/api/v1/game/813026/boxscore) |
| Recorded review code, challenge team ID and overturned flag | [MLB play-by-play, game 813026](https://statsapi.mlb.com/api/v1/game/813026/playByPlay?fields=allPlays,reviewDetails,isOverturned,reviewType,challengeTeamId) |
| Active review status and rules | [MLB game status registry](https://statsapi.mlb.com/api/v1/gameStatus), [MLB Replay Review](https://www.mlb.com/glossary/rules/replay-review) |

The upload omitted the original frontend assets. The replacement retains the page routes and core views but is not an exact copy. The [review page](flagged.html) lists behavior that could not be verified or restored. The historical upload's documentation can be read at the [initial commit](https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c40143a7fff9d24853418002e008b79b1/README.md).

## Local use and deployment

Run `python3 -m http.server 8000` and open `http://localhost:8000/`. The site needs access to MLB's StatsAPI. The optional `node server.mjs` also serves the site and retains the uploaded feed-log API, which this frontend does not call.

Run `npm ci && npm test` to validate the static pages and exercise the frontend against small, deterministic test fixtures. These are not live endpoint monitoring. The site is served as static files from `main` in [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and needs no build or backend.

MIT license; see [LICENSE](LICENSE). Not affiliated with MLB or MLB Advanced Media.
