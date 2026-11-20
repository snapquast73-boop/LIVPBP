/* api.js — MLB StatsAPI client (fetch, retry, 429 handling, formatters).
 * Reconstructed 2026-11-20 (see COORDINATION.md / flagged.html).
 * Endpoint shapes verified against the live API on 2026-11-20:
 *   GET /api/v1/schedule?sportId=1&date=YYYY-MM-DD&hydrate=probablePitcher,linescore,decisions,review
 *   GET /api/v1.1/game/{gamePk}/feed/live   (fallback: /api/v1/game/{gamePk}/feed/live)
 *   GET /api/v1/game/{gamePk}/playByPlay, /boxscore, /linescore (fallback bundle)
 *   GET /api/v1/teams?sportId=1
 *   GET /api/v1/people/{id}/stats?stats=season&group=hitting|pitching&season=YYYY
 * Source: https://statsapi.mlb.com/api/v1/schedule (live response, 2026-11-20)
 */
(function () {
  'use strict';

  var BASE = 'https://statsapi.mlb.com/api';
  var SPORT_ID = 1; // 1 = MLB (README "Customizing")

  // ---- HTTP 429 self-throttle: honour Retry-After (clamped 1s..5min),
  // ---- otherwise stay quiet for 60s. Shared across every caller.
  var quietUntil = 0;

  function parseRetryAfter(res) {
    try {
      var v = res.headers && res.headers.get && res.headers.get('Retry-After');
      if (!v) return 60000;
      var secs = Number(v);
      if (!isFinite(secs)) {
        var when = Date.parse(v);
        secs = isFinite(when) ? (when - Date.now()) / 1000 : 60;
      }
      return Math.min(300000, Math.max(1000, secs * 1000));
    } catch (e) { return 60000; }
  }

  function fetchJSON(url, opts) {
    opts = opts || {};
    var retries = opts.retries != null ? opts.retries : 2;
    var wait = Math.max(0, quietUntil - Date.now());
    var attempt = function (n) {
      return fetch(url, { headers: { Accept: 'application/json' } }).then(function (res) {
        if (res.status === 429) {
          quietUntil = Date.now() + parseRetryAfter(res);
          if (n < retries) {
            return new Promise(function (r) { setTimeout(r, Math.min(quietUntil - Date.now(), 5000)); })
              .then(function () { return attempt(n + 1); });
          }
          throw new Error('HTTP 429 (rate limited) for ' + url);
        }
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.json();
      }).catch(function (err) {
        // Network error: one or two short backoff retries, then surface it.
        if (n < retries && !(err && /^HTTP /.test(String(err.message)))) {
          return new Promise(function (r) { setTimeout(r, 600 * (n + 1)); })
            .then(function () { return attempt(n + 1); });
        }
        throw err;
      });
    };
    if (wait > 0) {
      return new Promise(function (r) { setTimeout(r, Math.min(wait, 5000)); }).then(function () { return attempt(0); });
    }
    return attempt(0);
  }

  // ---- date helpers (local timezone, YYYY-MM-DD) ----
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayStr() { return toDateStr(new Date()); }
  function addDays(dateStr, n) {
    var p = String(dateStr).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }
  function prettyDate(dateStr) {
    var p = String(dateStr).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // ---- endpoints ----
  function getSchedule(dateStr) {
    return fetchJSON(BASE + '/v1/schedule?sportId=' + SPORT_ID + '&date=' + encodeURIComponent(dateStr) +
      '&hydrate=probablePitcher,linescore,decisions,review');
  }
  function getScheduleStatus(dateStr) {
    // Lean whole-slate status projection (README endpoint table).
    return fetchJSON(BASE + '/v1/schedule?sportId=' + SPORT_ID + '&date=' + encodeURIComponent(dateStr) +
      '&fields=dates,games,gamePk,season,status,abstractGameState,codedGameState,detailedState,statusCode,reason,startTimeTBD,abstractGameCode');
  }
  function getFeed(gamePk) {
    return fetchJSON(BASE + '/v1.1/game/' + gamePk + '/feed/live').catch(function () {
      return fetchJSON(BASE + '/v1/game/' + gamePk + '/feed/live');
    });
  }
  function getPlayByPlay(gamePk) { return fetchJSON(BASE + '/v1/game/' + gamePk + '/playByPlay'); }
  function getBoxscore(gamePk) { return fetchJSON(BASE + '/v1/game/' + gamePk + '/boxscore'); }
  function getLinescore(gamePk) { return fetchJSON(BASE + '/v1/game/' + gamePk + '/linescore'); }
  function getTeams() { return fetchJSON(BASE + '/v1/teams?sportId=' + SPORT_ID); }
  function getPersonStats(playerId, group, season) {
    var url = BASE + '/v1/people/' + playerId + '/stats?stats=season&group=' + group;
    if (season) url += '&season=' + encodeURIComponent(season);
    return fetchJSON(url, { retries: 1 });
  }
  function isLiveStatus(game) {
    var s = (game && game.status) || {};
    return s.abstractGameState === 'Live';
  }
  function isFinalStatus(game) {
    var s = (game && game.status) || {};
    return s.abstractGameState === 'Final';
  }

  window.MLBApi = {
    BASE: BASE,
    SPORT_ID: SPORT_ID,
    fetchJSON: fetchJSON,
    toDateStr: toDateStr,
    todayStr: todayStr,
    addDays: addDays,
    prettyDate: prettyDate,
    fmtTime: fmtTime,
    getSchedule: getSchedule,
    getScheduleStatus: getScheduleStatus,
    getFeed: getFeed,
    getPlayByPlay: getPlayByPlay,
    getBoxscore: getBoxscore,
    getLinescore: getLinescore,
    getTeams: getTeams,
    getPersonStats: getPersonStats,
    isLiveStatus: isLiveStatus,
    isFinalStatus: isFinalStatus,
    _quietUntil: function () { return quietUntil; }
  };
})();
