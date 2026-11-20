# ⚾ MLB Live PBP

[Open the scoreboard](https://snapquast73-boop.github.io/LIVPBP/) · [Flagged for Review](https://snapquast73-boop.github.io/LIVPBP/flagged.html)

An unofficial, dependency-free MLB scoreboard, game detail and replay viewer. The uploaded HTML referenced styles and scripts that were absent. The replacement assets use the official MLB feeds directly and link each displayed table row back to its source. Missing values stay blank. The original design and advanced features could not be confirmed; see the review page. The [uploaded README](UPLOADED-README.md) is historical, not current documentation.

## Run and check

Run `python3 -m http.server 8000`, then open `http://localhost:8000/`. The browser needs access to `statsapi.mlb.com`. Run `python3 tests/check_site.py` to check local references and JavaScript syntax (Node.js required).

The GitHub Pages publishing source is `main` at `/`, with `.nojekyll` for static files. See [GitHub's publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). GitHub Pages does not run `server.mjs`; the restored browser app does not depend on it.

## Official reference game

- [MLB schedule, October 31, 2025](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-10-31&hydrate=team,linescore)
- [MLB game feed](https://statsapi.mlb.com/api/v1.1/game/813025/feed/live)
- [MLB Gameday](https://www.mlb.com/gameday/dodgers-vs-blue-jays/2025/10/31/813025/final)
