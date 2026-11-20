# Row provenance: World Series Game 5, 2024

**Finding:** For game `775296`, MLB’s schedule and standalone linescore disagree with MLB’s live feed about the home error total. Leave the disputed value blank and flag it; don’t choose one silently. This audit checked a single historical game on 2026-11-20, not every game or the deployed renderer.

## Reproducible checks for the restored UI

The [MLB schedule][schedule] supplies the date, game ID and live feed path. The following expectations are observations, not fixtures to ship as fallbacks.

| Row or cell | Confirmed display value | Verification note | Official source |
| --- | --- | --- | --- |
| Scoreboard, 2024-10-30 | Los Angeles Dodgers 7, New York Yankees 6; Final | `dates[0].games[0].teams` and `.status` | [MLB schedule][schedule] |
| Linescore, away R/H/E | 7 / 7 / 0 | Zero errors is explicitly present. | [MLB linescore][line] and [MLB live feed][live] |
| Linescore, home R/H | 6 / 8 | Both sources agree. | [MLB linescore][line] and [MLB live feed][live] |
| Linescore, home E | | Unverified: `teams.home.errors` is 2 in the standalone response, 3 under `liveData.linescore` in the feed. No adjudication. | [MLB linescore][line] and [MLB live feed][live] |
| Last play | Strikeout, bottom 9; 7–6 | `currentPlay.result` and `.about` | [MLB play-by-play][play] |
| Manager challenges, away used / remaining | 0 / 2 | `gameData.review.away` | [MLB live feed][live] |
| Manager challenges, home used / remaining | 1 / 1 | `gameData.review.home` | [MLB live feed][live] |
| ABS challenges, remaining | | Unverified: projection requests `absChallenges`, but no such object was returned. Do not render 0. | [MLB live feed][live] |
| Player ID 676508, game batting hits | | Unverified: empty `stats.batting` in the projection. The 0 under `seasonStats.batting.hits` is a different statistic. | [MLB box score][box] |

## Uploaded endpoint table, line by line

These correspond to the [uploaded README, lines 161–172](https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c40143a7fff9d24853418002e008b79b1/README.md#L161-L172). Successful examples verify **response fields only**, not browser CORS, original polling intervals, timing, or model quality. Blank results are unverified; a failed fetch is not proof that a URL is broken for users.

| README line | Confirmed result | Scope / limitation | Official example for manual review |
| --- | --- | --- | --- |
| 161 | `gamePk: 775296` | Hydrated schedule | [MLB schedule][schedule] |
| 162 | `statusCode: F` | Schedule projection; polling cadence unverified | [MLB status projection](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&fields=dates,games,gamePk,season,status,abstractGameState,codedGameState,detailedState,statusCode,reason,startTimeTBD,abstractGameCode) |
| 163 | `statusCode: F` | Single game; timing and byte estimate unverified | [MLB game status projection](https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=gameData,status,abstractGameState,codedGameState,detailedState,statusCode,reason,startTimeTBD,abstractGameCode) |
| 164 | `IH`: Instant Replay | Observed registry entry | [MLB status registry](https://statsapi.mlb.com/api/v1/gameStatus?fields=statusCode,reason) |
| 165 | Final | `gameData.status.detailedState` | [MLB v1.1 live feed][live] |
| 166 | | Unverified: could not retrieve legacy feed for the sample | [MLB legacy feed](https://statsapi.mlb.com/api/v1/game/775296/feed/live?fields=gamePk) |
| 167 | Individual JSON responses | All three read; does not test the app’s fallback logic | [MLB plays][play], [box][box], [linescore][line] |
| 168 | Strikeout | `currentPlay.result.event` | [MLB play-by-play][play] |
| 169 | | Unverified: image not returned by page retrieval tool | [MLB team logo](https://www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg) |
| 170 | | Unverified: image not returned by page retrieval tool | [MLB headshot](https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/660271/headshot/67/current) |
| 171 | `expectedStatistics`, `season`, `statSplits`, `gameLog` | Both responses list those types. Historical HTTP 400 claim unverified here. | [MLB hitter stats](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=expectedStatistics,season,statSplits,gameLog&group=hitting&sitCodes=vl,vr&season=2024&fields=stats,type,displayName), [pitcher stats](https://statsapi.mlb.com/api/v1/people/543037/stats?stats=expectedStatistics,season,statSplits,gameLog&group=pitching&sitCodes=vl,vr&season=2024&fields=stats,type,displayName) |
| 172 | 4 hits / 23 at bats | Returned `vsPlayerTotal`; not a forecast or an as-of-game historical value | [MLB matchup](https://statsapi.mlb.com/api/v1/people/660271/stats?stats=vsPlayer&group=hitting&opposingPlayerId=543037&fields=stats,type,displayName,splits,stat,hits,atBats) |

## Requests for the integration owner

- Add an official link **in each rendered data row**, not just in a page footer. Cite the endpoint used, including date, player or game ID. Use the fallback URL when it supplied the data.
- Keep absent cells empty, annotate which field is unverified, and retain real zeros. The [candidate count renderer](https://github.com/snapquast73-boop/LIVPBP/blob/7caa562797ffa4185b068de6b6d0f6727696ebfd/assets/js/ui.js#L65-L76) substitutes zero for absent balls, strikes and outs. Exercise `countDots({outs:0})`; only the outs count has evidence.
- Publish the conflicting home error total above on **Flagged for Review** with both links. When validating the UI, distinguish a discrepancy in MLB’s sources from a rendering bug.

[schedule]: https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30&hydrate=probablePitcher,linescore,decisions,review
[line]: https://statsapi.mlb.com/api/v1/game/775296/linescore?fields=teams,away,home,runs,hits,errors
[live]: https://statsapi.mlb.com/api/v1.1/game/775296/feed/live?fields=gamePk,gameData,absChallenges,review,status,abstractGameState,detailedState,away,home,used,remaining,liveData,linescore,teams,runs,hits,errors
[play]: https://statsapi.mlb.com/api/v1/game/775296/playByPlay?fields=currentPlay,result,event,eventType,awayScore,homeScore,about,inning,halfInning
[box]: https://statsapi.mlb.com/api/v1/game/775296/boxscore?fields=teams,away,home,teamStats,batting,runs,hits,errors
