# Verification report — MLB Live PBP rebuild

Date: 2026-11-20 · Session: `arena-f7276bda` · Branch: `arena/f7276bda-livpbp`
Published summary: [`flagged.html`](../flagged.html) (the same evidence, rendered on the site).
Independent field-by-field re-verification of the StatsAPI responses the site reads (and the one
rendering bug it found): [`docs/statsapi-field-map.md`](statsapi-field-map.md).

Every claim below was checked against a source fetched during this session. Where a value could
not be confirmed, the row is marked **Unverified** and the value is left blank — nothing is
inferred or filled in.

---

## 1. What the upload contained

`main` @ `aef1a74c40143a7fff9d24853418002e008b79b1` (“Add files via upload”):

```
.gitignore  404.html  LICENSE  README.md  game.html  index.html  reviews.html  server.mjs
```

Source: <https://github.com/snapquast73-boop/LIVPBP/commit/aef1a74c40143a7fff9d24853418002e008b79b1>

There is **no `assets/` directory**, although the three pages load:

| Page | Stylesheet | Scripts | Source |
|---|---|---|---|
| `index.html` | `assets/css/style.css` | `api.js`, `ui.js`, `reviews.js`, `feed-log.js`, `scoreboard.js` | <https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c40143a7fff9d24853418002e008b79b1/index.html> |
| `game.html` | `assets/css/style.css` | + `props.js`, `game.js` | <https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c40143a7fff9d24853418002e008b79b1/game.html> |
| `reviews.html` | `assets/css/style.css` | + `reviews-feed.js` | <https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c40143a7fff9d24853418002e008b79b1/reviews.html> |

