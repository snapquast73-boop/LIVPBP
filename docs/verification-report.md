# Verification report — restoration of MLB Live PBP

- **Repository:** `snapquast73-boop/LIVPBP` — site: <https://snapquast73-boop.github.io/LIVPBP/>
- **Audit date:** 2026-11-20 (UTC). All responses below were read on that date.
- **Why this document exists:** the upload this repository started from
  (`aef1a74 "Add files via upload"`) contained only `index.html`, `game.html`, `reviews.html`,
  `404.html`, `README.md`, `server.mjs`, `LICENSE` and `.gitignore`. Every stylesheet and script the
  pages load was missing, so GitHub Pages served an unstyled, inert shell. The original sources
  could not be recovered (see §3). The client was therefore re-implemented against the pages' own DOM
  contract and the official MLB StatsAPI, and every field the client reads is listed below with the
  official response it was verified against.

## 1. Verification channel

`https://statsapi.mlb.com` is **not** reachable over a socket from this sandbox (connection blocked;
`curl` returns status `000`). The repository's page-fetch channel *does* reach it, and every response
in §2 was retrieved that way and read directly. This limitation is recorded again in §4 and on
`flagged.html`.

Reproduce the app-side check with real network from any machine:

```bash
npm install --no-save jsdom
node tests/jsdom-render-test.mjs --live    # answers the pages from the live StatsAPI
node tests/jsdom-render-test.mjs           # answers the pages from the captured fixtures
```

## 2. Field-by-field verification table

Every row was read from the linked official endpoint. Nothing in the client reads a field that is not
listed here (or in the "not verified" list in §4).

