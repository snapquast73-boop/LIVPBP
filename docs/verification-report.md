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

| Page | Stylesheet | Scripts |
|---|---|---|
| `index.html` | `assets/css/style.css` | `api.js`, `ui.js`, `reviews.js`, `feed-log.js`, `scoreboard.js` |
| `game.html` | `assets/css/style.css` | + `props.js`, `game.js` |
| `reviews.html` | `assets/css/style.css` | + `reviews-feed.js` |

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

## 5. Flagged for review (see `flagged.html` for the rendered table)

| # | Item | Why it is flagged |
|---|---|---|
| U-1 | `TEAM_COLORS` palette | presentation only; the API publishes no club colours |
| U-2 | Hit-model constants (count factors, clamps 13–62 / 10–78 %, tier cut-offs, weights) | the README states the behaviour, but the derivation scripts were not uploaded |
| U-3 | `server.mjs` crash + path-containment defects | out of scope; not used by Pages |
| U-4 | `data/` not in `.gitignore` | **fixed** in this change (no other ignore rule touched) |
| U-5 | `v1.0.0-stable-checkpoint` tag | does not exist in this repository |
| U-6 | Upstream repo / original assets | 404; reconstructed, not restored |
| U-7 | Original `docs/*` and `tools/*` | not uploaded, not recoverable |
| U-8 | Headshot URL transformation | README truncates it; host unreachable from the sandbox |
| U-9 | Remaining-PA estimate for the `≥1 hit` projection | estimate, not an official figure |
| U-10 | 500/250/125 ms polling cadence | the StatsAPI publishes no rate limit; cadence is a judgement call |
| U-11 | Shared Feed Log across browsers | Pages is static; sharing needs `node server.mjs` |
| I-8 | “Confirmed” outcome | payload has only `isOverturned`, so “stands” vs “confirmed” is indistinguishable |