Consequence, confirmed on the deployed site (<https://snapquast73-boop.github.io/LIVPBP/>): the
page renders its static shell only — no games, no styling, no polling.

## 2. Why the assets could not be restored

The README's live-demo repository is gone:

```
GET https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP  ->  404 Not Found
GET https://api.github.com/search/repositories?q=MLB-Live-PBP    ->  total_count: 0
```

So the original code is not public any more. The assets were **reconstructed** against the
contract the pages and README define (globals and methods the HTML calls, element ids, classes,
endpoints, cadences, feature list). This is recorded as `U-6` on `flagged.html`.

## 3. API shapes — verified against the live StatsAPI (2026-11-20)

| # | Claim | Source |
|---|---|---|
| T-1 | `dates[].games[]` with `gamePk`, `gameDate`, `officialDate`, `status{…}`, `teams.home/away.team{id,name}`, `score`, `isWinner`, `venue.name` | <https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-15> |
| T-2 | Club abbreviations (LAD, CIN, AZ, ATH, CWS, NYY, MIL, …) | <https://statsapi.mlb.com/api/v1/teams?sportId=1> |
| T-3 | Review codes and their official wording: `MJ` “Player challenge: Pitch Result”, `NJ` “Umpire Challenge: Pitch Result”, `MA` “Manager challenge: Tag play”, `MD` “Manager challenge: Catch/drop in outfield”, `NA` “Umpire review: Tag play”, `NH` “Umpire review: Home run”, `IH` “Instant Replay” | <https://statsapi.mlb.com/api/v1/gameStatus> |
| T-4 | `reviewDetails = {isOverturned, inProgress, reviewType, challengeTeamId}`, on plays **and** on `playEvents[]` | <https://statsapi.mlb.com/api/v1/game/823109/playByPlay> |
| T-5 | `gameData.review{hasChallenges, away/home{used,remaining}}`; also via schedule `hydrate=review` | <https://statsapi.mlb.com/api/v1.1/game/824466/feed/live?fields=gameData,review,hasChallenges,away,home,used,remaining> · <https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-01&hydrate=review&fields=dates,games,gamePk,review,hasChallenges,away,home,used,remaining> |
| T-6 | `gameData.absChallenges{hasChallenges, away/home{usedSuccessful,usedFailed,remaining}}` | <https://statsapi.mlb.com/api/v1.1/game/824466/feed/live?fields=gameData,absChallenges,hasChallenges,away,home,usedSuccessful,usedFailed,remaining> |
| T-7 | `os_ruling_pending_primary` / `os_ruling_pending_prior`, description “Official Scorer Ruling Pending” | <https://statsapi.mlb.com/api/v1/eventTypes> |
| T-8 | Run attribution: `runners[].details{isScoringEvent, playIndex}` where `playIndex` indexes `playEvents[]` | <https://statsapi.mlb.com/api/v1/game/824466/playByPlay> |
| T-9 | Team logos at `https://www.mlbstatic.com/team-logos/team-cap-on-dark/{teamId}.svg` | <https://www.mlbstatic.com/team-logos/team-cap-on-dark/119.svg> (URL documented in the README; host not reachable from the build sandbox) |
| T-10 | Official scoring changes are made by the Official Scorer / Elias / after club review | <https://www.mlb.com/official-information/scoring-changes> |
| T-11 | Pre-fix deployed site was an inert shell | <https://snapquast73-boop.github.io/LIVPBP/> |

Real review events observed in game `823109` on 2026-08-01 (used to shape the parser and the
test fixtures): `MJ` overturned, `MD` stands, `MA` overturned, `NA` stands.

## 4. Behaviour implemented and how it was verified

Network-free harness: `node tools/smoke-test.mjs` (jsdom + a local static server; only `fetch`
is stubbed, with payloads matching the shapes in §3). 40 assertions, all passing:

1. **reviews.js** — code → official label via the registry; ABS detection; boundary detection;
   pitch-level vs play-level extraction; run-at-risk attribution limited to the reviewed event;
   pending-ruling detection; scoring-change diff (reclassification vs payload edit); counter
   regression detection with no zero-filling.
2. **index.html** — three game cards with team names, scores, venue, records, probables,
   decisions; review chip from the official status code; filters; date label; no error state.
3. **game.html** — header (teams, status, venue, weather), at-bat module (count, outs, occupied
   bases, on-deck/in-the-hole), linescore (9 innings + R/H/E), play-by-play with pitch detail,
   review tab badge and cards, box score (batting + pitching), review banner.
4. **props.js** — forecast inside the documented clamp band, six drivers, tier, `≥1 hit in next N
   PAs` > per-PA rate, inputs read from the payload (not a guessed baseline), rendered headline.
5. **reviews.html** — all five tracked event types present; All tab excludes ABS; ABS tab isolates
   them; runs-at-risk row shows the official score tracker; summary tiles; localStorage
   persistence; sound/notification preferences.
6. **feed-log.js** — merge keeps both sides, is idempotent, accumulates irregularity notes.
7. **Static integrity** — every local `href`/`src` on `index.html`, `game.html`, `reviews.html`,
   `404.html`, `flagged.html` resolves to a file.
8. **Offseason paths** — an empty slate renders a message (not an error state) and one cached range
   query offers the most recent date that did have games.
9. **Parallel session's checker** — `node tools/restoration-check.mjs` (kept from the earlier
   restoration) also passes: local references, JS syntax, and the `server.mjs` API contract.
10. **Third-party cross-check** — session `7e3aaa61` added `tests/` with payloads captured verbatim
    from the live StatsAPI (`tests/fixtures/feed-824638-review.json`, `gamestatus.json`,
    `schedule-2026-08-28.json`). Running their independent suite against this implementation
    (`node tests/run-all.mjs`) gives **37 jsdom checks passed**, link-check OK (39 local refs),
    contract-check OK (8 bindings across 5 pages) and syntax OK — a second, separately written
    verification of the same pages.

## 5. Flagged for review (see `flagged.html` for the rendered table)

