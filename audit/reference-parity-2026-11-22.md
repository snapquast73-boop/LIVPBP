# Reference-parity functional pass — line-by-line record

2026-11-22 · session `6e2a58d9` (branch `arena/6e2a58d9-livpbp`) · task board `G-1…G-9` in [COORDINATION.md](../COORDINATION.md)

Goal (user brief): keep the site exactly as it is except that it must **work functionally like the
two supplied reference sites** —
[LIVPBP2/reviews.html](https://snapquast73-boop.github.io/LIVPBP2/reviews.html) and
[POSTSSNALRT/reviews.html](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html) — which the
user reports as "working as before". The references are themselves reconstructions of the lost
upstream (`buffedlizard55-lab/MLB-Live-PBP`, still
[404](https://api.github.com/repos/buffedlizard55-lab/MLB-Live-PBP)), so where they disagree, the
**surviving original contract** decides: the uploaded [`README.md`](https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c814f4df9a2c57e766999ab7b1274a3c0/README.md)
and [`reviews.html`](https://github.com/snapquast73-boop/LIVPBP/blob/aef1a74c814f4df9a2c57e766999ab7b1274a3c0/reviews.html)
at the upload commit `aef1a74c`. Baseball values come only from the official MLB StatsAPI;
first-party behavior claims link GitHub sources. Items that cannot be confirmed from those sources
are marked **unverified** and published on [flagged.html §13](../flagged.html) — never inferred.

## Where each functional expectation comes from

| Expectation (verbatim source text) | Source |
| --- | --- |
| Filters: "**All** (every category except ABS pitch challenges…), **ABS**, **Challenges**, **Reviews**, **Boundary Calls**, **Under Review**, **⚠️ Runs at Risk**" + "the ✏️ Scoring Changes tab and in the All feed" | uploaded `README.md` · uploaded `reviews.html` footer |
| Sound: "a gentle raindrop chime for new challenges/reviews/boundary calls, official-scorer pending rulings and official scoring changes (not ABS), and the same chime whenever an active review could remove a run already on the scoreboard" | uploaded `reviews.html`, sound-button `title` |
| Counter tracker: "the challenging team's current official counter (e.g. `CIN: 2 ABS challenges left now (2 successful · 0 failed)` or `PIT: 1 manager challenge left now (0 used)`), with the both-teams summary (`Challenges left: CIN 1 MGR · 2 ABS — CHC 1 MGR · 2 ABS`) on hover and on the Under-Review live strip" | uploaded `README.md` |
| "boundary-call reviews (potential home runs / fair-foul at the wall)" … "`NH` = boundary-call review" … "boundary reviews are not charged to a team's counter, so those rows show no counter line by design" | uploaded `README.md` |
| "A boundary review with no currently credited run says “score impact pending” and does not invent an alternate score." | uploaded `README.md` |
| "If the page opens only after resolution, it shows an attributable official Actual-after score when available and honestly marks Before/Possible as not observed." | uploaded `README.md` |
| "plays that vanish from the payload are flagged as irregularities for review, never corrected or hidden" | uploaded `reviews.html` footer |
| Deep-linkable dates (`reviews.html?date=YYYY-MM-DD`) | [LIVPBP2 `reviews-feed.js` init/syncDateUI](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews-feed.js#L66-L67) (implemented on `main` by session `d105b565`, PR #23) |

## Line-by-line results

| # | Contract item | Before this pass | After this pass | References | Sources |
| --- | --- | --- | --- | --- | --- |
| G-1 | `?date=` deep link + URL sync on the replay feed | ignored `?date=`, address bar static (reproduced live: `/LIVPBP/reviews.html?date=2026-08-28` rendered the empty "today") | **already fixed on `main`** by parallel sessions `d105b565` (PR #23) + `aa6c1d7b` (PR #24) while this session was claiming; verified, not re-implemented | LIVPBP2 has it; POSTSSNALRT does not | [LIVPBP2](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews-feed.js#L66-L67) · [our live page](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-08-28) |
| G-2 | Empty-state notice in the feed list | blank list | "No tracked events for this date and filter yet. …" (exact original wording **unverified** — flagged) | both render one | [LIVPBP2](https://snapquast73-boop.github.io/LIVPBP2/reviews.html?date=2026-11-21) · [POSTSSNALRT](https://snapquast73-boop.github.io/POSTSSNALRT/reviews.html) |
| G-3 | Chimes for **pending rulings** and **scoring changes**; runs-at-risk chime "whenever an active review could remove a run"; never routine ABS | chimes only on new non-ABS reviews + new-at-risk rows | all four contract events chime (raindrop cue); risk chime fires once per review the moment the condition first becomes visible (incl. mid-review); restored rows never re-chime | LIVPBP2 chimes pending but not scoring changes; POSTSSNALRT chimes everything incl. ABS (deviates from the button title) | uploaded `reviews.html` L39 (button title) · [LIVPBP2 alertable filter](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews-feed.js#L334-L339) |
| G-4 | Counter tracker: `CIN: …` prefix line + `Challenges left: … — …` summary on hover and on the Under-Review strip | no prefix, no summary anywhere; **ABS counters never rendered at all** | prefix + hover summary + strip summary; ABS counters loaded from the verified lean `feed/live` projection | LIVPBP2 shows the summary also as a visible row line (not copied — README says hover + strip) | uploaded `README.md` L50–54 · [schedule `hydrate=review` (manager counters only)](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=review&fields=dates,games,gamePk,review,hasChallenges,away,home,used,remaining) · [lean feed/live counters](https://statsapi.mlb.com/api/v1.1/game/824960/feed/live?fields=gameData,absChallenges,hasChallenges,away,home,usedSuccessful,usedFailed,remaining,review,used) · [LIVPBP2 countersSummary](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews.js#L156-L170) |
| G-5 | Boundary review with no credited run says “score impact pending” | nothing rendered | "Possible after (conditional): score impact pending" (never invents a score) | LIVPBP2 renders the same sentence | uploaded `README.md` L31–33 · [LIVPBP2 tracker](https://github.com/snapquast73-boop/LIVPBP2/blob/cbcdddece88023ca512a18b7a1165b77d2caa7a7/assets/js/reviews-feed.js#L522-L525) |
| G-6 | Before/Possible "marked as not observed" when the page opens after resolution | missing lines silently omitted | "– (not observed)" on Before/Possible (exact wording **unverified** — flagged; the marking itself is contractual) | LIVPBP2 renders "—"; POSTSSNALRT omits | uploaded `README.md` L33–35 |
| G-7 | Boundary-call classification | every review whose reason was in a boundary-reason list (incl. charged manager challenges MD/MH/MO/MT/MS) got a "Boundary call" chip | boundary = umpire-side reviews of home run / fair-foul / stadium-boundary plays (`NH` family; README "NH = boundary-call review"); charged manager challenges of those plays remain Challenges rows with counter lines | LIVPBP2 identical rule; POSTSSNALRT boundary = `MS`/`NS` codes only (differs — flagged) | official [gameStatus registry](https://statsapi.mlb.com/api/v1/gameStatus) (`MD` = "Manager challenge: Catch/drop in outfield", `NH` = "Umpire review: Home run") · uploaded `README.md` |
| G-8 | Irregularity notes | the game's **first** note repeated on **every** row of the game (reproduced live on 2026-08-28 rows) | notes that name an entry id render only on that row; game-level notes render once as flagged rows ("never corrected or hidden") | LIVPBP2 routes them to a "Flagged" tab (a tab the original README list does not have — exact original presentation **unverified**) | uploaded `reviews.html` footer · [live rows before](https://snapquast73-boop.github.io/LIVPBP/reviews.html?date=2026-08-28) |
| G-9 | Counter-regression detector ("flagged … instead of being silently corrected") | `counterRegression` was called with the wrong object shape — a silent no-op | per-kind (manager / ABS) regression checks that actually compare official counters | — | uploaded `README.md` L54–57 · [Reviews.counterRegression](https://github.com/snapquast73-boop/LIVPBP/blob/arena/6e2a58d9-livpbp/assets/js/reviews.js) |

## Verified values (official sources only)

| Value shown on the page | Official source | Verified |
| --- | --- | --- |
| Manager counters `review.away/home.{used,remaining}` | [`/schedule?hydrate=review`](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-08-28&hydrate=review&fields=dates,games,gamePk,review,hasChallenges,away,home,used,remaining) | 2026-11-22 — matches the counter lines rendered for games 824960/823666/… |
| ABS counters `gameData.absChallenges.{usedSuccessful,usedFailed,remaining}` | [`/feed/live?fields=gameData,absChallenges,…`](https://statsapi.mlb.com/api/v1.1/game/824960/feed/live?fields=gameData,absChallenges,hasChallenges,away,home,usedSuccessful,usedFailed,remaining,review,used) | 2026-11-22 — game 824960: BAL 0/2/0, ATH 4/1/1 = [LIVPBP2's summary line](https://snapquast73-boop.github.io/LIVPBP2/reviews.html?date=2026-08-28) |
| Review-code wording (`MA`, `MD`, `MF`, `MJ`, `NH`, …) and challenge mechanisms | [`/api/v1/gameStatus`](https://statsapi.mlb.com/api/v1/gameStatus) | 2026-11-22 — `M*` = "Manager challenge: …" (charged), `N*` = "Umpire review: …", `MJ`/`NJ` = pitch result |
| Pending-ruling event types | [`/api/v1/eventTypes`](https://statsapi.mlb.com/api/v1/eventTypes) | 2026-11-22 (earlier passes verified; carried) |
| The README's counter-line examples (`CIN: 2 ABS challenges left now (2 successful · 0 failed)`, `PIT: 1 manager challenge left now (0 used)`, `Challenges left: CIN 1 MGR · 2 ABS — CHC 1 MGR · 2 ABS`) | uploaded `README.md` (first-party) | 2026-11-22 — asserted **byte-exact** in `tools/smoke-test.mjs` §[12] |

## Checks run

```text
npm test                      -> 59 passed, 0 failed   (12 new checks in §[12])
node tests/run-all.mjs        -> syntax OK · 40 local refs OK · 8 bindings OK · 47/47 jsdom
node tools/restoration-check.mjs -> ALL CHECKS PASSED
```

## Irregularities for owner review (published on flagged.html §13)

| # | Item | Status |
| --- | --- | --- |
| R2-1 | `?date=` deep-link work duplicated across three sessions; `d105b565`'s merged implementation stands | resolved (superseded) |
| R2-2 | Empty-state wording is ours; the original wording is lost | unverified |
| R2-3 | Sound identity: raindrop chime (README + `reviews.html` + LIVPBP2) kept; POSTSSNALRT's cash-register cha-ching + Sound Lab + ABS-inclusive alerts deviate from the uploaded contract and were **not** copied (this resolves RR-05 in favour of the original text) | flagged |
| R2-4 | LIVPBP2 prints the both-teams summary as a visible row line; the README says "on hover and on the Under-Review live strip" — hover + strip implemented, visible line not copied | flagged |
| R2-5 | Summary-tile labels/count differ across all three sites; the original pages never pinned them (README names only "ABS Challenges" and "Runs at Risk" stats) | unverified |
| R2-6 | Boundary-reason set: catch/drop (`ND`) and trap (`NT`) umpire reviews are **not** boundary calls per the README ("NH = boundary-call review", "potential home runs / fair-foul at the wall") and LIVPBP2; POSTSSNALRT differs again (MS/NS only) | flagged |
| R2-7 | "– (not observed)" wording is ours | unverified |
| R2-8 | LIVPBP2's "Flagged" tab has no counterpart in the original README's filter list; game-level irregularities render as flagged rows here instead | unverified |
| R2-9 | All-tab ABS exclusion follows the README ("every category except ABS pitch challenges"; LIVPBP2 agrees); POSTSSNALRT includes ABS in All | flagged |
