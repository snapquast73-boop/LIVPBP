/* scoreboard.js — Scoreboard page logic (index.html).
 * Reconstructed 2026-11-20. Data: GET /api/v1/schedule hydrate (verified
 * live 2026-11-20, see flagged.html). Poll intervals are this reconstruction's
 * (10s live slate / 60s otherwise); the original's sub-second cadence is
 * logged as deviation F-005 in flagged.html. */
(function () {
  'use strict';

  var LIVE_POLL_MS = 10000;
  var IDLE_POLL_MS = 60000;

  var state = {
    date: null, games: [], filter: 'all', timer: null, countdownTimer: null,
    nextPollAt: 0, logByDate: {}
  };

  function $(id) { return document.getElementById(id); }

  function scoringChangeCount(gamePk) {
    var log = state.logByDate[state.date];
    if (!log) return 0;
    var n = 0;
    (log.entries || []).forEach(function (e) {
      if (e.gamePk === gamePk && e.review && e.review.kind === 'scoring-change') n += 1;
    });
    return n;
  }

  function gameStateOf(g) {
    var s = g.status || {};
    if (s.abstractGameState === 'Live') return 'live';
    if (s.abstractGameState === 'Final') return 'final';
    return 'upcoming';
  }

  function reviewBadge(g) {
    var hit = window.Reviews.statusUnderReview(g.status);
    if (!hit) return '';
    return ' <span class="badge badge-review">🚨 ' + window.UI.esc(hit.detailedState || 'Under review') +
      (hit.reason ? ' — ' + window.UI.esc(hit.reason) : '') + '</span>';
  }

  function renderTabs() {
    var counts = { all: state.games.length, live: 0, final: 0, upcoming: 0 };
    state.games.forEach(function (g) { counts[gameStateOf(g)] += 1; });
    var tabs = [['all', 'All games'], ['live', 'Live'], ['final', 'Final'], ['upcoming', 'Upcoming']];
    $('tabs').innerHTML = tabs.map(function (t) {
      return '<button class="tab-btn' + (state.filter === t[0] ? ' tab-on' : '') +
        '" onclick="Scoreboard.setFilter(\'' + t[0] + '\')">' + t[1] + ' (' + counts[t[0]] + ')</button>';
    }).join('');
  }

  function teamRow(side, otherScore) {
    var t = side.team || {};
    var score = side.score != null ? side.score : null;
    var loser = score != null && otherScore != null && score < otherScore;
    var rec = side.leagueRecord ? (side.leagueRecord.wins + '-' + side.leagueRecord.losses) : '';
    return '<div class="team-row' + (loser ? ' loser' : '') + '">' +
      window.UI.logoImg(t.id) +
      '<span class="team-name">' + window.UI.esc(t.name || window.UI.abbr(t.id)) + '</span>' +
      (rec ? '<span class="team-record">' + rec + '</span>' : '') +
      '<span class="team-score">' + (score != null ? score : '–') + '</span></div>';
  }

  function cardHTML(g) {
    var away = g.teams.away, home = g.teams.home;
    var ls = g.linescore || {};
    var st = gameStateOf(g);
    var mid = '';
    if (st === 'live') {
      mid = '<span class="badge badge-live">LIVE</span> <span>' + window.UI.esc(window.UI.inningLabel(ls)) + '</span> ' +
        window.UI.diamond(ls.offense) + ' ' + window.UI.countDots({ balls: ls.balls, strikes: ls.strikes, outs: ls.outs });
    } else if (st === 'final') {
      mid = '<span>' + window.UI.esc((g.status || {}).detailedState || 'Final') + '</span>';
    } else {
      mid = '<span>' + window.UI.esc(window.MLBApi.fmtTime(g.gameDate)) + '</span>' +
        (g.venue && g.venue.name ? '<span>' + window.UI.esc(g.venue.name) + '</span>' : '');
    }
    var notes = '';
    if (st !== 'live') {
      var pa = away.probablePitcher, ph = home.probablePitcher;
      if (pa || ph) {
        notes += '<div class="card-note">Probables: ' +
          window.UI.esc((pa && pa.fullName) || 'TBD') + ' (' + window.UI.abbr((away.team || {}).id) + ') vs ' +
          window.UI.esc((ph && ph.fullName) || 'TBD') + ' (' + window.UI.abbr((home.team || {}).id) + ')</div>';
      }
    }
    var d = g.decisions;
    if (d && (d.winner || d.loser || d.save)) {
      notes += '<div class="card-note">' +
        (d.winner ? 'W: ' + window.UI.esc(d.winner.fullName) + ' ' : '') +
        (d.loser ? 'L: ' + window.UI.esc(d.loser.fullName) + ' ' : '') +
        (d.save ? 'SV: ' + window.UI.esc(d.save.fullName) : '') + '</div>';
    }
    var sc = scoringChangeCount(g.gamePk);
    if (sc) notes += '<div class="card-note"><span class="badge badge-change">✏️ ' + sc + ' Scoring Change' + (sc === 1 ? '' : 's') + '</span></div>';
    return '<a class="game-card" href="game.html?gamePk=' + g.gamePk + '">' +
      '<div class="game-card-top"><span>' + window.UI.esc((g.status || {}).detailedState || '') + '</span>' +
      '<span>Game ' + g.gamePk + '</span></div>' +
      teamRow(away, home.score) + teamRow(home, away.score) +
      '<div class="mini-linescore">' + mid + reviewBadge(g) + '</div>' + notes + '</a>';
  }

  function render() {
    var bannerGames = state.games.filter(function (g) { return window.Reviews.statusUnderReview(g.status); });
    var banner = $('banner');
    if (bannerGames.length) {
      banner.className = 'banner show';
      banner.innerHTML = '🚨 <b>' + bannerGames.length + ' game' + (bannerGames.length === 1 ? '' : 's') +
        ' currently in review/challenge.</b> <a href="reviews.html?date=' + state.date + '">Open the Replay Feed →</a>';
    } else { banner.className = 'banner'; banner.innerHTML = ''; }

    renderTabs();
    var list = state.games.filter(function (g) { return state.filter === 'all' || gameStateOf(g) === state.filter; });
    $('game-list').innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty-note">No ' + (state.filter === 'all' ? '' : state.filter + ' ') +
        'games on ' + window.UI.esc(window.MLBApi.prettyDate(state.date)) +
        '. Pick another date — the StatsAPI has schedules back through its historical archive.</div>';
    $('date-label').textContent = window.MLBApi.prettyDate(state.date);
    if ($('date-picker').value !== state.date) $('date-picker').value = state.date;
  }

  function scheduleNext() {
    clearTimeout(state.timer);
    var anyLive = state.games.some(function (g) { return gameStateOf(g) === 'live'; });
    var delay = anyLive ? LIVE_POLL_MS : IDLE_POLL_MS;
    state.nextPollAt = Date.now() + delay;
    state.timer = setTimeout(load, delay);
  }

  function load() {
    if (document.hidden) { scheduleNext(); return; }
    window.MLBApi.getSchedule(state.date).then(function (data) {
      var dates = (data && data.dates) || [];
      state.games = (dates[0] && dates[0].games) || [];
      render();
      $('status-line').textContent = 'Updated ' + new Date().toLocaleTimeString() +
        ' · source: statsapi.mlb.com/api/v1/schedule (sportId=1, date=' + state.date + ')';
    }).catch(function (err) {
      $('status-line').textContent = 'Could not load the schedule (' + err.message + '). Retrying…';
    }).then(scheduleNext);
  }

  function tickCountdown() {
    // The scoreboard markup has no countdown element; polling is silent.
  }

  function setDate(d) {
    state.date = d;
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('date', d);
      window.history.replaceState(null, '', url);
    } catch (e) { /* file:// */ }
    state.logByDate[d] = window.FeedLog.loadLocal(d);
    clearTimeout(state.timer);
    load();
  }

  window.Scoreboard = {
    prevDay: function () { setDate(window.MLBApi.addDays(state.date, -1)); },
    nextDay: function () { setDate(window.MLBApi.addDays(state.date, 1)); },
    today: function () { setDate(window.MLBApi.todayStr()); },
    pickDate: function () { var v = $('date-picker').value; if (v) setDate(v); },
    setFilter: function (f) { state.filter = f; render(); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var d = params.get('date');
    state.date = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : window.MLBApi.todayStr();
    $('date-picker').value = state.date;
    state.logByDate[state.date] = window.FeedLog.loadLocal(state.date);
    window.UI.loadTeams().then(function () { render(); });
    // Cross-browser log (only when server.mjs is running; silent on Pages).
    window.FeedLog.pullServer(state.date).then(function (srv) {
      if (srv) {
        var log = window.FeedLog.mergeInto(window.FeedLog.loadLocal(state.date), srv);
        window.FeedLog.saveLocal(log);
        state.logByDate[state.date] = log;
        render();
      }
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(state.timer); load(); } });
    load();
  });
})();