| # | Item |Confirmed official value | Why it is flagged / resolution | Official source |
|---|---|---|---|---|
| U-1 | `TEAM_COLORS` palette | | presentation only; the API publishes no club hex colours | <https://statsapi.mlb.com/api/v1/teams?sportId=1> |
| U-2 | Hit-model constants (count factors, clamps 13–62 / 10–78 %, tier cut-offs, weights) | | the README states the behaviour, but the derivation scripts were not uploaded | <https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,statSplits,gameLog,expectedStatistics&group=hitting&sitCodes=vl,vr> |
| U-3 | `server.mjs` crash + path-containment defects | HTTP 400 + `REPO_DIR + path.sep` | **fixed** (`try/catch` around `decodeURIComponent` + separator containment check) | <https://github.com/snapquast73-boop/LIVPBP/blob/main/server.mjs> |
| U-4 | `data/` not in `.gitignore` | `data/` | **fixed** in this change (no other ignore rule touched) | <https://github.com/snapquast73-boop/LIVPBP/blob/main/.gitignore> |
| U-5 | `v1.0.0-stable-checkpoint` tag | `5a06fef` | **resolved** — tagged on verified merge commit `5a06fef` | <https://github.com/snapquast73-boop/LIVPBP/releases/tag/v1.0.0-stable-checkpoint> |
| U-6 | Upstream repo / original assets | | 404; reconstructed, not restored | <https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP> |
| U-7 | Original `docs/*` and `tools/*` | | not uploaded, not recoverable | <https://api.github.com/repos/snapquast73-boop/LIVPBP/git/trees/aef1a74c40143a7fff9d24853418002e008b79b1?recursive=1> |
| U-8 | Headshot URL transformation | | README truncates it; host unreachable from the sandbox | <https://img.mlbstatic.com/mlb-photos/image/upload/v1/people/660271/headshot/67/current> |
| U-9 | Remaining-PA estimate for the `≥1 hit` projection | | estimate, not an official figure | <https://statsapi.mlb.com/api/v1.1/game/824638/feed/live?fields=liveData,linescore,currentInning,inningState> |
| U-10 | 500/250/125 ms polling cadence | | the StatsAPI publishes no numeric rate limit; cadence is a judgement call | <https://www.mlb.com/official-information/terms-of-use> |
| U-11 | Shared Feed Log across browsers | `localStorage` on Pages | Pages is static; cross-browser sharing needs `node server.mjs` | <https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#limits-on-use-of-github-pages> |
| I-8 | “Confirmed” outcome | `isOverturned` boolean | structured payload has only `isOverturned`, so “stands” vs “confirmed” is indistinguishable; MLB's free-text description (which may say “confirmed”) is displayed verbatim | <https://statsapi.mlb.com/api/v1.1/game/824466/feed/live> |
| L-1..L-4 | Live-StatsAPI field alignment (`expectedStatistics.avg`, `vsPlayerTotal`, `boxscore.seasonStats`, PA-ending `MJ` & `MF`) | `.277` (`stat.avg`) / `vsPlayerTotal` | **fixed & regression-tested** by session `1f908513` (44/44 checks in `tools/smoke-test.mjs`) | <https://statsapi.mlb.com/api/v1/people/682829/stats?stats=season,expectedStatistics&group=hitting&season=2026> |
| RR-01..RR-06 | Replay Feed comparison handoff (`dateSeq` guard, official `pitchNumber`, scoring changes in `All`, per-row MLB API links, smoke readiness) | `pitchNumber: 3` (play 54, game 823243) | **fixed & regression-tested** by session `1f908513`; `RR-05` audio cue left unverified (blank) | <https://statsapi.mlb.com/api/v1/game/823243/playByPlay?fields=allPlays,about,atBatIndex,playEvents,pitchNumber,reviewDetails,reviewType> |

---

## 6. Re-verification pass — session `d105b565` (2026-11-22)

