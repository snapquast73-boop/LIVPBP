/* ============================================================================
 * api.js — MLB StatsAPI client
 *
 * One place for every network call the site makes:
 *   1. fetch wrapper with timeout, retry, response cache and HTTP-429 handling
 *   2. endpoint helpers (schedule, feed/live, playByPlay, gameStatus, people stats)
 *   3. small date/number formatters shared by the pages
 *
 * The StatsAPI is keyless and sends CORS headers, so a static GitHub Pages site
 * can call it straight from the browser.  Endpoint list + `fields` projections
 * follow the ones documented in README.md §"How it works".
 * ==========================================================================*/
(function (global) {
  'use strict';

  /* 1 = MLB. 11-14 = the minor leagues (see README §Customizing). */
  var SPORT_ID = 1;
  var API_ROOT = 'https://statsapi.mlb.com/api';
  var REQUEST_TIMEOUT_MS = 15000;

  /* HTTP 429 quiet period: honour Retry-After when the host sends one, else 60s.
   * Clamped to 1s-5min so a bogus header can neither spin nor stall the page. */
  var QUIET_DEFAULT_MS = 60000;
  var QUIET_MIN_MS = 1000;
  var QUIET_MAX_MS = 300000;

  var state = {
    quietUntil: 0,
    lastError: null,
    lastOK: 0,
    requests: 0,
    cacheHits: 0,
  };

  var cache = Object.create(null);
  var CACHE_MAX_ENTRIES = 240;

  function now() { return Date.now(); }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function quietRemainingMs() { return Math.max(0, state.quietUntil - now()); }

  function parseRetryAfter(value) {
    if (!value) return 0;
    var seconds = Number(value);
    if (isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    var when = Date.parse(value); // HTTP-date form
    if (!isNaN(when)) return Math.max(0, when - now());
    return 0;
  }

  function pruneCache() {
    var keys = Object.keys(cache);
    if (keys.length <= CACHE_MAX_ENTRIES) return;
    keys.sort(function (a, b) { return cache[a].at - cache[b].at; });
    keys.slice(0, keys.length - CACHE_MAX_ENTRIES).forEach(function (k) { delete cache[k]; });
  }

  function ApiError(message, status, url) {
    var err = new Error(message);
    err.name = 'ApiError';
    err.status = status || 0;
    err.url = url || '';
    return err;
  }

  /**
   * getJSON(url, opts)
   *   opts.ttl      cache lifetime in ms (0 = no cache, the default)
   *   opts.retries  extra attempts after a failed one (default 1)
   *   opts.signal   external AbortSignal (poll loops use it to cancel)
   *   opts.keepQuiet  bypass the 429 quiet window (used by the quiet probe only)
   */
  function getJSON(url, opts) {
    opts = opts || {};
    var ttl = opts.ttl || 0;
    var retries = typeof opts.retries === 'number' ? opts.retries : 1;

    if (ttl && cache[url] && now() - cache[url].at < cache[url].ttl) {
      state.cacheHits += 1;
      return Promise.resolve(cache[url].data);
    }

    var quiet = quietRemainingMs();
    if (quiet > 0 && !opts.keepQuiet) {
      var qerr = ApiError('StatsAPI quiet period, ' + Math.ceil(quiet / 1000) + 's remaining', 429, url);
      qerr.quiet = true;
      return Promise.reject(qerr);
    }

    var attempt = 0;

    function once() {
      attempt += 1;
      state.requests += 1;

      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
      var external = opts.signal;
      if (external) {
        if (external.aborted) controller.abort();
        else external.addEventListener('abort', function () { controller.abort(); }, { once: true });
      }

      var request = fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      return request.then(function (res) {
        clearTimeout(timer);

        if (res.status === 429) {
          var wait = parseRetryAfter(res.headers.get('Retry-After')) || QUIET_DEFAULT_MS;
          wait = Math.min(QUIET_MAX_MS, Math.max(QUIET_MIN_MS, wait));
          state.quietUntil = Math.max(state.quietUntil, now() + wait);
          throw ApiError('StatsAPI asked to slow down (HTTP 429); pausing ' + Math.round(wait / 1000) + 's', 429, url);
        }
        if (!res.ok) throw ApiError('HTTP ' + res.status + ' from ' + url, res.status, url);
        return res.json();
      }).then(function (data) {
        clearTimeout(timer);
        state.lastOK = now();
        state.lastError = null;
        if (ttl) {
          cache[url] = { at: now(), ttl: ttl, data: data };
          pruneCache();
        }
        return data;
      }).catch(function (err) {
        clearTimeout(timer);
        state.lastError = err;

        var status = err && err.status;
        var retryable = !status || status >= 500 || err.name === 'AbortError' || err.name === 'TypeError';
        if (retryable && attempt <= retries) {
          return sleep(300 * attempt).then(once);
        }
        if (err.name === 'AbortError') {
          throw ApiError('Request timed out after ' + REQUEST_TIMEOUT_MS + 'ms: ' + url, 0, url);
        }
        throw err;
      });
    }

    return once();
  }

  /* ------------------------------------------------------------- endpoints */

  var SCHEDULE_HYDRATE = 'probablePitcher,linescore,decisions,review';

  /* Games for one date.  `fields` is deliberately open so the scoreboard can
   * ask for the full hydrated card data and the 125ms sweep can ask for the
   * lean status projection (README table, rows 1 and 2). */
  function scheduleUrl(date, opts) {
    opts = opts || {};
    var qs = ['sportId=' + SPORT_ID, 'date=' + encodeURIComponent(date)];
    if (opts.hydrate) qs.push('hydrate=' + encodeURIComponent(opts.hydrate));
    if (opts.fields) qs.push('fields=' + encodeURIComponent(opts.fields));
    return API_ROOT + '/v1/schedule?' + qs.join('&');
  }

  function schedule(date, opts) {
    opts = opts || {};
    return getJSON(scheduleUrl(date, {
      hydrate: opts.hydrate === undefined ? SCHEDULE_HYDRATE : opts.hydrate,
      fields: opts.fields || '',
    }), { ttl: opts.ttl || 0, signal: opts.signal, retries: opts.retries });
  }

  /* Date-range game counts — used only to point at the most recent date that
   * actually had games (the scoreboard looks empty in the offseason). */
  function scheduleRange(startDate, endDate, opts) {
    opts = opts || {};
    var qs = 'sportId=' + SPORT_ID + '&startDate=' + encodeURIComponent(startDate) +
      '&endDate=' + encodeURIComponent(endDate) + '&fields=dates,date,totalGames';
    return getJSON(API_ROOT + '/v1/schedule?' + qs, { ttl: 300000, retries: 0, signal: opts.signal });
  }

  /* Lean slate status sweep: gamePk + status only (~2.4 KB for the whole day). */
  var STATUS_FIELDS = 'dates,games,gamePk,season,status,abstractGameState,codedGameState,' +
    'detailedState,statusCode,reason,startTimeTBD,abstractGameCode';

  function slateStatus(date, opts) {
    opts = opts || {};
    return schedule(date, {
      hydrate: '',
      fields: STATUS_FIELDS,
      ttl: opts.ttl === undefined ? 0 : opts.ttl,
      signal: opts.signal,
      retries: 0,
    });
  }

  /* Full live feed (v1.1 first, v1 fallback, then /playByPlay + /boxscore + /linescore bundle). */
  function gameFeed(gamePk, opts) {
    opts = opts || {};
    var url = API_ROOT + '/v1.1/game/' + gamePk + '/feed/live';
    if (opts.fields) url += '?fields=' + encodeURIComponent(opts.fields);
    return getJSON(url, { signal: opts.signal, retries: opts.retries })
      .catch(function (err) {
        if (err && err.status === 404) {
          var v1Url = API_ROOT + '/v1/game/' + gamePk + '/feed/live';
          if (opts.fields) v1Url += '?fields=' + encodeURIComponent(opts.fields);
          return getJSON(v1Url, { signal: opts.signal }).catch(function (err2) {
            if (err2 && err2.status === 404 && !opts.fields) {
              return Promise.all([
                playByPlay(gamePk, { signal: opts.signal }),
                boxscore(gamePk, { signal: opts.signal }),
                linescore(gamePk, { signal: opts.signal }),
              ]).then(function (parts) {
                var pbp = parts[0] || {};
                var box = parts[1] || {};
                var ls = parts[2] || {};
                var awayTeam = (box.teams && box.teams.away && box.teams.away.team) || {};
                var homeTeam = (box.teams && box.teams.home && box.teams.home.team) || {};
                return {
                  gamePk: Number(gamePk),
                  gameData: {
                    game: { pk: Number(gamePk) },
                    status: { abstractGameState: ls.isFinal ? 'Final' : 'Live', detailedState: ls.isFinal ? 'Final' : '' },
                    teams: { away: awayTeam, home: homeTeam },
                    players: {},
                    venue: {},
                    datetime: {},
                  },
                  liveData: {
                    plays: { allPlays: pbp.allPlays || [], currentPlay: pbp.currentPlay || null },
                    linescore: ls,
                    boxscore: box,
                    decisions: {},
                  },
                };
              });
            }
            throw err2;
          });
        }
        throw err;
      });
  }

  /* Lean per-game status projection for the game page's 125ms watcher (~150 B). */
  function gameStatusLean(gamePk, opts) {
    opts = opts || {};
    var fields = 'gameData,status,abstractGameState,codedGameState,detailedState,statusCode,reason,startTimeTBD,abstractGameCode';
    return getJSON(API_ROOT + '/v1.1/game/' + gamePk + '/feed/live?fields=' + encodeURIComponent(fields), {
      signal: opts.signal, retries: 0,
    });
  }

  function playByPlay(gamePk, opts) {
    opts = opts || {};
    var url = API_ROOT + '/v1/game/' + gamePk + '/playByPlay';
    if (opts.fields) url += '?fields=' + encodeURIComponent(opts.fields);
    return getJSON(url, { signal: opts.signal, retries: opts.retries });
  }

  function boxscore(gamePk, opts) {
    opts = opts || {};
    return getJSON(API_ROOT + '/v1/game/' + gamePk + '/boxscore', { signal: opts.signal, retries: 0 });
  }

  function linescore(gamePk, opts) {
    opts = opts || {};
    return getJSON(API_ROOT + '/v1/game/' + gamePk + '/linescore', { signal: opts.signal, retries: 0 });
  }

  /* Official game-status / review-type registry (codes -> official wording).
   * Cached for an hour: it is a static reference table. */
  function gameStatusRegistry(opts) {
    opts = opts || {};
    return getJSON(API_ROOT + '/v1/gameStatus', { ttl: 3600000, retries: 0, signal: opts.signal })
      .then(function (rows) {
        var byCode = Object.create(null);
        (Array.isArray(rows) ? rows : []).forEach(function (row) {
          if (row && row.statusCode) byCode[row.statusCode] = row;
        });
        return byCode;
      });
  }

  function peopleStats(personId, group, opts) {
    opts = opts || {};
    var stats = opts.stats || 'season,statSplits,gameLog,expectedStatistics';
    var season = opts.season || new Date().getUTCFullYear();
    var qs = 'stats=' + encodeURIComponent(stats) + '&group=' + encodeURIComponent(group) +
      '&season=' + encodeURIComponent(season);
    if (opts.sitCodes) qs += '&sitCodes=' + encodeURIComponent(opts.sitCodes);
    return getJSON(API_ROOT + '/v1/people/' + personId + '/stats?' + qs, {
      ttl: opts.ttl === undefined ? 120000 : opts.ttl,
      signal: opts.signal, retries: 0,
    });
  }

  function vsPlayer(batterId, pitcherId, group, opts) {
    opts = opts || {};
    var qs = 'stats=vsPlayer&group=' + encodeURIComponent(group || 'hitting') +
      '&opposingPlayerId=' + encodeURIComponent(pitcherId);
    return getJSON(API_ROOT + '/v1/people/' + batterId + '/stats?' + qs, {
      ttl: opts.ttl === undefined ? 600000 : opts.ttl,
      signal: opts.signal, retries: 0,
    });
  }

  /* ------------------------------------------------------------ formatters */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* Local calendar date as YYYY-MM-DD (no UTC shift surprises). */
  function toISODate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISO() { return toISODate(new Date()); }

  function shiftISODate(dateStr, deltaDays) {
    var parts = String(dateStr || '').split('-');
    if (parts.length !== 3) return todayISO();
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + deltaDays);
    return toISODate(d);
  }

  function isValidISODate(s) {
    var str = String(s || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    var p = str.split('-');
    var y = Number(p[0]);
    var m = Number(p[1]);
    var day = Number(p[2]);
    if (m < 1 || m > 12 || day < 1 || day > 31) return false;
    var d = new Date(Date.UTC(y, m - 1, day));
    return d.getUTCFullYear() === y && (d.getUTCMonth() + 1) === m && d.getUTCDate() === day;
  }

  function formatDateLabel(dateStr) {
    if (!isValidISODate(dateStr)) return '';
    var p = dateStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    var month = d.toLocaleDateString(undefined, { month: 'short' });
    return weekday + ' ' + month + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function formatGameTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function formatClock(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    return m + 'm ' + pad2(s % 60) + 's';
  }

  /* Baseball-style average: ".312" (leading zero dropped) or "—" when absent. */
  function avg3(value) {
    var n = Number(value);
    if (value === null || value === undefined || value === '' || !isFinite(n)) return '—';
    var s = n.toFixed(3);
    return s.replace(/^0/, '');
  }

  function pct(value, digits) {
    var n = Number(value);
    if (value === null || value === undefined || value === '' || !isFinite(n)) return '—';
    return (n * 100).toFixed(digits === undefined ? 0 : digits) + '%';
  }

  function ipText(value) {
    var raw = String(value === undefined || value === null ? '' : value);
    if (!raw) return '—';
    return raw;
  }

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  global.MLB = {
    SPORT_ID: SPORT_ID,
    API_ROOT: API_ROOT,
    STATUS_FIELDS: STATUS_FIELDS,
    SCHEDULE_HYDRATE: SCHEDULE_HYDRATE,
    getJSON: getJSON,
    schedule: schedule,
    scheduleRange: scheduleRange,
    slateStatus: slateStatus,
    gameFeed: gameFeed,
    gameStatusLean: gameStatusLean,
    playByPlay: playByPlay,
    boxscore: boxscore,
    linescore: linescore,
    gameStatusRegistry: gameStatusRegistry,
    peopleStats: peopleStats,
    vsPlayer: vsPlayer,
    quietRemainingMs: quietRemainingMs,
    state: state,
    toISODate: toISODate,
    todayISO: todayISO,
    shiftISODate: shiftISODate,
    isValidISODate: isValidISODate,
    formatDateLabel: formatDateLabel,
    formatGameTime: formatGameTime,
    formatClock: formatClock,
    avg3: avg3,
    pct: pct,
    ipText: ipText,
    num: num,
  };
}(window));
