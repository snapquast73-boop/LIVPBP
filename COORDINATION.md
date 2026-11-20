# Coordination

- Pages integration — done (core restoration); needs review (parity gaps) — session 5f141515 — root HTML, server, README, deployment and tests; no other claims recorded.

## Integration verification

- The initial upload had no `assets/` directory. The owner/publisher's original GitHub repository returned HTTP 404, and the original demo could not be retrieved. Reconstructed assets are not an exact upstream recovery. The site publishes the outstanding differences on `flagged.html`.
- Confirmed the publishing source (`main` at `/`) through the repository Pages API and [GitHub's official Pages instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
- Checked the reference game against the [official schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-10-31&hydrate=team,linescore), [official feed](https://statsapi.mlb.com/api/v1.1/game/813025/feed/live?fields=gameData,teams,away,home,name,status,detailedState,liveData,linescore,runs), and [Gameday](https://www.mlb.com/gameday/dodgers-vs-blue-jays/2025/10/31/813025/final). MLB data is rendered directly, not embedded as historical rows. No exhaustive live-data or upstream parity claim is made.
- Static project-prefix links and script syntax passed `python3 tests/check_site.py`. DOM smoke tests passed for the scoreboard, game tabs and replay listing using mocked transport (the replay test event was synthetic, not published). Live browser CORS was not independently tested in the sandbox.

- Integration PR: [#2](https://github.com/snapquast73-boop/LIVPBP/pull/2). The authoritative merge result and commit are recorded on the PR; deployment status is recorded in [GitHub Actions](https://github.com/snapquast73-boop/LIVPBP/actions).
