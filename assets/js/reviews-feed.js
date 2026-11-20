/* reviews-feed.js — All-games Replay Feed logic (reviews.html).
 * Reconstructed 2026-11-20 from the spec in reviews.html's footer + README:
 *  - scans every game on the date's schedule, parses review events from
 *    each game's official playByPlay (window.Reviews), plus status-based
 *    "under review" detection from the schedule status fields;
 *  - official-scorer pending rulings: plays whose result.eventType is
 *    os_ruling_pending_primary / os_ruling_pending_prior (event-type names
 *    as stated in reviews.html's footer; flagged unverified F-004);
 *  - official scoring changes: diffs each completed play's official
 *    classification (result.eventType / result.isOut / count.outs) against
 *    the previous poll's snapshot kept in the feed log;
 *  - runs-at-risk: Reviews.runsAtRisk (scoring movements on the reviewed
 *    event only); the ruling is never predicted;
 *  - challenges-remaining counters read as-is from the schedule's
 *    hydrate=review / feed gameData; absent counters are never zero-filled;
 *  - sound (one shared WebAudio chime) + desktop notification for
 *    run-at-risk, both off by default and remembered per browser;
 *  - persistence via window.FeedLog (localStorage + optional server.mjs).
 * Poll cadence of this reconstruction: 15s scans (+status sweep each scan);
 * the original's 125–250ms cadence is deviation F-005 in flagged.html.
 */