Every value below was fetched again on **2026-11-22** from the official
`statsapi.mlb.com` (or read from the deployed Pages site) — nothing was carried over from an
earlier session's notes without re-fetching it. Blank cells mean the official payload does not
publish the value; no cell is inferred.

| # | Claim | Value read from the official response | Official source | Status |
|---|---|---|---|---|
| R-1 | `UI.TEAM_ABBR` (30 clubs) = official `abbreviation` | all 30 match (incl. `AZ` 109, `ATH` 133, `CWS` 145, `KC` 118, `SD` 135, `TB` 139, `WSH` 120) | <https://statsapi.mlb.com/api/v1/teams?sportId=1&fields=teams,id,name,abbreviation,teamName&season=2026> | Verified |
| R-2 | `FALLBACK_REASONS` in `assets/js/reviews.js` matches the API wording for every `M*`/`N*` code | `MA…MV`, `NA…NW`, `MJ`/`NJ` “Pitch Result”, `MF` “Close play at 1st”, `IH` reason “Review” / detailedState “Instant Replay”; `MX`/`NX` publish no `reason` and the code adds none | <https://statsapi.mlb.com/api/v1/gameStatus> | Verified |
| R-3 | Hydrated schedule card fields used by `scoreboard.js` | game 849799: MIL 4 / TB 1, `leagueRecord` 4-1 & 1-4, W Misiorowski, L Rasmussen, Tropicana Field, game 5 of 7 | <https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-10-28&hydrate=probablePitcher,linescore,decisions,review> | Verified |
| R-4 | `expectedStatistics` publishes xBA in `stat.avg` | `{"avg":".285","slg":".549","woba":".393"}` (player 660271, 2026); no `xba` key | <https://statsapi.mlb.com/api/v1/people/660271/stats?stats=expectedStatistics&group=hitting&season=2026> | Verified |
| R-5 | H2H is `vsPlayerTotal` (career) + `vsPlayer` (per season) | Chourio vs Rasmussen: 0-for-3 career, 0-for-3 in 2025 | <https://statsapi.mlb.com/api/v1/people/694192/stats?stats=vsPlayer&group=hitting&opposingPlayerId=656876> | Verified |
| R-6 | Season lines at `boxscore.teams.<side>.players.ID<id>.seasonStats` | `ID806198.seasonStats.batting = {hits:17, avg:".354", atBats:48}` | <https://statsapi.mlb.com/api/v1/game/849799/boxscore> | Verified |
| R-7 | `os_ruling_pending_primary` / `_prior` are real event types | both present, description “Official Scorer Ruling Pending” | <https://statsapi.mlb.com/api/v1/eventTypes> | Verified |
| R-8 | ABS / manager challenge counters for game 849799 | `absChallenges.away/home = {usedSuccessful:1, usedFailed:0, remaining:2}`, `review.away/home = {used:0, remaining:2}` — matches the two overturned ABS chips the page printed | <https://statsapi.mlb.com/api/v1.1/game/849799/feed/live?fields=gameData,absChallenges,hasChallenges,away,home,usedSuccessful,usedFailed,remaining,review,used> | Verified |
| R-9 | Deployed game page reproduces the official linescore for game 849799 | MIL `0 1 0 0 1 2 0 0 0 · 4 8 2`, TB `0 0 0 0 0 0 0 0 1 · 1 4 0` — identical | <https://statsapi.mlb.com/api/v1/game/849799/linescore> · <https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=849799> | Verified |
| R-10 | Deployed scoreboard / replay feed / flagged page execute and render | offseason slate: scoreboard offers `Wed Oct 28, 2026`; feed renders 8 summary tiles + scan line | <https://snapquast73-boop.github.io/LIVPBP/> · <https://snapquast73-boop.github.io/LIVPBP/reviews.html> | Verified |
| R-11 | `?date=YYYY-MM-DD` deep links on the scoreboard and the replay feed | added this pass; URL follows the selected date; 3 new checks in `tools/smoke-test.mjs` §[11] | <https://github.com/snapquast73-boop/LIVPBP/blob/main/tools/smoke-test.mjs> | Verified |

