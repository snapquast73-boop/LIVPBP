# tests/ — how this site is checked

Everything here runs against the **shipped** files. Nothing is a mock of the app; the only stubbed
thing is the HTTP layer, and it is stubbed with payloads copied verbatim from the official MLB
StatsAPI (see each fixture's `_provenance` block).

| Check | Command | What it proves |
| --- | --- | --- |
| Link / asset check | `node tests/link-check.mjs` | every `href`, `src` and CSS `url()` in the site resolves to a file that exists, and no page uses a root-absolute path that would break under `/LIVPBP/` |
| Contract check | `node tests/contract-check.mjs` | every inline handler (`onclick="Scoreboard.prevDay()"`), every `getElementById()` target and the script load order are consistent across the pages — a typo here would silently disable a feature |
| End-to-end render | `node tests/jsdom-render-test.mjs` | the real `index.html`, `game.html`, `reviews.html`, `404.html` + all real scripts render games, scores, play-by-play, review rows, linescore, boxscore, props, replay-feed stats and tabs, with no uncaught error |
| Same, live data | `node tests/jsdom-render-test.mjs --live` | identical page run, but every StatsAPI request goes to `https://statsapi.mlb.com` for real — the reproducible official-data check |
| Local server | `node server.mjs` then `curl localhost:8000/api/health` | the optional persistence backend (static files + feed-log GET/POST + SSE) |
| All of the above | `node tests/run-all.mjs` | summarized pass/fail |

```bash
npm install --no-save jsdom     # dev-only, not shipped with the site
node tests/run-all.mjs
```

`jsdom` is the only dependency and it is optional: without it the render test prints `SKIPPED`
(the link, contract and syntax checks still run). The site itself has **no** build step, no
frameworks and no runtime dependencies.

## Fixtures

`tests/fixtures/` holds three trimmed official responses. Values were copied unchanged; only
unrelated branches were removed, and each file says which responses it came from and on what date:

| Fixture | Captured from |
| --- | --- |
| `schedule-2026-08-28.json` | `GET /api/v1/schedule?sportId=1&date=2026-08-28&hydrate=review,probablePitcher,decisions,linescore` |
| `feed-824638-review.json` | `GET /api/v1.1/game/824638/feed/live`, `GET /api/v1/game/824474/playByPlay`, same schedule call |
| `gamestatus.json` | `GET /api/v1/gameStatus` |

Full field-by-field provenance and the list of items that could **not** be verified:
[`docs/verification-report.md`](../docs/verification-report.md) and [`flagged.html`](../flagged.html).