| # | What the client needs | Verified official shape | Official source |
|---|---|---|---|
| 1 | Schedule for a date, hydrated | `dates[].games[]`; `gamePk`, `gameDate`, `officialDate`, `season`, `status{abstractGameState,codedGameState,detailedState,statusCode,startTimeTBD,abstractGameCode}`, `teams.away/home{team{id,name},leagueRecord{wins,losses,pct},score,isWinner,probablePitcher{id,fullName}}`, `venue{id,name}`, `doubleHeader`, `gameNumber`, `seriesDescription` | [`/api/v1/schedule?date=2026-08-28&hydrate=review,probablePitcher,decisions,linescore`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=review,probablePitcher,decisions,linescore) |
| 2 | Linescore hydration used by the scoreboard card (inning, count, bases) | `linescore{currentInning,currentInningOrdinal,inningState,inningHalf,isTopInning,innings[]{num,ordinalNum,home{runs,hits,errors,leftOnBase},away{…}},teams.home/away{runs,hits,errors,leftOnBase,isWinner},balls,strikes,outs}` plus `offense{batter,onDeck,inHole,pitcher}`, `defense{…}` | same response as row 1 (game `824638`) |
| 3 | Decisions (W/L/S) on cards and game header | `decisions{winner{id,fullName},loser{…},save{…}}` | same response as row 1 (game `824638`) |
| 4 | Manager-challenge counters, never derived | `review{hasChallenges,away{used,remaining},home{used,remaining}}` — observed `{"hasChallenges":false,"away":{"used":0,"remaining":1},"home":{"used":0,"remaining":1}}` | same response as row 1; cross-checked on [`/api/v1.1/game/744932/feed/live`](https://statsapi.mlb.com/api/v1.1/game/744932/feed/live) → `gameData.review{"hasChallenges":true,"away":{"used":1,"remaining":0},"home":{"used":0,"remaining":1}}` |
| 5 | ABS challenge counters, never derived | `gameData.absChallenges{hasChallenges,away{usedSuccessful,usedFailed,remaining},home{usedSuccessful,usedFailed,remaining}}` — observed `{"hasChallenges":true,"away":{"usedSuccessful":3,"usedFailed":0,"remaining":2},"home":{"usedSuccessful":5,"usedFailed":0,"remaining":2}}` | [`/api/v1.1/game/824638/feed/live?fields=gameData,review,absChallenges,…`](https://statsapi.mlb.com/api/v1.1/game/824638/feed/live) |
| 6 | Pre-ABS seasons must not be zero-filled | 2024 game `744932` returns `gameData.review` and **no** `absChallenges` object at all → the client shows no ABS counter rather than `0` | [`/api/v1.1/game/744932/feed/live?fields=gameData,review,absChallenges,…`](https://statsapi.mlb.com/api/v1.1/game/744932/feed/live) |
| 7 | Review event on a play | `allPlays[i].reviewDetails{isOverturned,inProgress,reviewType,challengeTeamId}` — observed `{"isOverturned":false,"inProgress":false,"reviewType":"MI","challengeTeamId":113}` | [`/api/v1/game/824474/playByPlay?fields=allPlays,about,atBatIndex,reviewDetails,reviewType,isOverturned,inProgress,reason,challengeTeamId`](https://statsapi.mlb.com/api/v1/game/824474/playByPlay) |
| 8 | Play text, score after the play, outs | `result{eventType,description,awayScore,homeScore,isOut}`, `about{atBatIndex,halfInning,inning}`, `count{balls,strikes,outs}` | [`/api/v1/game/824474/playByPlay`](https://statsapi.mlb.com/api/v1/game/824474/playByPlay) |
| 9 | Runs-at-risk test (only runs credited to the reviewed event) | `runners[]{movement{originBase,start,end,outBase,isOut,outNumber},details{event,eventType,movementReason,isScoringEvent,rbi,earned,playIndex}}` — observed a scoring runner with `"isScoringEvent":true,"playIndex":3` | same response as row 8 |
| 10 | `fields` projection used by the lean status sweep | Projected responses return exactly the requested keys (`dates,games,gamePk,review,…`) — verified the sweep shape is available without hydrations | [`/api/v1/schedule?startDate=2026-08-20&endDate=2026-08-28&fields=dates,games,gamePk,review,…`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-08-20&endDate=2026-08-28&hydrate=review&fields=dates,games,gamePk,review,hasChallenges,away,home,used,remaining) |
| 11 | Review code glosses (manager / umpire / ABS / instant replay) | Registry entries read verbatim: `IH` = "Instant Replay" (reason "Review"); `MF`/`MA`/`MI`/`MS` … = "Manager challenge: …"; `MJ` = "Player challenge: Pitch Result"; `NA`/`NH`/`NS` … = "Umpire review: …"; `NJ` = "Umpire Challenge: Pitch Result" | [`/api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) |
| 12 | Official-scorer pending rulings | `os_ruling_pending_primary` and `os_ruling_pending_prior`, both described "Official Scorer Ruling Pending" | [`/api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes) |
| 13 | Season inputs for the hit forecast | `stats[]{type{displayName},splits[]{season,stat{avg,obp,slg,ops,atBats,hits,homeRuns,baseOnBalls,strikeOuts,plateAppearances}}}` — observed `avg ".263"` for player `663538` | [`/api/v1/people/663538/stats?stats=season,statSplits&group=hitting&sitCodes=vl,vr&season=2026`](https://statsapi.mlb.com/api/v1/people/663538/stats?stats=season,statSplits&group=hitting&sitCodes=vl,vr&season=2026) |
| 14 | Team names/abbreviations loaded at runtime (not hard-coded) | `teams[]{id,name,teamName,abbreviation,teamCode,fileCode}` for `sportId=1` | [`/api/v1/teams?sportId=1`](https://statsapi.mlb.com/api/v1/teams?sportId=1) |
| 15 | Persistence backend contract used by `assets/js/feed-log.js` | `GET /api/feed-log?date=`, `POST /api/feed-log`, `GET /api/feed-log/stream?date=` (SSE `event: feed-log`), `GET /api/health` — all exercised locally with `node server.mjs` (see §3) | repository file [`server.mjs`](../server.mjs) |
| 16 | GitHub Pages configuration of this repository | `{"status":"built","html_url":"https://snapquast73-boop.github.io/LIVPBP/","build_type":"legacy","source":{"branch":"main","path":"/"}}` | [`/repos/snapquast73-boop/LIVPBP/pages`](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages) |
| 17 | Original upstream project named as the demo | GitHub API returns `404 Not Found`; `git ls-remote` returns "Repository not found" → no byte-for-byte recovery of the original client | [`/repos/buffedlizard55-lab/MLB-Live-PBP`](https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP) |

## 3. Local checks run on the integrated tree

```text
node tests/link-check.mjs             -> 34 local references checked, OK
node --check assets/js/*.js           -> all 9 modules parse
node tests/jsdom-render-test.mjs      -> 37/37 checks passed (scoreboard, game, replay feed, 404)
node server.mjs + curl               -> /, /game.html, /reviews.html, /flagged.html,
                                         /assets/css/style.css, /assets/js/api.js = 200
                                         /api/health = {"status":"ok"}
                                         POST+GET /api/feed-log round-trip = OK
                                         GET /api/feed-log/stream = SSE "connected" + "feed-log" push
                                         GET /api/feed-log?date=../../etc/passwd = rejected
```

The jsdom test executes the **shipped** pages and scripts, answers them with
`tests/fixtures/*.json` (values copied verbatim from the responses in §2 — see each fixture's
`_provenance` block), and asserts that games, scores, plays, review rows, tabs, stats and toggles
actually render with no uncaught error.

## 4. Not verified / left blank (published on `flagged.html`)

| Item | Status | Why | Source of the claim |
|---|---|---|---|
| Browser run against the live API from this environment | **Not executed** | sandbox blocks direct sockets to `statsapi.mlb.com`; only the page-fetch channel reaches it. Run `node tests/jsdom-render-test.mjs --live` on a normal machine. | [`statsapi.mlb.com`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28) |
| `reviewDetails.reviewType` values beyond `MI` | **Partially verified** | only one live review event (`MI`) was present in the captures; the rest of the code table comes from the `gameStatus` registry, which governs `statusCode`, not proven identical for `reviewType` | [`/api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) |
| Team logo URL `https://www.mlbstatic.com/team-logos/team-cap-on-dark/{id}.svg` | **Unverified** | the image host answers the page-fetch channel with HTTP 500 (binary asset it cannot render), so existence could not be confirmed; the pattern is the one documented in `README.md`, and `<img onerror>` hides a broken logo | [`README.md`](../README.md) (endpoint table) |
| Player headshot URL | **Unverified** | `README.md` only shows a truncated path (`…/v1/people/{playerId}/headshot/67/current`); the host could not be reached from this environment | [`README.md`](../README.md) (endpoint table) |
| Original client source, `docs/`, `tools/` and tag `v1.0.0-stable-checkpoint` | **Missing** | never uploaded; upstream repo is 404 | [`/repos/buffedlizard55-lab/MLB-Live-PBP`](https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP) |
| Poll cadence, full hit-model drivers, Before/Possible/Actual score tracker | **Deviation** | re-implemented conservatively; see F-005, F-006, F-007 on `flagged.html` | this report, §3 |

Nothing above was filled in by inference: the app shows "—" or omits the value when the payload does
not carry it.
