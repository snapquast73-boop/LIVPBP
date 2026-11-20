/* game.js — Game page logic (game.html?gamePk=<id>).
 * Reconstructed 2026-11-20. Primary source: GET /api/v1.1/game/{gamePk}/feed/live
 * (liveData.plays / linescore / boxscore / decisions, gameData.players / teams /
 * review / absChallenges), with the README-documented fallbacks
 * (/api/v1 feed, then playByPlay + boxscore + linescore bundle).
 * Poll cadence of this reconstruction: 10s live / 60s final or preview,
 * paused while the tab is hidden (deviation F-005, flagged.html).
 */
(function () {
  'use strict';

  var LIVE_POLL_MS = 10000;
  var SLOW_POLL_MS = 60000;

  var state = { gamePk: null, feed: null, timer: null, nextPollAt: 0, tab: 'plays', lastSignature: '' };

  function $(id) { return document.getElementById(id); }
  function player(feed, id) {
    var players = (feed && feed.gameData && feed.gameData.players) || {};
    return players['ID' + id] || (id ? { id: id, fullName: 'Player ' + id } : null);
  }
  function playerName(feed, id) {
    var p = player(feed, id);
    return p ? (p.fullName || ('Player ' + id)) : '—';
  }

  function setTab(tab) {
    state.tab = tab;
    ['plays', 'boxscore', 'props', 'reviews'].forEach(function (t) {
      $('panel-' + t).style.display = t === tab ? '' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('tab-on', b.getAttribute('data-tab') === tab);
    });
    if (tab === 'props') renderProps();
    if (tab === 'boxscore') renderBoxscore();
  }

  function signature(feed) {
    var ld = feed.liveData || {};
    var cp = ld.plays && ld.plays.currentPlay;
    var ls = ld.linescore || {};
    return JSON.stringify([
      feed.gameData && feed.gameData.status && feed.gameData.status.detailedState,
      cp && cp.atBatIndex, cp && cp.playIndex,
      ls.teams && ls.teams.away && ls.teams.away.runs, ls.teams && ls.teams.home && ls.teams.home.runs,
      ls.currentInning, ls.inningHalf, ls.outs, ls.balls, ls.strikes,
      (ld.plays && ld.plays.allPlays || []).length
    ]);
  }

  function render() {
    var feed = state.feed;
    if (!feed) return;
    var gd = feed.gameData || {}, ld = feed.liveData || {};
    var away = gd.teams.away || {}, home = gd.teams.home || {};
    var ls = ld.linescore || {};
    var awayRuns = ls.teams && ls.teams.away ? ls.teams.away.runs : null;
    var homeRuns = ls.teams && ls.teams.home ? ls.teams.home.runs : null;
    if (awayRuns == null && gd.teams.away) awayRuns = null;

    function sideHTML(team, runs) {
      var rec = team.record ? (team.record.wins + '-' + team.record.losses) : '';
      return window.UI.logoImg(team.id) +
        '<div class="h-team">' + window.UI.esc(team.name || window.UI.abbr(team.id)) + '</div>' +
        (rec ? '<div class="h-record">' + rec + '</div>' : '') +
        '<div class="h-score">' + (runs != null ? runs : '–') + '</div>';
    }
    $('header-away').innerHTML = sideHTML(away, awayRuns);
    $('header-home').innerHTML = sideHTML(home, homeRuns);
    var status = gd.status || {};
    $('header-center').innerHTML =
      '<div><b>' + window.UI.esc(status.detailedState || '') + '</b></div>' +
      (ld.plays && ld.plays.currentPlay && status.abstractGameState === 'Live'
        ? '<div>' + window.UI.esc(window.UI.inningLabel(ls)) + '</div>' + window.UI.diamond(ls.offense) +
          '<div>' + window.UI.countDots({ balls: ls.balls, strikes: ls.strikes, outs: ls.outs }) + '</div>'
        : '') +
      '<div>Game ' + state.gamePk + '</div>';

    var meta = [];
    if (gd.venue && gd.venue.name) meta.push(window.UI.esc(gd.venue.name));
    if (gd.datetime && gd.datetime.originalDate) meta.push(window.UI.esc(gd.datetime.originalDate));
    if (gd.weather && (gd.weather.condition || gd.weather.temp)) {
      meta.push(window.UI.esc([gd.weather.condition, gd.weather.temp ? gd.weather.temp + '°' : '', gd.weather.wind || ''].filter(Boolean).join(' · ')));
    }
    $('header-meta').textContent = meta.join(' · ');

    var dec = ld.decisions || {};
    var decParts = [];
    if (dec.winner) decParts.push('W: ' + window.UI.esc(dec.winner.fullName || playerName(feed, dec.winner.id)));
    if (dec.loser) decParts.push('L: ' + window.UI.esc(dec.loser.fullName || playerName(feed, dec.loser.id)));
    if (dec.save) decParts.push('SV: ' + window.UI.esc(dec.save.fullName || playerName(feed, dec.save.id)));
    $('header-decisions').textContent = decParts.join(' · ');

    renderReviewBanner(feed);
    renderLive(feed);
    renderLinescore(feed);
    renderPlays(feed);
    renderReviewsTab(feed);
    if (state.tab === 'boxscore') renderBoxscore();
    if (state.tab === 'props') renderProps();

    var reviews = window.Reviews.parsePlays((ld.plays && ld.plays.allPlays) || [], { gamePk: state.gamePk });
    var badge = $('reviews-tab-count');
    if (reviews.length) { badge.style.display = ''; badge.textContent = reviews.length; }
    else badge.style.display = 'none';
  }

  function renderReviewBanner(feed) {
    var hit = window.Reviews.statusUnderReview((feed.gameData || {}).status);
    $('live-review-banner-wrap').innerHTML = hit
      ? '<div class="review-alert">🚨 UNDER REVIEW — ' + window.UI.esc(hit.detailedState || 'Review in progress') +
        (hit.reason ? ' · Reason: ' + window.UI.esc(hit.reason) : '') +
        ' · <a href="reviews.html">Open the Replay Feed</a></div>'
      : '';
  }

  function renderLive(feed) {
    var ld = feed.liveData || {};
    var cp = ld.plays && ld.plays.currentPlay;
    var ls = ld.linescore || {};
    if (!cp || !cp.matchup) {
      var last = (ld.plays && ld.plays.allPlays || []).slice(-1)[0];
      $('live-panel').innerHTML = '<div class="live-label">Latest play</div>' +
        (last && last.result && last.result.description
          ? '<div class="play-desc">' + window.UI.esc(last.result.description) + '</div>'
          : '<p class="card-note">No live at-bat in the payload (game not in progress).</p>');
      return;
    }
    var m = cp.matchup;
    var pitchCount = 0;
    ((ld.plays && ld.plays.allPlays) || []).concat([cp]).forEach(function (p) {
      if (p.matchup && p.matchup.pitcher && m.pitcher && p.matchup.pitcher.id === m.pitcher.id) {
        (p.playEvents || []).forEach(function (e) { if (e.isPitch) pitchCount += 1; });
      }
    });
    function personHTML(label, person, extra) {
      if (!person) return '';
      return '<div class="live-person"><div class="live-label">' + label + '</div>' +
        window.UI.headshotImg(person.id) +
        '<div class="live-name">' + window.UI.esc(playerName(feed, person.id)) + '</div>' +
        (extra || '') + '</div>';
    }
    var count = cp.count || { balls: ls.balls, strikes: ls.strikes, outs: ls.outs };
    $('live-panel').innerHTML = '<div class="live-grid">' +
      personHTML('At bat', m.batter) +
      personHTML('Pitching', m.pitcher, '<div class="card-note">Pitches (this game, counted from payload pitch events): ' + pitchCount + '</div>') +
      '<div class="live-person"><div class="live-label">Count</div><div class="live-name">' +
      (count.balls || 0) + '-' + (count.strikes || 0) + '</div>' +
      window.UI.countDots(count) + ' ' + window.UI.diamond(ls.offense) +
      '<div class="card-note">On deck: ' + window.UI.esc(ls.offense && ls.offense.onDeck ? playerName(feed, ls.offense.onDeck.id) : '—') +
      ' · In the hole: ' + window.UI.esc(ls.offense && ls.offense.inHole ? playerName(feed, ls.offense.inHole.id) : '—') + '</div></div></div>' +
      '<div id="live-forecast" style="margin-top:10px"></div>';
    // Transparent forecast for the live matchup (props.js, reduced log5).
    var season = (feed.gameData && feed.gameData.game && feed.gameData.game.season) || null;
    window.Props.forecastHTML(player(feed, m.batter && m.batter.id), player(feed, m.pitcher && m.pitcher.id), season)
      .then(function (html) {
        var el = $('live-forecast');
        if (el) el.innerHTML = '<div class="live-label">Hit forecast (this PA)</div>' + html;
      });
  }

  function renderLinescore(feed) {
    var ls = (feed.liveData || {}).linescore || {};
    var innings = ls.innings || [];
    if (!innings.length) { $('linescore-wrap').innerHTML = '<div class="live-label">Linescore</div><p class="card-note">No linescore in the payload yet.</p>'; return; }
    var gd = feed.gameData || {};
    function row(label, key, totalKey) {
      var cells = innings.map(function (inn) {
        var v = inn[key] && inn[key].runs;
        return '<td>' + (v != null ? v : '–') + '</td>';
      }).join('');
      var t = ls.teams && ls.teams[totalKey] ? ls.teams[totalKey] : {};
      return '<tr><td>' + window.UI.esc(label) + '</td>' + cells +
        '<td><b>' + (t.runs != null ? t.runs : '–') + '</b></td><td>' + (t.hits != null ? t.hits : '–') +
        '</td><td>' + (t.errors != null ? t.errors : '–') + '</td></tr>';
    }
    $('linescore-wrap').innerHTML = '<div class="live-label">Linescore</div><table><tr><th></th>' +
      innings.map(function (inn) { return '<th>' + inn.num + '</th>'; }).join('') +
      '<th>R</th><th>H</th><th>E</th></tr>' +
      row(window.UI.abbr((gd.teams.away || {}).id, (gd.teams.away || {}).abbreviation), 'away', 'away') +
      row(window.UI.abbr((gd.teams.home || {}).id, (gd.teams.home || {}).abbreviation), 'home', 'home') +
      '</table>';
  }

  function renderPlays(feed) {
    var plays = ((feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || []).slice().reverse();
    var reviewKeys = {};
    window.Reviews.parsePlays(plays, { gamePk: state.gamePk }).forEach(function (r) { reviewKeys[r.atBatIndex] = r; });
    if (!plays.length) { $('plays-wrap').innerHTML = '<p class="card-note">No plays in the payload yet.</p>'; return; }
    $('plays-wrap').innerHTML = plays.map(function (p) {
      var r = (p.result) || {};
      var about = p.about || {};
      var rv = reviewKeys[p.atBatIndex];
      var pitchEvents = (p.playEvents || []).filter(function (e) { return e.isPitch; });
      var pitches = pitchEvents.map(function (e) {
        var d = e.details || {};
        var speed = e.pitchData && e.pitchData.startSpeed ? ' ' + Math.round(e.pitchData.startSpeed) + ' mph' : '';
        return '<div>' + window.UI.esc((d.call && d.call.description) || d.description || d.type && d.type.description || 'Pitch') +
          (d.type && d.type.description ? ' · ' + window.UI.esc(d.type.description) : '') + speed + '</div>';
      }).join('');
      return '<div class="play"><div class="play-head"><span class="play-inning">' +
        window.UI.esc((about.halfInning === 'top' ? 'Top' : 'Bot') + ' ' + (about.inning || '')) + '</span>' +
        '<span class="play-event">' + window.UI.esc(r.event || r.eventType || 'Play') + '</span>' +
        (p.count ? '<span class="chip">' + (p.count.outs != null ? p.count.outs + ' out' : '') + '</span>' : '') +
        (rv ? ' <span class="chip chip-review">' + window.UI.esc(rv.kindLabel) + (rv.outcome ? ': ' + window.UI.esc(rv.outcome) : '') + '</span>' : '') +
        (rv && rv.runsAtRisk ? ' <span class="chip chip-risk">⚠️ ' + rv.runsAtRisk + ' RUN' + (rv.runsAtRisk === 1 ? '' : 'S') + ' AT RISK</span>' : '') +
        '</div><div class="play-desc">' + window.UI.esc(r.description || '') + '</div>' +
        (pitches ? '<details><summary class="card-note">Pitches (' + pitchEvents.length + ')</summary><div class="pitch-list">' + pitches + '</div></details>' : '') +
        '</div>';
    }).join('');
  }

  function statTable(players, order, columns, group) {
    var rows = (order || []).map(function (id) {
      var p = players['ID' + id];
      if (!p) return '';
      var st = (p.stats && p.stats[group]) || {};
      return '<tr><td>' + window.UI.esc(p.person && p.person.fullName || ('Player ' + id)) + '</td>' +
        columns.map(function (c) {
          var v = st[c];
          return '<td>' + (v != null && v !== '' ? window.UI.esc(v) : '–') + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return rows;
  }

  function renderBoxscore() {
    var feed = state.feed;
    var box = (feed.liveData || {}).boxscore;
    if (!box || !box.teams) { $('boxscore-wrap').innerHTML = '<p class="card-note">Box score not available in the payload.</p>'; return; }
    var gd = feed.gameData || {};
    var html = '';
    ['away', 'home'].forEach(function (side) {
      var t = box.teams[side] || {};
      var label = window.UI.esc(((gd.teams || {})[side] || {}).name || side);
      html += '<h3>' + label + ' — Batting</h3><table><tr><th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>HR</th></tr>' +
        statTable(t.players || {}, t.battingOrder || [], ['atBats', 'runs', 'hits', 'rbi', 'baseOnBalls', 'strikeOuts', 'homeRuns'], 'batting') + '</table>';
      html += '<h3>' + label + ' — Pitching</h3><table><tr><th>Player</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>HR</th></tr>' +
        statTable(t.players || {}, t.pitchers || [], ['inningsPitched', 'hits', 'runs', 'earnedRuns', 'baseOnBalls', 'strikeOuts', 'homeRuns'], 'pitching') + '</table>';
    });
    $('boxscore-wrap').innerHTML = html;
  }

  function renderProps() {
    var feed = state.feed;
    var cp = feed.liveData && feed.liveData.plays && feed.liveData.plays.currentPlay;
    var season = (feed.gameData && feed.gameData.game && feed.gameData.game.season) || null;
    if (!cp || !cp.matchup) {
      // Final/preview: forecast the last recorded matchup, labelled as such.
      var plays = (feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
      var last = plays[plays.length - 1];
      if (!last || !last.matchup) { $('props-wrap').innerHTML = '<p class="card-note">No matchup in the payload to forecast.</p>'; return; }
      $('props-wrap').innerHTML = '<p class="card-note">Game not live — forecast shown for the last recorded plate appearance (' +
        window.UI.esc(playerName(feed, last.matchup.batter.id)) + ' vs ' + window.UI.esc(playerName(feed, last.matchup.pitcher.id)) + ').</p><div id="props-body"></div>';
      window.Props.forecastHTML(player(feed, last.matchup.batter.id), player(feed, last.matchup.pitcher.id), season)
        .then(function (h) { var el = $('props-body'); if (el) el.innerHTML = h; });
      return;
    }
    $('props-wrap').innerHTML = '<div id="props-body"><p class="card-note">Loading season inputs from the StatsAPI…</p></div>';
    window.Props.forecastHTML(player(feed, cp.matchup.batter.id), player(feed, cp.matchup.pitcher.id), season)
      .then(function (h) { var el = $('props-body'); if (el) el.innerHTML = h; });
  }

  function renderReviewsTab(feed) {
    var plays = (feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || [];
    var reviews = window.Reviews.parsePlays(plays, { gamePk: state.gamePk });
    // Scoring changes logged for this game by the Replay Feed's diff tracker.
    var dateStr = (feed.gameData && feed.gameData.datetime && feed.gameData.datetime.originalDate) || window.MLBApi.todayStr();
    var log = window.FeedLog.loadLocal(dateStr);
    var changes = (log.entries || []).filter(function (e) {
      return e.gamePk === Number(state.gamePk) && e.review && e.review.kind === 'scoring-change';
    });
    var counters = window.Reviews.counters(feed);
    var counterLines = [];
    if (counters.manager) {
      var ma = window.Reviews.counterText(counters.manager.away, false);
      var mh = window.Reviews.counterText(counters.manager.home, false);
      if (ma || mh) counterLines.push('Manager challenges — ' + [ma, mh].filter(Boolean).join(' · '));
    }
    if (counters.abs) {
      var aa = window.Reviews.counterText(counters.abs.away, true);
      var ah = window.Reviews.counterText(counters.abs.home, true);
      if (aa || ah) counterLines.push('ABS — ' + [aa, ah].filter(Boolean).join(' · '));
    }
    var html = '';
    if (counterLines.length) html += '<p class="card-note">Official counters (read as-is from the feed; a side the payload omits is not shown and never zero-filled):<br>' + counterLines.map(window.UI.esc).join('<br>') + '</p>';
    if (!reviews.length && !changes.length) {
      html += '<p class="card-note">No challenge or review events in this game\'s payload' +
        (counters.abs === null && counters.manager === null ? ', and no challenge counters reported (normal for pre-ABS seasons / older feeds)' : '') + '.</p>';
    }
    html += reviews.slice().reverse().map(function (r) {
      return '<div class="play"><div class="play-head"><span class="play-inning">' +
        window.UI.esc((r.halfInning === 'top' ? 'Top' : 'Bot') + ' ' + (r.inning || '')) + '</span>' +
        '<span class="play-event">' + window.UI.esc(r.kindLabel) + '</span>' +
        (r.outcome ? '<span class="chip">' + window.UI.esc(r.outcome) + '</span>' : '') +
        (r.runsAtRisk ? '<span class="chip chip-risk">⚠️ ' + r.runsAtRisk + ' run(s) at risk</span>' : '') + '</div>' +
        (r.description ? '<div class="play-desc">' + window.UI.esc(r.description) + '</div>' : '') +
        '<div class="feed-row-meta">Batter: ' + window.UI.esc(playerName(feed, r.batterId)) +
        ' · Pitcher: ' + window.UI.esc(playerName(feed, r.pitcherId)) +
        (r.awayScore != null ? ' · Score after play: ' + r.awayScore + '–' + r.homeScore : '') + '</div></div>';
    }).join('');
    html += changes.map(function (e) {
      var r = e.review;
      return '<div class="play"><div class="play-head"><span class="play-event">✏️ Official scoring change</span></div>' +
        '<div class="play-desc">' + window.UI.esc(r.description || '') + '</div>' +
        '<div class="feed-row-meta">' + window.UI.esc(r.fromLabel || '') + ' → ' + window.UI.esc(r.toLabel || '') +
        ' (observed by the Replay Feed diff tracker; see reviews.html)</div></div>';
    }).join('');
    $('reviews-wrap').innerHTML = html;
  }

  function scheduleNext() {
    clearTimeout(state.timer);
    var status = state.feed && state.feed.gameData && state.feed.gameData.status;
    var delay = status && status.abstractGameState === 'Live' ? LIVE_POLL_MS : SLOW_POLL_MS;
    state.nextPollAt = Date.now() + delay;
    state.timer = setTimeout(load, delay);
  }

  function load() {
    if (document.hidden) { scheduleNext(); return; }
    $('loading').classList.add('show');
    window.MLBApi.getFeed(state.gamePk).then(function (feed) {
      state.feed = feed;
      var sig = signature(feed);
      if (sig !== state.lastSignature) { state.lastSignature = sig; render(); }
      else renderReviewBanner(feed);
      $('status-line').textContent = 'Updated ' + new Date().toLocaleTimeString() +
        ' · source: statsapi.mlb.com/api/v1.1/game/' + state.gamePk + '/feed/live';
    }).catch(function () {
      // Fallback bundle: playByPlay + boxscore + linescore (README table).
      return Promise.all([
        window.MLBApi.getPlayByPlay(state.gamePk),
        window.MLBApi.getBoxscore(state.gamePk),
        window.MLBApi.getLinescore(state.gamePk)
      ]).then(function (parts) {
        state.feed = {
          gameData: (state.feed && state.feed.gameData) || { teams: { away: {}, home: {} }, status: {}, players: {} },
          liveData: { plays: { allPlays: parts[0].allPlays || [], currentPlay: parts[0].currentPlay || null }, boxscore: parts[1], linescore: parts[2], decisions: {} }
        };
        state.lastSignature = signature(state.feed);
        render();
        $('status-line').textContent = 'Live feed unavailable — showing the playByPlay/boxscore/linescore fallback bundle. Updated ' + new Date().toLocaleTimeString();
      }).catch(function (err) {
        $('status-line').textContent = 'Could not load this game (' + err.message + '). Retrying…';
      });
    }).then(function () {
      $('loading').classList.remove('show');
      scheduleNext();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    state.gamePk = params.get('gamePk');
    if (!state.gamePk || !/^\d+$/.test(state.gamePk)) {
      $('loading').classList.remove('show');
      $('live-panel').innerHTML = '<p class="card-note">No game selected. <a href="index.html">Pick a game on the scoreboard →</a></p>';
      return;
    }
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
    $('refresh-btn').addEventListener('click', function () { clearTimeout(state.timer); load(); });
    setInterval(function () {
      var left = Math.max(0, Math.round((state.nextPollAt - Date.now()) / 1000));
      $('countdown').textContent = state.nextPollAt ? left + 's' : '';
    }, 500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(state.timer); load(); } });
    window.UI.loadTeams();
    load();
  });
})();