(function () {
  'use strict';

  var SCAN_MS = 15000;
  var FETCH_CONCURRENCY = 4;

  var state = {
    date: null, games: [], entries: [], log: null, filter: 'all',
    timer: null, nextPollAt: 0, soundOn: false, notifyOn: false,
    audioCtx: null, lastChimeAt: 0, seenRiskKeys: {}, es: null, scanning: false
  };

  function $(id) { return document.getElementById(id); }
  function abbr(teamObj) {
    var t = (teamObj && teamObj.team) || {};
    return window.UI.abbr(t.id, t.abbreviation);
  }
  function matchupLabel(g) {
    return abbr(g.teams.away) + ' @ ' + abbr(g.teams.home);
  }

  // ---------- sound: one gentle synthesized chime, shared by every alert ----------
  function chime() {
    var now = Date.now();
    if (!state.soundOn || now - state.lastChimeAt < 2500) return;
    state.lastChimeAt = now;
    try {
      state.audioCtx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var ctx = state.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      [523.25, 659.25, 783.99].forEach(function (freq, i) {
        var o = ctx.createOscillator(), gain = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        var t = ctx.currentTime + i * 0.14;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.connect(gain); gain.connect(ctx.destination);
        o.start(t); o.stop(t + 0.6);
      });
    } catch (e) { /* audio blocked until user interacts — documented in footer */ }
  }
  function notifyRisk(entry) {
    if (!state.notifyOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification('⚠️ Runs at risk — ' + entry.matchupLabel, {
        body: entry.review.kindLabel + ': ' + entry.review.runsAtRisk + ' run(s) credited to the reviewed event could come off the board.'
      });
    } catch (e) { /* non-fatal */ }
  }

  // ---------- scoring-change diff tracker ----------
  function classify(play) {
    var r = play.result || {};
    return { eventType: r.eventType || r.event || null, isOut: r.isOut != null ? r.isOut : null, outs: play.count ? play.count.outs : null };
  }
  function classLabel(c) {
    if (!c || !c.eventType) return null;
    return c.eventType + (c.isOut ? ' (out)' : '');
  }
  function trackScoring(g, pbp) {
    var log = state.log;
    var gk = String(g.gamePk);
    log.snapshots[gk] = log.snapshots[gk] || {};
    (pbp.allPlays || []).forEach(function (play) {
      if (!play.about || !play.about.isComplete) return;
      var idx = String(play.atBatIndex);
      var nowC = classify(play);
      var prev = log.snapshots[gk][idx];
      log.snapshots[gk][idx] = nowC;
      if (prev && prev.eventType && nowC.eventType && prev.eventType !== nowC.eventType) {
        var hasReview = !!play.reviewDetails;
        if (hasReview) return; // stays on the review's row, per spec
        var key = 'chg-' + play.atBatIndex + '-' + prev.eventType + '-to-' + nowC.eventType;
        window.FeedLog.upsert(log, {
          gamePk: g.gamePk,
          review: {
            id: key, kind: 'scoring-change', kindLabel: '✏️ Official scoring change',
            atBatIndex: play.atBatIndex,
            inning: play.about.inning, halfInning: play.about.halfInning,
            description: (play.result && play.result.description) || null,
            fromLabel: classLabel(prev), toLabel: classLabel(nowC),
            awayScore: play.result ? play.result.awayScore : null,
            homeScore: play.result ? play.result.homeScore : null,
            source: 'StatsAPI result.eventType diff across polls (no scoring-change marker exists in the payload)'
          },
          firstSeen: Date.now(), lastSeen: Date.now(), matchupLabel: matchupLabel(g)
        });
      }
      // Pending official-scorer ruling present in the official event type.
      var et = (play.result || {}).eventType;
      if (et === 'os_ruling_pending_primary' || et === 'os_ruling_pending_prior') {
        window.FeedLog.upsert(log, {
          gamePk: g.gamePk,
          review: {
            id: 'os-' + play.atBatIndex + '-' + et, kind: 'os-pending', kindLabel: '⏳ Official Scorer Ruling Pending',
            atBatIndex: play.atBatIndex, inning: play.about.inning, halfInning: play.about.halfInning,
            description: (play.result && play.result.description) || null,
            awayScore: play.result ? play.result.awayScore : null,
            homeScore: play.result ? play.result.homeScore : null,
            source: 'StatsAPI result.eventType ' + et
          },
          firstSeen: Date.now(), lastSeen: Date.now(), matchupLabel: matchupLabel(g)
        });
      }
    });
  }

  // ---------- scan ----------
  function pool(items, size, fn) {
    var i = 0, out = new Array(items.length);
    function next() {
      if (i >= items.length) return Promise.resolve();
      var cur = i++;
      return fn(items[cur]).then(function (v) { out[cur] = v; }).then(next);
    }
    var workers = [];
    for (var k = 0; k < Math.min(size, items.length); k++) workers.push(next());
    return Promise.all(workers).then(function () { return out; });
  }

  function scan() {
    if (state.scanning || document.hidden) { scheduleNext(); return; }
    state.scanning = true;
    window.MLBApi.getSchedule(state.date).then(function (data) {
      var dates = (data && data.dates) || [];
      state.games = (dates[0] && dates[0].games) || [];
      return pool(state.games, FETCH_CONCURRENCY, function (g) {
        return window.MLBApi.getPlayByPlay(g.gamePk).then(function (pbp) {
          trackScoring(g, pbp);
          window.Reviews.parsePlays(pbp.allPlays || [], { gamePk: g.gamePk }).forEach(function (r) {
            var entry = { gamePk: g.gamePk, review: r, firstSeen: Date.now(), lastSeen: Date.now(), matchupLabel: matchupLabel(g) };
            var before = state.log.entries.filter(function (e) { return window.FeedLog.entryKey(e) === window.FeedLog.entryKey(entry); })[0];
            if (before) entry.firstSeen = before.firstSeen || entry.firstSeen;
            window.FeedLog.upsert(state.log, entry);
            // Alert once per review, and only for a review this page had
            // already seen without the risk (never on first-ever sighting).
            if (before && r.runsAtRisk > 0 && r.inProgress && !state.seenRiskKeys[window.FeedLog.entryKey(entry)]) {
              state.seenRiskKeys[window.FeedLog.entryKey(entry)] = 1;
              chime(); notifyRisk(entry);
            }
          });
        }).catch(function () { /* one bad game feed must not kill the scan */ });
      });
    }).then(function () {
      state._primed = true;
      state.log = window.FeedLog.saveLocal(state.log);
      window.FeedLog.pushServer(state.log);
      state.entries = state.log.entries.slice();
      render();
      $('status-line').textContent = 'Updated ' + new Date().toLocaleTimeString() + ' · ' +
        state.games.length + ' games · source: statsapi.mlb.com schedule + per-game playByPlay';
    }).catch(function (err) {
      $('status-line').textContent = 'Scan failed (' + err.message + '). Retrying…';
    }).then(function () {
      state.scanning = false;
      scheduleNext();
    });
  }

  function scheduleNext() {
    clearTimeout(state.timer);
    state.nextPollAt = Date.now() + SCAN_MS;
    state.timer = setTimeout(scan, SCAN_MS);
  }

  // ---------- rendering ----------
  var FILTERS = [
    ['all', 'All'], ['abs', 'ABS'], ['challenges', 'Challenges'], ['reviews', 'Reviews'],
    ['boundary', 'Boundary Calls'], ['under', 'Under Review'], ['risk', '⚠️ Runs at Risk'],
    ['changes', '✏️ Scoring Changes']
  ];
  function passes(e) {
    var r = e.review;
    if (state.filter === 'all') return r.kind !== 'abs'; // ABS lives in its own tab (README)
    if (state.filter === 'abs') return r.kind === 'abs';
    if (state.filter === 'challenges') return r.kind === 'challenge' || r.kind === 'abs';
    if (state.filter === 'reviews') return r.kind === 'review' || r.kind === 'under-review';
    if (state.filter === 'boundary') return r.kind === 'boundary';
    if (state.filter === 'under') return r.inProgress || r.kind === 'under-review';
    if (state.filter === 'risk') return r.runsAtRisk > 0;
    if (state.filter === 'changes') return r.kind === 'scoring-change';
    return true;
  }

  function render() {
    // Banner: scheduled games currently in review (official status fields).
    var under = state.games.filter(function (g) { return window.Reviews.statusUnderReview(g.status); });
    var banner = $('banner');
    if (under.length) {
      banner.className = 'banner show';
      banner.innerHTML = '🚨 <b>Under review now:</b> ' + under.map(function (g) {
        var hit = window.Reviews.statusUnderReview(g.status);
        return '<a href="game.html?gamePk=' + g.gamePk + '">' + window.UI.esc(matchupLabel(g)) + '</a> (' +
          window.UI.esc(hit.detailedState || 'review') + (hit.reason ? ' — ' + window.UI.esc(hit.reason) : '') + ')';
      }).join(' · ');
    } else { banner.className = 'banner'; banner.innerHTML = ''; }

    var riskActive = state.entries.filter(function (e) { return e.review.runsAtRisk > 0 && e.review.inProgress; });
    var strip = $('active-strip');
    strip.innerHTML = (riskActive.length
      ? '<div class="risk-banner show">⚠️ <b>' + riskActive.length + ' active review' + (riskActive.length === 1 ? '' : 's') +
        ' could take run(s) OFF the board:</b> ' + riskActive.map(function (e) {
          return window.UI.esc(e.matchupLabel) + ' (' + e.review.runsAtRisk + ' at risk)';
        }).join(' · ') + '</div>'
      : '') + (under.length
      ? '<div class="active-strip">' + under.map(function (g) {
          return '<a class="active-card" href="game.html?gamePk=' + g.gamePk + '">🚨 ' + window.UI.esc(matchupLabel(g)) + ' — under review</a>';
        }).join('') + '</div>'
      : '');

    var counts = { total: 0, abs: 0, mgr: 0, risk: 0, changes: 0 };
    state.entries.forEach(function (e) {
      counts.total += 1;
      if (e.review.kind === 'abs') counts.abs += 1;
      if (e.review.kind === 'challenge') counts.mgr += 1;
      if (e.review.runsAtRisk > 0) counts.risk += 1;
      if (e.review.kind === 'scoring-change') counts.changes += 1;
    });
    $('feed-stats').innerHTML =
      '<div class="stat-box"><b>' + counts.total + '</b>Tracked entries</div>' +
      '<div class="stat-box"><b>' + counts.abs + '</b>ABS Challenges</div>' +
      '<div class="stat-box"><b>' + counts.mgr + '</b>Manager Challenges</div>' +
      '<div class="stat-box"><b>' + counts.risk + '</b>Runs at Risk</div>' +
      '<div class="stat-box"><b>' + counts.changes + '</b>Scoring Changes</div>' +
      '<div class="stat-box"><b>' + state.games.length + '</b>Games today</div>';

    $('feed-tabs').innerHTML = FILTERS.map(function (f) {
      return '<button class="tab-btn' + (state.filter === f[0] ? ' tab-on' : '') +
        '" onclick="ReplayFeed.setFilter(\'' + f[0] + '\')">' + f[1] + '</button>';
    }).join('');

    var rows = state.entries.filter(passes).slice().sort(function (a, b) {
      return (b.review.atBatIndex || 0) - (a.review.atBatIndex || 0) || (b.firstSeen || 0) - (a.firstSeen || 0);
    });
    $('feed-list').innerHTML = rows.length ? rows.map(rowHTML).join('') :
      '<div class="empty-note">No ' + state.filter + ' entries observed for ' +
      window.UI.esc(window.MLBApi.prettyDate(state.date)) + ' yet. The feed fills as games are played and reviews occur; entries persist in this browser.</div>';
    var dot = $('live-dot'); if (dot) dot.classList.add('on');
  }

  function rowHTML(e) {
    var r = e.review;
    var score = (r.awayScore != null && r.homeScore != null)
      ? '<span>Score after play: <b>' + r.awayScore + '–' + r.homeScore + '</b></span>' : '';
    var risk = r.runsAtRisk > 0
      ? '<span><b>Before review:</b> score as credited on the field · <b>' + r.runsAtRisk +
        ' run(s) credited to the reviewed event could be removed if overturned</b> (possible score is runner-placement dependent and is not predicted)</span>'
      : '';
    return '<article class="feed-row' + (r.runsAtRisk > 0 && r.inProgress ? ' risk' : '') + '">' +
      '<div class="feed-row-head"><span class="feed-row-title">' + window.UI.esc(r.kindLabel || 'Review') + '</span>' +
      (r.runsAtRisk > 0 ? '<span class="chip chip-risk">⚠️ ' + r.runsAtRisk + ' RUN' + (r.runsAtRisk === 1 ? '' : 'S') + ' AT RISK</span>' : '') +
      (r.inProgress ? '<span class="chip chip-review">UNDER REVIEW</span>' : '') +
      (r.outcome ? '<span class="chip">' + window.UI.esc(r.outcome) + '</span>' : '') +
      '<a href="game.html?gamePk=' + e.gamePk + '">' + window.UI.esc(e.matchupLabel || ('Game ' + e.gamePk)) + '</a>' +
      (r.inning ? '<span>' + (r.halfInning === 'top' ? 'Top' : 'Bot') + ' ' + r.inning + '</span>' : '') + '</div>' +
      (r.description ? '<div class="feed-row-desc">' + window.UI.esc(r.description) + '</div>' : '') +
      (r.fromLabel ? '<div class="feed-row-meta">Initial call: ' + window.UI.esc(r.fromLabel) + ' → Final ruling: ' + window.UI.esc(r.toLabel || '') + '</div>' : '') +
      '<div class="score-track">' + score + risk + '</div>' +
      '<div class="feed-row-meta">Source: ' + window.UI.esc(r.source || 'StatsAPI') +
      ' · first seen ' + (e.firstSeen ? new Date(e.firstSeen).toLocaleTimeString() : '—') + '</div></article>';
  }

  // ---------- date / controls ----------
  function setDate(d) {
    state.date = d;
    if (state.es) { try { state.es.close(); } catch (e) {} state.es = null; }
    state.log = window.FeedLog.loadLocal(d);
    state.entries = state.log.entries.slice();
    state._primed = false;
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('date', d);
      window.history.replaceState(null, '', url);
    } catch (e) { /* file:// */ }
    $('date-picker').value = d;
    $('date-label').textContent = window.MLBApi.prettyDate(d);
    window.FeedLog.pullServer(d).then(function (srv) {
      if (srv) { state.log = window.FeedLog.saveLocal(window.FeedLog.mergeInto(state.log, srv)); state.entries = state.log.entries.slice(); render(); }
    });
    state.es = window.FeedLog.subscribe(d, function (payload) {
      state.log = window.FeedLog.saveLocal(window.FeedLog.mergeInto(state.log, payload));
      state.entries = state.log.entries.slice();
      render();
    });
    clearTimeout(state.timer);
    render();
    scan();
  }

  window.ReplayFeed = {
    prevDay: function () { setDate(window.MLBApi.addDays(state.date, -1)); },
    nextDay: function () { setDate(window.MLBApi.addDays(state.date, 1)); },
    today: function () { setDate(window.MLBApi.todayStr()); },
    pickDate: function () { var v = $('date-picker').value; if (v) setDate(v); },
    setFilter: function (f) { state.filter = f; render(); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    state.soundOn = localStorage.getItem('livpbp-sound') === '1';
    state.notifyOn = localStorage.getItem('livpbp-notify') === '1';
    function paintToggles() {
      $('sound-toggle-btn').textContent = state.soundOn ? '🔔 Sound On' : '🔇 Sound Off';
      $('notify-toggle-btn').textContent = state.notifyOn ? '🔔 Run Alerts On' : '⚪ Run Alerts Off';
    }
    paintToggles();
    $('sound-toggle-btn').addEventListener('click', function () {
      state.soundOn = !state.soundOn;
      localStorage.setItem('livpbp-sound', state.soundOn ? '1' : '0');
      if (state.soundOn) chime();
      paintToggles();
    });
    $('notify-toggle-btn').addEventListener('click', function () {
      state.notifyOn = !state.notifyOn;
      if (state.notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
      localStorage.setItem('livpbp-notify', state.notifyOn ? '1' : '0');
      paintToggles();
    });
    $('refresh-btn').addEventListener('click', function () { clearTimeout(state.timer); scan(); });
    setInterval(function () {
      var left = Math.max(0, Math.round((state.nextPollAt - Date.now()) / 1000));
      var el = $('countdown'); if (el) el.textContent = state.nextPollAt ? left + 's' : '';
    }, 500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(state.timer); scan(); } });
    var params = new URLSearchParams(window.location.search);
    var d = params.get('date');
    window.UI.loadTeams();
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : window.MLBApi.todayStr());
  });
})();
