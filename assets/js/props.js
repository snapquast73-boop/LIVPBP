/* props.js — transparent two-sided hit forecast (log5).
 * Reconstructed 2026-11-20 as a REDUCED version of the model described in
 * README.md "Two-sided hit forecast": this build uses only the two season
 * rates the StatsAPI returns from GET /api/v1/people/{id}/stats
 * (batter AVG, group=hitting; opponent AVG, group=pitching — field shape
 * verified live 2026-11-20) compounded with the log5 odds-ratio method
 * around the league baseline the README states (.245). Platoon splits,
 * recent form, head-to-head, familiarity and live-count drivers from the
 * original model were NOT reconstructed; they are listed as deviation
 * F-006 in flagged.html and are never displayed as if present.
 * If a side has no usable season line the forecast says so and falls back
 * to the stated baseline — it never invents a rate.
 */
(function () {
  'use strict';

  var LEAGUE_BASELINE = 0.245; // stated in README.md, per-PA section
  var cache = {}; // playerId:group:season -> Promise<number|null>

  function seasonAvg(playerId, group, season) {
    var key = playerId + ':' + group + ':' + season;
    if (!cache[key]) {
      cache[key] = window.MLBApi.getPersonStats(playerId, group, season).then(function (data) {
        var stats = (data && data.stats) || [];
        for (var i = 0; i < stats.length; i++) {
          var splits = stats[i].splits || [];
          for (var j = 0; j < splits.length; j++) {
            var avg = splits[j].stat && splits[j].stat.avg;
            if (avg != null && avg !== '') {
              var n = Number(avg);
              if (isFinite(n) && n > 0 && n < 1) return n;
            }
          }
        }
        return null; // no usable line in the official payload
      }).catch(function () { return null; });
    }
    return cache[key];
  }

  function log5(batterRate, pitcherRate, league) {
    var a = (batterRate * pitcherRate) / league;
    var b = ((1 - batterRate) * (1 - pitcherRate)) / (1 - league);
    return a / (a + b);
  }
  function clamp(p) { return Math.min(0.78, Math.max(0.05, p)); }

  function tier(p) {
    if (p >= 0.30) return 'Elite matchup';
    if (p >= 0.27) return 'Favorable';
    if (p >= 0.24) return 'Neutral';
    if (p >= 0.20) return 'Tough';
    return "Pitcher's edge";
  }

  // Returns a Promise of an HTML string for the Props & Matchup tab / live card.
  function forecastHTML(batter, pitcher, season) {
    if (!batter || !batter.id) return Promise.resolve('<p class="card-note">No batter at the plate yet.</p>');
    var pitcherId = pitcher && pitcher.id;
    return Promise.all([
      seasonAvg(batter.id, 'hitting', season),
      pitcherId ? seasonAvg(pitcherId, 'pitching', season) : Promise.resolve(null)
    ]).then(function (rates) {
      var bRate = rates[0], pRate = rates[1];
      var notes = [];
      if (bRate == null) { notes.push('Batter input: no usable season AVG in the StatsAPI payload — league baseline used.'); }
      if (pitcherId && pRate == null) { notes.push('Pitcher input: no usable opponent AVG in the StatsAPI payload — league baseline used.'); }
      if (!pitcherId) notes.push('No pitcher identified in the payload.');
      var usedB = bRate == null ? LEAGUE_BASELINE : bRate;
      var usedP = pRate == null ? LEAGUE_BASELINE : pRate;
      var p = clamp(log5(usedB, usedP, LEAGUE_BASELINE));
      var scenarios = [1, 2, 3, 4].map(function (n) {
        return n + ' PA: ' + Math.round((1 - Math.pow(1 - p, n)) * 100) + '%';
      }).join(' · ');
      return '<div class="kv">' +
        '<span>Hit this PA: <b>' + Math.round(p * 100) + '%</b></span>' +
        '<span>Tier: <b>' + tier(p) + '</b></span>' +
        '<span>Batter AVG used: <b>' + (bRate == null ? 'baseline .245' : bRate.toFixed(3)) + '</b></span>' +
        '<span>Pitcher opp. AVG used: <b>' + (pRate == null ? 'baseline .245' : pRate.toFixed(3)) + '</b></span></div>' +
        '<p class="card-note">Chance of ≥1 hit in the next N plate appearances <i>if</i> that many occur ' +
        '(transparent 1−(1−p)<sup>N</sup> math, not a prediction that they will): ' + scenarios + '.</p>' +
        (notes.length ? '<p class="card-note">⚠ ' + notes.map(window.UI.esc).join(' ') + '</p>' : '') +
        '<p class="card-note">Method: log5 odds-ratio of the two season rates around the .245 league baseline ' +
        'stated in README.md, clamped to 5–78%. Reduced reconstruction — platoon/form/head-to-head/count drivers ' +
        'of the original model are not included (flagged.html F-006). Source: ' +
        'statsapi.mlb.com/api/v1/people/{id}/stats (season, verified 2026-11-20).</p>';
    });
  }

  window.Props = {
    LEAGUE_BASELINE: LEAGUE_BASELINE,
    seasonAvg: seasonAvg,
    log5: log5,
    forecastHTML: forecastHTML
  };
})();