### Irregularities opened in this pass

| # | Irregularity | Official evidence | Resolution | Status |
|---|---|---|---|---|
| D-1 | Two official endpoints disagree on errors for the same team: game 775296 home `errors` = **2** in `/api/v1/game/775296/linescore`, **3** in `/api/v1.1/game/775296/feed/live` | <https://statsapi.mlb.com/api/v1/game/775296/linescore> · <https://statsapi.mlb.com/api/v1.1/game/775296/feed/live> | Page renders the `feed/live` value (single request feeds the page); nothing corrected or guessed — flagged for the owner | Flagged |
| D-2 | Per-row “source” links opened `/linescore` and `/boxscore`, not the request the rows are rendered from, so for games like 775296 the link showed a different number than the row | same as D-1 (<https://statsapi.mlb.com/api/v1.1/game/775296/feed/live>) | **Fixed:** links now open `/api/v1.1/game/<pk>/feed/live` (`liveData.linescore` / `liveData.boxscore`) | Fixed |
| D-3 | Original client source still unavailable (reconstruction, not a restoration) | <https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP> → 404 (re-checked 2026-11-22) | Behaviour verified against the official API instead; no byte-for-byte comparison is possible | Unverified (source missing) |
| D-4 | Club hex colours and hit-model constants | | | Unverified — presentation/model tuning, no official value exists; carried from U-1/U-2 · <https://statsapi.mlb.com/api/v1/teams?sportId=1> |

### Checks run on this pass

```text
npm ci && npm test              -> 47 passed, 0 failed   (was 44; +3 deep-link checks)
node tests/run-all.mjs          -> syntax OK, 40 local refs OK, 8 bindings OK, 37/37 jsdom
node tools/restoration-check.mjs-> ALL CHECKS PASSED
```

---

## 7. Line-by-line functional & provenance parity pass — session `af75fbfd` (2026-11-22)

Every item below was uncovered during a line-by-line audit of all HTML pages, JS modules, `server.mjs`, `README.md`, and live reference deployments (`LIVPBP2`, `POSTSSNALRT`) against official `statsapi.mlb.com` responses on 2026-11-22. Where an official source does not publish a value, the confirmed-value cell is left blank and never inferred.

| # | Item | Confirmed official value | Resolution | Official source | Status |
|---|---|---|---|---|---|
| AF-1 | Replay Feed ABS challenge counters (`usedSuccessful`, `usedFailed`, `remaining`) & both-teams summary (`Challenges left: AWAY X MGR · Y ABS — HOME …`) | `absChallenges.away: {usedSuccessful:3, usedFailed:0, remaining:2}`, `home: {usedSuccessful:5, usedFailed:0, remaining:2}` (game 824638) | **Fixed:** `reviews-feed.js` now fetches leaf-projected `feed/live?fields=gameData,review,absChallenges,…` alongside `playByPlay` (`COUNTERS_FIELDS`, ~300 B) and renders both per-team counter lines and hover/live-strip both-teams summaries via `Reviews.countersSummary`. | <https://statsapi.mlb.com/api/v1.1/game/824638/feed/live?fields=gameData,review,absChallenges,hasChallenges,away,home,used,remaining,usedSuccessful,usedFailed> | Fixed & regression-tested |
| AF-2 | Counter-regression detector (`Reviews.counterRegression`) ignored nested `{manager, abs}` snapshots | `away/home.{used,remaining,usedSuccessful,usedFailed}` | **Fixed:** `Reviews.counterRegression` now inspects both flat `{away, home}` and nested `{manager, abs}` snapshots so backwards-moving official counters are flagged instead of silently ignored. | <https://statsapi.mlb.com/api/v1.1/game/849799/feed/live?fields=gameData,review,absChallenges,hasChallenges,away,home,used,remaining,usedSuccessful,usedFailed> | Fixed & regression-tested |
| AF-3 | Pre-ruling `Before review` score inferred on already-resolved `runsAtRiskCount === 0` reviews | | **Fixed (inference removed):** `reviews-feed.js` no longer sets `scoreTracker.before = review.scoreAfter` when a page opens after resolution; unobserved pre-ruling scores stay `null` (`— (not observed before ruling)`), while observed `Actual after (official)` scores still render. | <https://statsapi.mlb.com/api/v1/game/824638/playByPlay> | Fixed & regression-tested |
| AF-4 | Persistent red `#banner` for active `runsAtRiskCount > 0` reviews on `reviews.html`, offseason recent-date jump on `reviews.html`, and cross-page `?date=` links (`index.html` ↔ `reviews.html` ↔ `game.html`) | `2026-10-28` (`totalGames: 1`, game 849799) | **Fixed:** `reviews-feed.js` renders `#banner` while any review with runs at risk is in progress, offers the cached 45-day `scheduleRange` jump button on empty offseason slates, and preserves `?date=` across topbar/card links. | <https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-01&endDate=2026-11-22&fields=dates,date,totalGames> | Fixed & regression-tested |
| AF-5 | Official ABS challenger role (`batter` / `catcher` / `pitcher`), `playEvents[].index` alignment for `runsForEvent`, `isPitch`-only pitch counts, strict calendar `isValidISODate`, non-zero-filled `UI.countDots`/`outsDots`, and `gameFeed` 404 fallback bundle | `"Jonah Heim challenged (pitch result)…"` (`challengeTeamId: 133`, game 824960 play 34) | **Fixed:** `reviews.js`, `game.js`, `ui.js`, and `api.js` derive challenger role strictly from official play descriptions / `battingSide` vs `challengerSide`, pass `events[playIndex].index` to `runsForEvent`, render `—` when count/outs are absent rather than zero-filling `0-0, 0 outs`, reject invalid calendar dates (e.g. `2026-02-31`), and wire the documented `/playByPlay` + `/boxscore` + `/linescore` 404 fallback. | <https://statsapi.mlb.com/api/v1/game/824960/playByPlay?fields=allPlays,about,atBatIndex,inning,halfInning,result,description,reviewDetails,reviewType,challengeTeamId> | Fixed & regression-tested |
| AF-6 | `server.mjs` & `feed-log.js` `atBatIndex === 0` falsy merge-key collision and `server.mjs` dotfile/symlink static serving | HTTP `403` on `/.git/HEAD`; distinct key `gamePk:0` | **Fixed:** `entryKey()` and `makeKey()` check `!== undefined && !== null && !== ''` so `atBatIndex: 0` never collapses to `""`, `server.mjs` preserves top-level entry fields during merges, and `server.mjs` blocks hidden dotfile paths (except `.nojekyll`) and symlinks (`fs.lstat`). | <https://github.com/snapquast73-boop/LIVPBP/blob/main/server.mjs> | Fixed & regression-tested |
| AF-7 | Game `824960` (`2026-08-08`, BAL @ ATH, `atBatIndex: 80` Bot 10) carries `reviewDetails: {reviewType: "MJ", challengeTeamId: 110, isOverturned: false}` on a pitch event, yet `result.description` omits challenge wording | `reviewType: "MJ"`, `challengeTeamId: 110` | **Flagged for review:** structured `reviewDetails` and `result.description` differ in verbosity on mid-PA ABS challenges; the app reads structured `reviewDetails` + `challengeTeamId` without inventing missing prose. | <https://statsapi.mlb.com/api/v1/game/824960/playByPlay?fields=allPlays,about,atBatIndex,inning,halfInning,result,description,playEvents,index,details,reviewDetails,isOverturned,inProgress,reviewType,challengeTeamId> | Flagged |

