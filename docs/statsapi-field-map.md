# MLB StatsAPI field map — what the site reads, and the official response that proves it

> Companion documents: the rebuild report is [`docs/verification-report.md`](verification-report.md);
> the owner-facing summary of everything flagged or unverified is [`flagged.html`](../flagged.html).
> Session `7e3aaa61`, 2026-11-20.

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
| 2 | Linescore hydration used by the scoreboard card (inning, count, bases) | `linescore{currentInning,currentInningOrdinal,inningState,inningHalf,isTopInning,innings[]{num,ordinalNum,home{runs,hits,errors,leftOnBase},away{…}},teams.home/away{runs,hits,errors,leftOnBase,isWinner},balls,strikes,outs}` plus `offense{batter,onDeck,inHole,pitcher}`, `defense{…}` | [`/api/v1/schedule?date=2026-08-28&hydrate=linescore`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=review,probablePitcher,decisions,linescore) (game `824638`) |
| 3 | Decisions (W/L/S) on cards and game header | `decisions{winner{id,fullName},loser{…},save{…}}` | [`/api/v1/schedule?date=2026-08-28&hydrate=decisions`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=review,probablePitcher,decisions,linescore) (game `824638`) |
| 4 | Manager-challenge counters, never derived | `review{hasChallenges,away{used,remaining},home{used,remaining}}` — observed `{"hasChallenges":false,"away":{"used":0,"remaining":1},"home":{"used":0,"remaining":1}}` | same response as row 1; cross-checked on [`/api/v1.1/game/744932/feed/live`](https://statsapi.mlb.com/api/v1.1/game/744932/feed/live) → `gameData.review{"hasChallenges":true,"away":{"used":1,"remaining":0},"home":{"used":0,"remaining":1}}` |
| 5 | ABS challenge counters, never derived | `gameData.absChallenges{hasChallenges,away{usedSuccessful,usedFailed,remaining},home{usedSuccessful,usedFailed,remaining}}` — observed `{"hasChallenges":true,"away":{"usedSuccessful":3,"usedFailed":0,"remaining":2},"home":{"usedSuccessful":5,"usedFailed":0,"remaining":2}}` | [`/api/v1.1/game/824638/feed/live?fields=gameData,review,absChallenges,…`](https://statsapi.mlb.com/api/v1.1/game/824638/feed/live) |
| 6 | Pre-ABS seasons must not be zero-filled | 2024 game `744932` returns `gameData.review` and **no** `absChallenges` object at all → the client shows no ABS counter rather than `0` | [`/api/v1.1/game/744932/feed/live?fields=gameData,review,absChallenges,…`](https://statsapi.mlb.com/api/v1.1/game/744932/feed/live) |
| 7 | Review event on a play | `allPlays[i].reviewDetails{isOverturned,inProgress,reviewType,challengeTeamId}` — observed `{"isOverturned":false,"inProgress":false,"reviewType":"MI","challengeTeamId":113}` | [`/api/v1/game/824474/playByPlay?fields=allPlays,about,atBatIndex,reviewDetails,reviewType,isOverturned,inProgress,reason,challengeTeamId`](https://statsapi.mlb.com/api/v1/game/824474/playByPlay) |
| 8 | Play text, score after the play, outs | `result{eventType,description,awayScore,homeScore,isOut}`, `about{atBatIndex,halfInning,inning}`, `count{balls,strikes,outs}` | [`/api/v1/game/824474/playByPlay`](https://statsapi.mlb.com/api/v1/game/824474/playByPlay) |
| 9 | Runs-at-risk test (only runs credited to the reviewed event) | `runners[]{movement{originBase,start,end,outBase,isOut,outNumber},details{event,eventType,movementReason,isScoringEvent,rbi,earned,playIndex}}` — observed a scoring runner with `"isScoringEvent":true,"playIndex":3` | [`/api/v1/game/824474/playByPlay`](https://statsapi.mlb.com/api/v1/game/824474/playByPlay) |
| 10 | `fields` projection used by the lean status sweep | Projected responses return exactly the requested keys (`dates,games,gamePk,review,…`) — verified the sweep shape is available without hydrations | [`/api/v1/schedule?startDate=2026-08-20&endDate=2026-08-28&fields=dates,games,gamePk,review,…`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-08-20&endDate=2026-08-28&hydrate=review&fields=dates,games,gamePk,review,hasChallenges,away,home,used,remaining) |
| 11 | Review code glosses (manager / umpire / ABS / instant replay) | Registry entries read verbatim: `IH` = "Instant Replay" (reason "Review"); `MF`/`MA`/`MI`/`MS` … = "Manager challenge: …"; `MJ` = "Player challenge: Pitch Result"; `NA`/`NH`/`NS` … = "Umpire review: …"; `NJ` = "Umpire Challenge: Pitch Result" | [`/api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) |
| 12 | Official-scorer pending rulings | `os_ruling_pending_primary` and `os_ruling_pending_prior`, both described "Official Scorer Ruling Pending" | [`/api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes) |
| 13 | Season inputs for the hit forecast | `stats[]{type{displayName},splits[]{season,stat{avg,obp,slg,ops,atBats,hits,homeRuns,baseOnBalls,strikeOuts,plateAppearances}}}` — observed `avg ".263"` for player `663538` | [`/api/v1/people/663538/stats?stats=season,statSplits&group=hitting&sitCodes=vl,vr&season=2026`](https://statsapi.mlb.com/api/v1/people/663538/stats?stats=season,statSplits&group=hitting&sitCodes=vl,vr&season=2026) |
| 14 | Team names/abbreviations loaded at runtime (not hard-coded) | `teams[]{id,name,teamName,abbreviation,teamCode,fileCode}` for `sportId=1` | [`/api/v1/teams?sportId=1`](https://statsapi.mlb.com/api/v1/teams?sportId=1) |
| 15 | Persistence backend contract used by `assets/js/feed-log.js` | `GET /api/feed-log?date=`, `POST /api/feed-log`, `GET /api/feed-log/stream?date=` (SSE `event: feed-log`), `GET /api/health` — all exercised locally with `node server.mjs` (see §3) | [`server.mjs`](../server.mjs) · [`github.com/snapquast73-boop/LIVPBP/blob/main/server.mjs`](https://github.com/snapquast73-boop/LIVPBP/blob/main/server.mjs) |
| 18 | Expected batting average (`xBA`), career H2H (`vsPlayer`), and `pitchNumber` | `expectedStatistics.splits[].stat.avg` (`".277"` on 682829), `vsPlayerTotal.splits[].stat{atBats,hits,avg}`, and `playEvents[].pitchNumber` (`3` on game 823243 play 54) | [`/api/v1/people/682829/stats?stats=expectedStatistics`](https://statsapi.mlb.com/api/v1/people/682829/stats?stats=season,expectedStatistics&group=hitting&season=2026) · [`/api/v1/people/682829/stats?stats=vsPlayer`](https://statsapi.mlb.com/api/v1/people/682829/stats?stats=vsPlayer&group=hitting&opposingPlayerId=656849) · [`/api/v1/game/823243/playByPlay`](https://statsapi.mlb.com/api/v1/game/823243/playByPlay?fields=allPlays,about,atBatIndex,playEvents,pitchNumber,reviewDetails,reviewType) |
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
| Team logo URL `https://www.mlbstatic.com/team-logos/team-cap-on-dark/{id}.svg` | **Unverified** | the image host answers the page-fetch channel with HTTP 500 (binary asset it cannot render), so existence could not be confirmed; the pattern is the one documented in `README.md`, and `<img onerror>` hides a broken logo | [`www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg`](https://www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg) |
| Player headshot URL | **Unverified** | `README.md` only shows a truncated path (`…/v1/people/{playerId}/headshot/67/current`); the host could not be reached from this environment | [`img.mlbstatic.com/mlb-photos/image/upload/v1/people/660271/headshot/67/current`](https://img.mlbstatic.com/mlb-photos/image/upload/v1/people/660271/headshot/67/current) |
| Original client source, `docs/`, `tools/` and tag `v1.0.0-stable-checkpoint` | **Missing (tag resolved)** | original files never uploaded (upstream repo is 404); `v1.0.0-stable-checkpoint` now tags verified commit `5a06fef` | [`/repos/buffedlizard55-lab/MLB-Live-PBP`](https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP) · [`tag v1.0.0-stable-checkpoint`](https://github.com/snapquast73-boop/LIVPBP/releases/tag/v1.0.0-stable-checkpoint) |
| Poll cadence, hit-model drivers, Before/Possible/Actual score tracker | **Resolved in the published build** | the merged build keeps the documented cadences (500 ms live / 250 ms in-review / 125 ms status sweep), all six forecast drivers, and the three-row score tracker; the model's own constants remain flagged as U-2/U-9 on `flagged.html` | [`people/660271/stats`](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog,expectedStatistics&group=hitting&sitCodes=vl,vr) · [`flagged.html`](../flagged.html) |

Nothing above was filled in by inference: the app shows "—" or omits the value when the payload does
not carry it.

## 5. Bug this audit found (and fixed)

The game page read team names/logos from `gameData.teams.<side>.team`. The official feed returns that
node **flat** — `{id, name, abbreviation, teamName, shortName, …, record{wins,losses,leagueRecord{…}}}`
— verified by fetching the full `/api/v1.1/game/824638/feed/live` on 2026-11-20 (no `fields`
projection, so nothing could be flattened by the request). A nested `team` object belongs to
`/api/v1/schedule`, not to `feed/live`. Result on the published site: the game header showed the score
but **no team names and no logos**. Fixed by accepting both shapes (`teamNode()` in
`assets/js/game.js`), and `tests/jsdom-render-test.mjs` now fails if the header loses either team
name (`game: header shows both teams`) or the logo request (`game: team logos requested`).
