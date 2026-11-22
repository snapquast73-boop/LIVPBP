/* ============================================================================
 * scoreboard.js — the scoreboard page (index.html)
 *
 * - every game for the selected date, with live score, inning, count,
 *   probable pitchers and W/L/S decisions
 * - a 500 ms hydrated-schedule poll while anything is live, idle otherwise
 * - a 125 ms lean status sweep (fields projection, no hydrations) so a review
 *   that MLB publishes mid-poll shows up immediately — the "review ticker"
 * - review + official-scoring-change chips, read from the feed log
 * ==========================================================================*/
(function (global) {
  'use strict';

  var MLB = global.MLB;
  var UI = global.UI;
  var Reviews = global.Reviews;
  var FeedLog = global.FeedLog;

  var LIVE_POLL_MS = 500;
  var IDLE_POLL_MS = 30000;
  var STATUS_SWEEP_MS = 125;
  var TOMORROW_IDLE_POLL_MS = 120000;

  var state = {
    date: MLB.todayISO(),
    dateSeq: 0,
    filter: 'all',
    games: [],
    scheduled: [],
    reviewByPk: Object.create(null),
    scoringChanges: Object.create(null),
    log: null,
    loading: false,
    lastError: null,
    lastUpdated: 0,
    timers: { poll: null, sweep: null },
    abort: null,
    sweepInFlight: false,
    pollInFlight: false,
  };

  function $(id) { return document.getElementById(id); }

  function urlDate() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      var d = params.get('date');
      return MLB.isValidISODate(d) ? d : null;
    } catch (e) { return null; }
  }

  function parseDate() {
    /* A ?date=YYYY-MM-DD deep link (index.html?date=2026-10-28) wins over the
     * picker, so a shared or bookmarked URL always opens the date it names. */
    var fromUrl = urlDate();
    if (fromUrl) return fromUrl;
    var input = $('date-picker');
    var value = input && input.value;
    return MLB.isValidISODate(value) ? value : MLB.todayISO();
  }

  /* Keep the address bar in step with the selected date (shareable links).
   * Guarded: history.replaceState is not writable in every embedding context. */
  function syncUrl() {
    try {
      var url = new URL(global.location.href);
      if (url.searchParams.get('date') === state.date) return;
      url.searchParams.set('date', state.date);
      global.history.replaceState(null, '', url.toString());
    } catch (e) { /* ignore */ }
  }

  function reviewsHref() {
    return 'reviews.html?date=' + encodeURIComponent(state.date);
  }

  function syncNav() {
    var picker = $('date-picker');
    if (picker && picker.value !== state.date) picker.value = state.date;
    var label = $('date-label');
    if (label) label.textContent = MLB.formatDateLabel(state.date);
    var feedLink = document.querySelector('a.btn-feed[href^="reviews.html"]');
    if (feedLink) feedLink.setAttribute('href', reviewsHref());
    syncUrl();
  }

  function statusLine(text, isError) {
    var el = $('status-line');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
  }

  /* ------------------------------------------------------------------ fetch */

  function flattenGames(payload) {
    var out = [];
    var dates = (payload && payload.dates) || [];
    dates.forEach(function (d) {
      (d.games || []).forEach(function (g) { out.push(g); });
    });
    return out;
  }

  function loadLog() {
    return FeedLog.load(state.date).then(function (log) {
      state.log = log;
      applyLogFlags();
      render();
      return log;
    }).catch(function () {
      state.log = FeedLog.emptyPayload(state.date);
      return state.log;
    });
  }

  function applyLogFlags() {
    /* Official scoring changes are recorded by the Replay Feed (the only
     * writer of the shared log).  Count them per game for the card chip. */
    state.scoringChanges = Object.create(null);
    if (!state.log || !Array.isArray(state.log.entries)) return;
    state.log.entries.forEach(function (entry) {
      if (!entry || entry.kind !== 'scoring_change') return;
      var pk = entry.gamePk;
      if (!pk) return;
      state.scoringChanges[pk] = (state.scoringChanges[pk] || 0) + 1;
    });
  }

  function fetchSchedule() {
    if (state.pollInFlight) return Promise.resolve();
    state.pollInFlight = true;
    var reqSeq = state.dateSeq;
    var reqDate = state.date;
    state.abort = new AbortController();
    return MLB.schedule(reqDate, { signal: state.abort.signal })
      .then(function (payload) {
        if (reqSeq !== state.dateSeq || reqDate !== state.date) return;
        state.games = flattenGames(payload);
        state.lastError = null;
        state.lastUpdated = Date.now();
        state.scheduled = state.games.map(function (g) { return g.gamePk; });
        var nextRev = Object.create(null);
        state.games.forEach(function (g) {
          var rev = Reviews.statusReview(g.status);
          if (rev) nextRev[g.gamePk] = Object.assign({}, rev, { signature: rev.code + '|' + rev.reason });
        });
        state.reviewByPk = nextRev;
        renderIfChanged();
        statusLine(summaryText());
      })
      .catch(function (err) {
        if (reqSeq !== state.dateSeq || reqDate !== state.date) return;
        if (err && err.name === 'AbortError') return;
        if (err && err.quiet) { statusLine('StatsAPI asked the page to slow down — pausing briefly.', false); return; }
        state.lastError = err;
        render();
        statusLine('Could not reach the MLB StatsAPI (' + (err && err.message ? err.message : 'network error') + '). Retrying…', true);
      })
      .then(function () {
        state.pollInFlight = false;
      });
  }

  /* 125 ms lean sweep: whole slate's status in ~2.4 KB.  Only the official
   * status registry decides what counts as a review. */
  function sweepStatus() {
    if (state.sweepInFlight) return;
    if (document.hidden) return;
    if (!state.games.some(isLive)) return;
    state.sweepInFlight = true;
    MLB.slateStatus(state.date)
      .then(function (payload) {
        var games = flattenGames(payload);
        var changed = false;
        games.forEach(function (g) {
          var review = Reviews.statusReview(g.status);
          var key = g.gamePk;
          var signature = review ? review.code + '|' + review.reason : '';
          var prevSignature = state.reviewByPk[key] ? state.reviewByPk[key].signature : '';
          if (review && signature !== prevSignature) {
            state.reviewByPk[key] = Object.assign({}, review, { signature: signature });
            changed = true;
          } else if (!review && state.reviewByPk[key]) {
            delete state.reviewByPk[key];
            changed = true;
          }
          /* Keep the hydrated card in step with the sweep's fresher status. */
          if (review) {
            var game = state.games.find(function (x) { return x.gamePk === key; });
            if (game && game.status && game.status.statusCode !== g.status.statusCode) {
              game.status = g.status;
              changed = true;
            }
          }
        });
        if (changed) renderIfChanged();
      })
      .catch(function () { /* the ordinary poll owns error reporting */ })
      .then(function () { state.sweepInFlight = false; });
  }

  /* One request, cached 5 min: the latest date in the previous 45 days with
   * games.  45 days rather than a few days because the MLB calendar has gaps
   * (All-Star break, the end of the season) where a short window finds nothing
   * and the visitor is left with an empty scoreboard. */
  function offerRecentDate() {
    if (state.lastGameDate !== undefined || state.lookingForRecent) return;
    state.lookingForRecent = true;
    var from = MLB.shiftISODate(state.date, -180);
    MLB.scheduleRange(from, state.date)
      .then(function (payload) {
        var dates = ((payload && payload.dates) || []).filter(function (d) {
          return d && d.totalGames > 0;
        });
        state.lastGameDate = dates.length ? dates[dates.length - 1].date : null;
      })
      .catch(function () { state.lastGameDate = null; })
      .then(function () {
        state.lookingForRecent = false;
        if (state.lastGameDate) render();
      });
  }

  function isLive(game) {
    return !!(game && game.status && game.status.abstractGameState === 'Live');
  }

  function hasLive() { return state.games.some(isLive); }

  function summaryText() {
    if (!state.games.length) return 'No games scheduled for ' + MLB.formatDateLabel(state.date) + '.';
    var live = state.games.filter(isLive).length;
    var final = state.games.filter(function (g) { return g.status && g.status.abstractGameState === 'Final'; }).length;
    var bits = [state.games.length + ' game' + (state.games.length === 1 ? '' : 's')];
    if (live) bits.push(live + ' live');
    if (final) bits.push(final + ' final');
    bits.push('updated ' + new Date(state.lastUpdated).toLocaleTimeString());
    return bits.join(' · ');
  }

  /* ----------------------------------------------------------------- render */

  function gameCard(game) {
    var home = (game.teams && game.teams.home) || {};
    var away = (game.teams && game.teams.away) || {};
    var status = game.status || {};
    var meta = UI.statusMeta(status);
    var linescore = game.linescore || null;
    var review = state.reviewByPk[game.gamePk] || null;
    var changes = state.scoringChanges[game.gamePk] || 0;

    var homeScore = typeof home.score === 'number' ? home.score : '';
    var awayScore = typeof away.score === 'number' ? away.score : '';

    var classList = ['game-card'];
    if (meta.live) classList.push('is-live');
    if (review) classList.push('is-review');

    var statusText = meta.label;
    if (meta.live && linescore && linescore.currentInning) {
      var half = linescore.inningState ? linescore.inningState.slice(0, 3) : '';
      statusText = half + ' ' + linescore.currentInning;
    }
    if (meta.final && status.detailedState && status.detailedState !== 'Final') statusText = status.detailedState;

    var metaBits = [];
    if (meta.live) {
      var balls = linescore && linescore.balls;
      var strikes = linescore && linescore.strikes;
      var outs = linescore && linescore.outs;
      if (typeof balls === 'number' && typeof strikes === 'number') {
        metaBits.push('Count ' + balls + '-' + strikes);
      }
      if (typeof outs === 'number') metaBits.push(outs + ' out' + (outs === 1 ? '' : 's'));
    }
    if (!meta.live && !meta.final) {
      metaBits.push(MLB.formatGameTime(game.gameDate) || 'TBD');
    }
    if (game.venue && game.venue.name) metaBits.push(game.venue.name);
    if (game.seriesGameNumber && game.gamesInSeries) {
      metaBits.push('Game ' + game.seriesGameNumber + ' of ' + game.gamesInSeries);
    }
    if (game.doubleHeader && game.doubleHeader !== 'N') metaBits.push('Doubleheader');

    var probable = [];
    if (away.probablePitcher && away.probablePitcher.fullName) probable.push('Away: ' + away.probablePitcher.fullName);
    if (home.probablePitcher && home.probablePitcher.fullName) probable.push('Home: ' + home.probablePitcher.fullName);

    var decisions = game.decisions || {};
    var decisionBits = [];
    if (decisions.winner && decisions.winner.fullName) decisionBits.push('W ' + decisions.winner.fullName);
    if (decisions.loser && decisions.loser.fullName) decisionBits.push('L ' + decisions.loser.fullName);
    if (decisions.save && decisions.save.fullName) decisionBits.push('SV ' + decisions.save.fullName);

    var chips = '';
    if (review) {
      chips += UI.chip('🚨 ' + review.typeLabel + (review.reason ? ': ' + review.reason : ''), 'chip-review', 'Official review status: ' + (review.detailedState || review.typeLabel));
    }
    if (changes) {
      chips += UI.chip('✏️ ' + changes + ' scoring change' + (changes === 1 ? '' : 's'), 'chip-scoring', 'Official reclassification observed by the Replay Feed');
    }

    return '' +
      '<a class="' + classList.join(' ') + '" href="game.html?gamePk=' + encodeURIComponent(game.gamePk) + '&date=' + encodeURIComponent(state.date) + '">' +
        '<div class="card-top">' +
          '<span class="card-status ' + meta.cls + '">' + UI.esc(statusText) + '</span>' +
          '<span>' + UI.esc(MLB.formatGameTime(game.gameDate)) + '</span>' +
        '</div>' +
        teamRow(away, awayScore, game) +
        teamRow(home, homeScore, game) +
        (chips ? '<div class="card-chips">' + chips + '</div>' : '') +
        '<div class="card-meta">' +
          metaBits.map(function (b) { return '<span>' + UI.esc(b) + '</span>'; }).join('') +
        '</div>' +
        ((probable.length || decisionBits.length)
          ? '<div class="card-meta">' +
              probable.map(function (b) { return '<span>🎯 ' + UI.esc(b) + '</span>'; }).join('') +
              decisionBits.map(function (b) { return '<span>🏆 ' + UI.esc(b) + '</span>'; }).join('') +
            '</div>'
          : '') +
      '</a>';
  }

  function teamRow(side, score, game) {
    var team = side.team || {};
    var record = side.leagueRecord || side.record || null;
    var recordText = '';
    if (record && typeof record.wins === 'number' && typeof record.losses === 'number') {
      recordText = record.wins + '-' + record.losses;
    }
    var cls = 'team-row';
    if (side.isWinner === true) cls += ' is-winner';
    if (side.isWinner === false && game.status && game.status.abstractGameState === 'Final') cls += ' is-loser';
    return '<div class="' + cls + '">' +
      UI.teamLogo(team) +
      '<span class="team-name">' + UI.esc(team.name || '') +
        (recordText ? '<span class="team-record">' + UI.esc(recordText) + '</span>' : '') +
      '</span>' +
      '<span class="team-score">' + UI.esc(score) + '</span>' +
    '</div>';
  }

  function renderTabs() {
    var nav = $('tabs');
    if (!nav) return;
    var filters = [
      { id: 'all', label: 'All games' },
      { id: 'live', label: 'Live' },
      { id: 'final', label: 'Final' },
      { id: 'preview', label: 'Upcoming' },
      { id: 'review', label: 'In review' },
    ];
    nav.innerHTML = filters.map(function (f) {
      var count = countFor(f.id);
      return '<button class="tab-btn' + (state.filter === f.id ? ' tab-on' : '') + '" data-filter="' + f.id + '">' +
        UI.esc(f.label) + (count ? ' <span class="tab-badge">' + count + '</span>' : '') + '</button>';
    }).join('');
  }

  function countFor(filter) {
    if (filter === 'all') return 0;
    if (filter === 'live') return state.games.filter(isLive).length;
    if (filter === 'final') return state.games.filter(function (g) { return g.status && g.status.abstractGameState === 'Final'; }).length;
    if (filter === 'preview') return state.games.filter(function (g) { return g.status && g.status.abstractGameState === 'Preview'; }).length;
    if (filter === 'review') return Object.keys(state.reviewByPk).length;
    return 0;
  }

  function visibleGames() {
    if (state.filter === 'live') return state.games.filter(isLive);
    if (state.filter === 'final') return state.games.filter(function (g) { return g.status && g.status.abstractGameState === 'Final'; });
    if (state.filter === 'preview') return state.games.filter(function (g) { return g.status && g.status.abstractGameState === 'Preview'; });
    if (state.filter === 'review') return state.games.filter(function (g) { return !!state.reviewByPk[g.gamePk]; });
    return state.games;
  }

  function renderBanner() {
    var el = $('banner');
    if (!el) return;
    var reviews = state.games.filter(function (g) { return !!state.reviewByPk[g.gamePk]; });
    if (!reviews.length) { el.innerHTML = ''; return; }
    el.innerHTML = reviews.map(function (g) {
      var review = state.reviewByPk[g.gamePk];
      var away = (g.teams && g.teams.away) || {};
      var home = (g.teams && g.teams.home) || {};
      return '<div class="banner-item banner-review">' +
        '🚨 <strong>' + UI.esc(UI.abbr(away.team) + ' @ ' + UI.abbr(home.team)) + '</strong>' +
        ' — ' + UI.esc(review.typeLabel) + (review.reason ? ': ' + UI.esc(review.reason) : '') +
        ' <a class="banner-link" href="' + UI.esc(reviewsHref()) + '">Replay Feed →</a>' +
        '</div>';
    }).join('');
  }

  /* Skip DOM work when the baseball state did not change: a 500 ms poll must
   * not rebuild identical cards (it would drop hover state and cost frames). */
  function stateSignature() {
    var bits = state.games.map(function (g) {
      var ls = g.linescore || {};
      return [g.gamePk,
        g.status && g.status.statusCode,
        g.teams && g.teams.away ? g.teams.away.score : '',
        g.teams && g.teams.home ? g.teams.home.score : '',
        ls.currentInning, ls.inningState, ls.balls, ls.strikes, ls.outs,
        state.reviewByPk[g.gamePk] ? state.reviewByPk[g.gamePk].signature : '',
        state.scoringChanges[g.gamePk] || 0].join(':');
    });
    return state.filter + '|' + state.date + '|' + bits.join('|');
  }

  function renderIfChanged() {
    var sig = stateSignature();
    if (sig === state.lastRenderSignature) return;
    state.lastRenderSignature = sig;
    render();
  }

  function render() {
    renderTabs();
    renderBanner();
    var list = $('game-list');
    if (!list) return;
    var games = visibleGames();
    if (!state.games.length) {
      list.innerHTML = '<div class="panel" style="grid-column:1/-1;text-align:center;color:var(--muted)">' +
        'No games scheduled for ' + UI.esc(MLB.formatDateLabel(state.date)) + '.' +
        (state.lastGameDate
          ? '<div style="margin-top:10px">Most recent date with games: ' +
            UI.esc(MLB.formatDateLabel(state.lastGameDate)) + ' ' +
            '<button class="btn" onclick="Scoreboard.setDate(\'' + state.lastGameDate + '\')">Show it</button></div>'
          : '') +
        '</div>';
      offerRecentDate();
      return;
    }
    if (!games.length) {
      list.innerHTML = '<div class="panel" style="grid-column:1/-1;text-align:center;color:var(--muted)">' +
        'No games match this filter.</div>';
      return;
    }
    list.innerHTML = games.map(gameCard).join('');
  }

  /* ------------------------------------------------------------------- loop */

  function schedulePoll(delay) {
    clearTimeout(state.timers.poll);
    state.timers.poll = setTimeout(tick, delay);
  }

  function tick() {
    if (document.hidden) {
      schedulePoll(1000);
      return;
    }
    var pending = fetchSchedule();
    var next = hasLive() ? LIVE_POLL_MS : (state.date > MLB.todayISO() ? TOMORROW_IDLE_POLL_MS : IDLE_POLL_MS);
    pending.then(function () {
      if (hasLive()) next = LIVE_POLL_MS;
      else if (state.games.some(function (g) { return g.status && g.status.abstractGameState === 'Preview'; })) next = IDLE_POLL_MS;
      schedulePoll(state.lastError ? Math.max(next, 5000) : next);
    });
  }

  function startSweep() {
    clearInterval(state.timers.sweep);
    state.timers.sweep = setInterval(sweepStatus, STATUS_SWEEP_MS);
  }

  /* -------------------------------------------------------------- day nav */

  function setDate(date) {
    var clean = MLB.isValidISODate(date) ? date : MLB.todayISO();
    if (clean === state.date) return;
    state.dateSeq += 1;
    state.date = clean;
    state.lastGameDate = undefined;
    state.lookingForRecent = false;
    state.reviewByPk = Object.create(null);
    state.scoringChanges = Object.create(null);
    state.games = [];
    if (state.abort) {
      try { state.abort.abort(); } catch (e) { /* ignore */ }
    }
    state.pollInFlight = false;
    syncNav();
    render();
    statusLine('Loading games for ' + MLB.formatDateLabel(state.date) + '…');
    FeedLog.closeStream();
    FeedLog.openStream(state.date);
    loadLog().then(fetchSchedule).then(function () { schedulePoll(0); });
  }

  function prevDay() { setDate(MLB.shiftISODate(state.date, -1)); }
  function nextDay() { setDate(MLB.shiftISODate(state.date, 1)); }
  function today() { setDate(MLB.todayISO()); }
  /* The picker is the user's own choice, so it is read directly: a ?date=
   * deep link seeds the first view but must not override a later pick. */
  function pickDate() {
    var input = $('date-picker');
    var value = input && input.value;
    setDate(MLB.isValidISODate(value) ? value : state.date);
  }

  function setFilter(filter) {
    state.filter = filter;
    render();
  }

  function init() {
    state.date = urlDate() || parseDate();
    syncNav();
    FeedLog.onChange(function (payload) {
      if (!payload || payload.date !== state.date) return;
      state.log = payload;
      applyLogFlags();
      renderIfChanged();
    });
    FeedLog.openStream(state.date);

    var nav = $('tabs');
    if (nav) {
      nav.addEventListener('click', function (evt) {
        var btn = evt.target.closest('[data-filter]');
        if (!btn) return;
        setFilter(btn.getAttribute('data-filter'));
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        fetchSchedule();
        sweepStatus();
      }
    });

    Reviews.loadRegistry();
    loadLog().then(function () {
      fetchSchedule();
      schedulePoll(LIVE_POLL_MS);
      startSweep();
    });
  }

  global.Scoreboard = {
    init: init,
    prevDay: prevDay,
    nextDay: nextDay,
    today: today,
    pickDate: pickDate,
    setFilter: setFilter,
    setDate: setDate,
    refresh: fetchSchedule,
    state: state,
    LIVE_POLL_MS: LIVE_POLL_MS,
    IDLE_POLL_MS: IDLE_POLL_MS,
    STATUS_SWEEP_MS: STATUS_SWEEP_MS,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window));
