/* ============================================================================
 * game.js — the game page (game.html?gamePk=<id>)
 *
 * Renders, from one `feed/live` response: the game header, the live at-bat
 * module (count, outs, runners, on-deck, forecast), the linescore, the full
 * play-by-play with pitch detail, the box score, the Props & Matchup tab and
 * the Challenges & Reviews tab.
 *
 * Cadence (README §"Auto-refreshes"): 500 ms while a game is live, 250 ms
 * while a review is in flight (lean playByPlay probe, full feed only when the
 * review state flips), slower for preview/final games, and a 125 ms lean
 * status watcher that paints the review banner the instant MLB flips the
 * official status.  All polling pauses while the tab is hidden.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var MLB = global.MLB;
  var UI = global.UI;
  var Reviews = global.Reviews;
  var Props = global.Props;
  var FeedLog = global.FeedLog;

  var LIVE_POLL_MS = 500;
  var REVIEW_POLL_MS = 250;
  var PREVIEW_POLL_MS = 30000;
  var FINAL_POLL_MS = 60000;
  var STATUS_WATCH_MS = 125;

  var state = {
    gamePk: null,
    feed: null,
    plays: [],
    reviews: [],
    scoringChanges: [],
    log: null,
    tab: 'plays',
    forecast: null,
    forecastKey: '',
    inReview: false,
    reviewStatus: null,
    timer: null,
    watchTimer: null,
    countdownTimer: null,
    nextPollAt: 0,
    pollInFlight: false,
    watchInFlight: false,
    abort: null,
    lastSignature: '',
    lastError: null,
    pendingRerender: false,
  };

  function $(id) { return document.getElementById(id); }

  function parseGamePk() {
    var params = new URLSearchParams(global.location.search);
    var pk = params.get('gamePk');
    return /^\d+$/.test(String(pk || '')) ? pk : null;
  }

  function parseGameDate() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      var d = params.get('date');
      return MLB.isValidISODate(d) ? d : null;
    } catch (e) { return null; }
  }

  function syncNavLinks(dateStr) {
    if (!MLB.isValidISODate(dateStr)) return;
    var backLink = document.querySelector('a.btn[href^="index.html"]');
    if (backLink) backLink.setAttribute('href', 'index.html?date=' + encodeURIComponent(dateStr));
    var feedLink = document.querySelector('a.btn-feed[href^="reviews.html"]');
    if (feedLink) feedLink.setAttribute('href', 'reviews.html?date=' + encodeURIComponent(dateStr));
  }

  function setLoading(on) {
    var el = $('loading');
    if (!el) return;
    el.classList.toggle('is-hidden', !on);
  }

  function statusLine(text, isError) {
    var el = $('status-line');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
  }

  /* -------------------------------------------------------------- parsing */

  function linescoreOf(feed) { return (feed && feed.liveData && feed.liveData.linescore) || null; }

  // gameData.teams.<side> shape, verified against the official feed/live response for game
  // 824638 on 2026-11-20: it is FLAT — {id,name,abbreviation,teamName,...,record{...}} with no
  // nested `team` object (the nested `team` shape belongs to /api/v1/schedule). Accept both here
  // so a hydrated schedule or a feed payload can never leave the header without a team name.
  function teamNode(feed, side) {
    var data = (feed && feed.gameData && feed.gameData.teams) || {};
    var node = data[side] || {};
    return node.team ? node.team : node;
  }

  function teamInfo(feed, side) {
    var data = (feed && feed.gameData && feed.gameData.teams) || {};
    var ls = linescoreOf(feed) || {};
    var lsTeams = ls.teams || {};
    var team = teamNode(feed, side);
    var record = (data[side] && (data[side].record || data[side].leagueRecord)) || null;
    return {
      side: side,
      id: team.id || null,
      name: team.name || '',
      abbreviation: team.abbreviation || '',
      record: record,
      runs: lsTeams[side] && typeof lsTeams[side].runs === 'number' ? lsTeams[side].runs : null,
      hits: lsTeams[side] && typeof lsTeams[side].hits === 'number' ? lsTeams[side].hits : null,
      errors: lsTeams[side] && typeof lsTeams[side].errors === 'number' ? lsTeams[side].errors : null,
      isWinner: lsTeams[side] ? lsTeams[side].isWinner === true : false,
    };
  }

  function currentPlay(feed) {
    return (feed && feed.liveData && feed.liveData.plays && feed.liveData.plays.currentPlay) || null;
  }

  function lastCompletedPlay(feed) {
    var plays = Reviews.playsOf(feed);
    for (var i = plays.length - 1; i >= 0; i -= 1) {
      if (plays[i] && plays[i].about && plays[i].about.isComplete) return plays[i];
    }
    return null;
  }

  function playerOf(feed, id) {
    if (!id) return null;
    var players = (feed && feed.gameData && feed.gameData.players) || {};
    return players['ID' + id] || null;
  }

  function seasonLine(feed, playerId, group) {
    var player = playerOf(feed, playerId);
    var stats = player && player.stats && player.stats[group];
    if (stats) return stats;
    /* Official feed/live stores per-player season lines under
     * liveData.boxscore.teams.{away,home}.players.ID<id>.seasonStats[group]
     * (verified on game 823424 & 824638, 2026-11-20). */
    var teams = feed && feed.liveData && feed.liveData.boxscore && feed.liveData.boxscore.teams;
    if (!teams || !playerId) return null;
    var key = 'ID' + playerId;
    var sides = ['away', 'home'];
    for (var i = 0; i < sides.length; i += 1) {
      var boxPlayer = teams[sides[i]] && teams[sides[i]].players && teams[sides[i]].players[key];
      var season = boxPlayer && boxPlayer.seasonStats && boxPlayer.seasonStats[group];
      if (season) return season;
    }
    return null;
  }

  function signatureOf(feed) {
    if (!feed) return '';
    var ls = linescoreOf(feed) || {};
    var cur = currentPlay(feed) || {};
    var parts = [
      (feed.gameData && feed.gameData.status && feed.gameData.status.statusCode) || '',
      ls.currentInning, ls.inningState, ls.balls, ls.strikes, ls.outs,
      ls.teams && ls.teams.away ? ls.teams.away.runs : '',
      ls.teams && ls.teams.home ? ls.teams.home.runs : '',
      (cur.about && cur.about.atBatIndex) || '',
      (cur.matchup && cur.matchup.batter && cur.matchup.batter.id) || '',
      (cur.matchup && cur.matchup.pitcher && cur.matchup.pitcher.id) || '',
      (cur.count && (cur.count.balls + '-' + cur.count.strikes)) || '',
      Reviews.playsOf(feed).length,
      state.reviews.length,
      state.scoringChanges.length,
      state.tab,
    ];
    return parts.join('|');
  }

  /* --------------------------------------------------------------- header */

  function renderHeader() {
    var feed = state.feed;
    if (!feed) return;
    var away = teamInfo(feed, 'away');
    var home = teamInfo(feed, 'home');
    var status = (feed.gameData && feed.gameData.status) || {};
    var meta = UI.statusMeta(status);
    var ls = linescoreOf(feed) || {};

    function sideBlock(t) {
      var recordText = t.record && typeof t.record.wins === 'number'
        ? t.record.wins + '-' + t.record.losses : '';
      return '<div class="header-side ' + t.side + '">' +
        UI.teamLogo({ team: { id: t.id, name: t.name } }, 'team-logo') +
        '<div class="header-team">' +
          '<div class="header-team-name">' + UI.esc(t.name) + '</div>' +
          (recordText ? '<div class="header-team-record">' + UI.esc(recordText) + '</div>' : '') +
        '</div>' +
        '<div class="header-score">' + (t.runs === null ? '–' : t.runs) + '</div>' +
      '</div>';
    }

    var centerBits = ['<div class="status-main ' + meta.cls + '">' + UI.esc(meta.label) + '</div>'];
    if (meta.live && ls.currentInning) {
      centerBits.push('<div class="status-sub">' + UI.esc((ls.inningState || '') + ' ' + ls.currentInning) + '</div>');
    } else if (meta.final) {
      centerBits.push('<div class="status-sub">Final</div>');
    } else if (status.detailedState) {
      centerBits.push('<div class="status-sub">' + UI.esc(MLB.formatGameTime(feed.gameData.datetime && feed.gameData.datetime.dateTime)) + '</div>');
    }

    $('header-away').innerHTML = sideBlock(away);
    $('header-center').innerHTML = centerBits.join('');
    $('header-home').innerHTML = sideBlock(home);

    var metaBits = [];
    var venue = feed.gameData.venue && feed.gameData.venue.name;
    if (venue) metaBits.push('📍 ' + venue);
    var weather = feed.gameData.weather;
    if (weather && weather.condition) {
      metaBits.push('🌤 ' + weather.condition + (weather.temp ? ', ' + weather.temp + '°F' : ''));
    }
    if (feed.gameData.game && feed.gameData.game.seriesGameNumber && feed.gameData.game.gamesInSeries) {
      metaBits.push('Game ' + feed.gameData.game.seriesGameNumber + ' of ' + feed.gameData.game.gamesInSeries);
    }
    if (feed.gameData.datetime && feed.gameData.datetime.dateTime) {
      metaBits.push('🕒 ' + new Date(feed.gameData.datetime.dateTime).toLocaleString());
    }
    $('header-meta').innerHTML = metaBits.map(function (b) { return '<span>' + UI.esc(b) + '</span>'; }).join('');

    var decisions = (feed.liveData && feed.liveData.decisions) || {};
    var dBlocks = [];
    if (decisions.winner) dBlocks.push('<span>🏆 W: ' + UI.esc(decisions.winner.fullName) + '</span>');
    if (decisions.loser) dBlocks.push('<span>❌ L: ' + UI.esc(decisions.loser.fullName) + '</span>');
    if (decisions.save) dBlocks.push('<span>💾 SV: ' + UI.esc(decisions.save.fullName) + '</span>');
    $('header-decisions').innerHTML = dBlocks.join('');
  }

  /* ----------------------------------------------------------- live panel */

  function renderLivePanel() {
    var feed = state.feed;
    var wrap = $('live-panel');
    if (!wrap || !feed) return;
    var ls = linescoreOf(feed) || {};
    var status = UI.statusMeta(feed.gameData.status || {});
    var play = currentPlay(feed);
    var last = lastCompletedPlay(feed);

    if (!status.live && !status.final) {
      wrap.innerHTML = '<div class="live-card"><h4>Pregame</h4><div class="last-play">' +
        UI.esc(status.label) + ' — first pitch ' +
        UI.esc(MLB.formatGameTime(feed.gameData.datetime && feed.gameData.datetime.dateTime) || 'TBD') + '</div></div>';
      return;
    }

    if (status.final) {
      var finalCards = '<div class="live-card"><h4>Final</h4>';
      if (last && last.result && last.result.description) {
        finalCards += '<div class="last-play">' + UI.esc(last.result.description) + '</div>';
      }
      finalCards += '</div>';
      var decisions = (feed.liveData && feed.liveData.decisions) || {};
      if (decisions.winner || decisions.loser || decisions.save) {
        finalCards += '<div class="live-card"><h4>Decisions</h4>' +
          (decisions.winner ? '<div class="player-line">W <b>' + UI.esc(decisions.winner.fullName) + '</b></div>' : '') +
          (decisions.loser ? '<div class="player-line">L <b>' + UI.esc(decisions.loser.fullName) + '</b></div>' : '') +
          (decisions.save ? '<div class="player-line">SV <b>' + UI.esc(decisions.save.fullName) + '</b></div>' : '') +
          '</div>';
      }
      wrap.innerHTML = '<div class="live-grid">' + finalCards + '</div>';
      return;
    }

    /* --- live: at-bat card */
    var matchup = (play && play.matchup) || {};
    var batter = matchup.batter || {};
    var pitcher = matchup.pitcher || {};
    var count = (play && play.count) || { balls: ls.balls, strikes: ls.strikes, outs: ls.outs };
    var balls = typeof count.balls === 'number' && isFinite(count.balls) ? count.balls : null;
    var strikes = typeof count.strikes === 'number' && isFinite(count.strikes) ? count.strikes : null;
    var rawOuts = typeof count.outs === 'number' ? count.outs : ls.outs;
    var outs = typeof rawOuts === 'number' && isFinite(rawOuts) ? rawOuts : null;
    var pitchCountInPA = (play && Array.isArray(play.playEvents))
      ? play.playEvents.filter(function (ev) { return !!(ev && ev.isPitch === true); }).length
      : null;
    var offense = ls.offense || {};
    var occupied = {
      first: !!(offense.first && offense.first.id),
      second: !!(offense.second && offense.second.id),
      third: !!(offense.third && offense.third.id),
    };

    var batterSeason = seasonLine(feed, batter.id, 'batting');
    var pitcherSeason = seasonLine(feed, pitcher.id, 'pitching');
    var batterHand = matchup.batSide && matchup.batSide.code;
    var pitcherHand = matchup.pitchHand && matchup.pitchHand.code;

    var atBatCard = '<div class="live-card"><h4>At the plate</h4>' +
      '<div class="matchup-line">' + UI.headshot(batter.id, batter.fullName) +
        '<span>' + UI.esc(batter.fullName || '—') + '</span>' +
        (batterHand ? UI.chip(batterHand + 'HB') : '') +
        (batterSeason && batterSeason.avg ? UI.chip('AVG ' + MLB.avg3(batterSeason.avg)) : '') +
      '</div>' +
      '<div class="matchup-line" style="margin-top:8px">' + UI.headshot(pitcher.id, pitcher.fullName) +
        '<span style="font-weight:600">' + UI.esc(pitcher.fullName || '—') + '</span>' +
        (pitcherHand ? UI.chip(pitcherHand + 'HP') : '') +
      '</div>' +
      '<div class="count-block" style="margin-top:10px">' + UI.countDots(balls, strikes) +
        UI.outsDots(outs) + UI.baseDiamond(occupied) + '</div>' +
      '<div class="player-line" style="margin-top:10px">' +
        'On deck: <b>' + UI.esc((offense.onDeck && offense.onDeck.fullName) || '—') + '</b>' +
        ' · In the hole: <b>' + UI.esc((offense.inHole && offense.inHole.fullName) || '—') + '</b>' +
      '</div>' +
    '</div>';

    var pitcherCard = '<div class="live-card"><h4>On the mound</h4>' +
      '<div class="player-line"><b>' + UI.esc(pitcher.fullName || '—') + '</b></div>' +
      '<dl class="kv" style="margin-top:8px">' +
        '<dt>Pitches (PA)</dt><dd>' + (pitchCountInPA !== null ? pitchCountInPA : '—') + '</dd>' +
        (pitcherSeason && pitcherSeason.inningsPitched !== undefined
          ? '<dt>IP</dt><dd>' + UI.esc(pitcherSeason.inningsPitched) + '</dd>' : '') +
        (pitcherSeason && pitcherSeason.era !== undefined
          ? '<dt>ERA</dt><dd>' + UI.esc(pitcherSeason.era) + '</dd>' : '') +
        (pitcherSeason && pitcherSeason.strikeOuts !== undefined
          ? '<dt>K</dt><dd>' + UI.esc(pitcherSeason.strikeOuts) + '</dd>' : '') +
        (pitcherSeason && pitcherSeason.baseOnBalls !== undefined
          ? '<dt>BB</dt><dd>' + UI.esc(pitcherSeason.baseOnBalls) + '</dd>' : '') +
      '</dl>' +
    '</div>';

    var lastPlayCard = '';
    if (last && last.result && last.result.description) {
      lastPlayCard = '<div class="live-card"><h4>Last play</h4><div class="last-play">' +
        UI.esc(last.result.description) + '</div>' +
        (last.result.awayScore !== undefined
          ? '<div class="player-line" style="margin-top:6px">Score: <b>' +
            UI.esc(last.result.awayScore) + '–' + UI.esc(last.result.homeScore) + '</b></div>' : '') +
      '</div>';
    }

    var forecastCard = state.forecast ? '<div class="live-card"><h4>Hit forecast</h4>' +
      Props.renderForecast(state.forecast) + '</div>' : '';

    wrap.innerHTML = '<div class="live-grid">' + atBatCard + pitcherCard + lastPlayCard + '</div>' +
      (forecastCard ? '<div class="live-grid">' + forecastCard + '</div>' : '');

    maybeUpdateForecast(play, matchup);
  }

  function maybeUpdateForecast(play, matchup) {
    if (!play || !matchup || !matchup.batter || !matchup.pitcher) return;
    var feed = state.feed;
    var key = [matchup.batter.id, matchup.pitcher.id,
      play.count && play.count.balls, play.count && play.count.strikes,
      play.about && play.about.atBatIndex].join(':');
    if (key === state.forecastKey) return;
    state.forecastKey = key;

    var ls = linescoreOf(feed) || {};
    var status = (feed.gameData && feed.gameData.status) || {};
    var priorLooks = 0;
    Reviews.playsOf(feed).forEach(function (p) {
      if (p && p.about && p.about.isComplete && p.matchup &&
        p.matchup.pitcher && Number(p.matchup.pitcher.id) === Number(matchup.pitcher.id) &&
        p.matchup.batter && Number(p.matchup.batter.id) === Number(matchup.batter.id)) {
        priorLooks += 1;
      }
    });

    Props.getForecast({
      gamePk: state.gamePk,
      batterId: matchup.batter.id,
      batterName: matchup.batter.fullName,
      batterHand: matchup.batSide && matchup.batSide.code,
      pitcherId: matchup.pitcher.id,
      pitcherName: matchup.pitcher.fullName,
      pitcherHand: matchup.pitchHand && matchup.pitchHand.code,
      season: (feed.gameData.game && feed.gameData.game.season) || Number(ls.season) || undefined,
      gameDate: feed.gameData.datetime && feed.gameData.datetime.officialDate,
      count: { balls: Number(play.count && play.count.balls) || 0, strikes: Number(play.count && play.count.strikes) || 0 },
      countKnown: true,
      timesFaced: priorLooks,
      inning: ls.currentInning,
      half: String(ls.inningState || '').toLowerCase().indexOf('top') === 0 ? 'top' : 'bottom',
      gameLive: status.abstractGameState === 'Live',
      gameFinal: status.abstractGameState === 'Final',
    }).then(function (forecast) {
      state.forecast = forecast;
      if (state.forecastKey !== key) return;
      renderLivePanel();
      if (state.tab === 'props') renderPropsTab();
      renderPlayByPlay();
    });
  }

  /* Per-row official source link (restores the parallel session's F-009 request:
   * every linescore / box-score row says where its numbers came from).
   *
   * The rows are rendered from ONE feed/live response — liveData.linescore and
   * liveData.boxscore — so the link points at that exact request.  The separate
   * /linescore and /boxscore endpoints can publish a different value for the
   * same game (game 775296 reports 2 vs 3 errors for the home side; see
   * flagged.html item D-2), and a source link must not open a number the page
   * is not showing. */
  function sourceCell(kind) {
    var url = 'https://statsapi.mlb.com/api/v1.1/game/' + state.gamePk + '/feed/live';
    return '<td class="src-cell"><a href="' + url + '" target="_blank" rel="noopener"' +
      ' title="Official StatsAPI source for this row: feed/live &quot;liveData.' + kind + '&quot;">source</a></td>';
  }

  /* Absent values are shown as a dash and never substituted or guessed. */
  function orDash(value) {
    return value === null || value === undefined || value === '' ? '–' : value;
  }

  /* -------------------------------------------------------------- linescore */

  function renderLinescore() {
    var wrap = $('linescore-wrap');
    var feed = state.feed;
    if (!wrap || !feed) return;
    var ls = linescoreOf(feed);
    if (!ls || !Array.isArray(ls.innings) || !ls.innings.length) { wrap.innerHTML = ''; return; }

    var away = teamInfo(feed, 'away');
    var home = teamInfo(feed, 'home');
    var maxInnings = Math.max(9, ls.innings.length);
    var head = '<tr><th></th>';
    for (var i = 1; i <= maxInnings; i += 1) head += '<th>' + i + '</th>';
    head += '<th>R</th><th>H</th><th>E</th><th title="Official source for this row">Src</th></tr>';

    function row(team, side) {
      var cells = '';
      for (var n = 1; n <= maxInnings; n += 1) {
        var inning = ls.innings[n - 1];
        var val = inning && inning[side] && typeof inning[side].runs === 'number' ? inning[side].runs : '';
        cells += '<td class="inning-cell">' + (val === 0 ? '0' : UI.esc(val)) + '</td>';
      }
      return '<tr><td class="team-cell">' + UI.teamLogo({ team: { id: team.id, name: team.name } }, 'team-logo') +
        ' ' + UI.esc(team.abbreviation || UI.abbr({ team: { id: team.id, name: team.name } })) + '</td>' +
        cells +
        '<td class="rhe">' + (team.runs === null ? '–' : team.runs) + '</td>' +
        '<td>' + (team.hits === null ? '–' : team.hits) + '</td>' +
        '<td>' + (team.errors === null ? '–' : team.errors) + '</td>' + sourceCell('linescore') + '</tr>';
    }

    wrap.innerHTML = '<h3>Linescore</h3><table class="linescore"><thead>' + head + '</thead><tbody>' +
      row(away, 'away') + row(home, 'home') + '</tbody></table>' +
      '<p class="box-note">“–” means the value is not present in the official payload ' +
      '(left blank, never substituted). Each row links to its official StatsAPI source.</p>';
  }

  /* -------------------------------------------------------------- play-by-play */

  function renderPlayByPlay() {
    var wrap = $('plays-wrap');
    var feed = state.feed;
    if (!wrap || !feed) return;
    var plays = Reviews.playsOf(feed).slice().reverse();
    var reviewByAtBat = Object.create(null);
    state.reviews.forEach(function (r) {
      if (!reviewByAtBat[r.atBatIndex]) reviewByAtBat[r.atBatIndex] = [];
      reviewByAtBat[r.atBatIndex].push(r);
    });

    var html = [];
    var currentInningKey = '';
    plays.forEach(function (play) {
      var about = play.about || {};
      var res = play.result || {};
      var key = (about.isTopInning ? 'T' : 'B') + about.inning;
      if (key !== currentInningKey) {
        currentInningKey = key;
        html.push('<div class="inning-divider">' + UI.esc((about.isTopInning ? 'Top ' : 'Bottom ') + about.inning) + '</div>');
      }
      var reviewList = reviewByAtBat[about.atBatIndex] || [];
      var cls = 'play';
      if (reviewList.length) cls += ' has-review';
      if (about.isScoringPlay) cls += ' is-scoring';

      var pitches = '';
      if (Array.isArray(play.playEvents) && play.playEvents.length) {
        var seenPitches = 0;
        var items = play.playEvents.map(function (ev) {
          if (!ev) return '';
          var derivedPitchNum = '';
          if (ev.isPitch === true) {
            seenPitches += 1;
            derivedPitchNum = seenPitches;
          }
          if (!ev.details) return '';
          var d = ev.details;
          var call = (d.call && d.call.description) || d.description || '';
          var velo = ev.pitchData && ev.pitchData.startSpeed ? ev.pitchData.startSpeed + ' mph' : '';
          var type = d.type && d.type.description ? d.type.description : '';
          var reviewMark = ev.reviewDetails ? ' 🚨' : '';
          var pNum = typeof ev.pitchNumber === 'number' ? ev.pitchNumber : derivedPitchNum;
          return '<li><span class="p-num">' + pNum + '</span>' +
            '<span class="p-call">' + UI.esc(call) + reviewMark + '</span>' +
            '<span>' + UI.esc(type) + '</span>' +
            '<span class="p-velo">' + UI.esc(velo) + '</span></li>';
        }).filter(Boolean).join('');
        if (items) pitches = '<ul class="pitches">' + items + '</ul>';
      }

      var reviewChips = reviewList.map(function (r) {
        var cls2 = r.isABS ? 'chip-abs' : (r.isBoundary ? 'chip-warn' : 'chip-review');
        return UI.chip('🚨 ' + r.typeLabel + ' — ' + r.outcome, cls2,
          r.reason ? 'Official reason: ' + r.reason : r.typeLabel);
      }).join('');

      html.push('<div class="' + cls + '">' +
        '<div class="play-head">' +
          '<span class="play-outcome">' + UI.esc(res.eventType || '') + '</span>' +
          '<span>' + UI.esc((play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '') + '</span>' +
          '<span>' + UI.esc((play.count && (play.count.balls + '-' + play.count.strikes)) || '') +
            (typeof (play.count && play.count.outs) === 'number' ? ' · ' + play.count.outs + ' out' + (play.count.outs === 1 ? '' : 's') : '') + '</span>' +
          (res.awayScore !== undefined ? '<span class="play-score">' + UI.esc(res.awayScore) + '–' + UI.esc(res.homeScore) + '</span>' : '') +
        '</div>' +
        (res.description ? '<div class="play-desc">' + UI.esc(res.description) + '</div>' : '') +
        (reviewChips ? '<div style="margin-top:6px" class="feed-chips">' + reviewChips + '</div>' : '') +
        pitches +
      '</div>');
    });

    wrap.innerHTML = html.join('') ||
      '<div class="play">No plays yet — the game has not started.</div>';
  }

  /* --------------------------------------------------------------- box score */

  function renderBoxScore() {
    var wrap = $('boxscore-wrap');
    var feed = state.feed;
    if (!wrap || !feed) return;
    var box = feed.liveData && feed.liveData.boxscore;
    if (!box || !box.teams) {
      wrap.innerHTML = '<div class="props-card">Box score is not published for this game yet.</div>';
      return;
    }

    function teamTable(side) {
      var teamBox = box.teams[side] || {};
      var team = teamInfo(feed, side);
      var batters = (teamBox.batters || []).map(function (id) {
        return teamBox.players && teamBox.players['ID' + id];
      }).filter(Boolean);
      var pitchers = (teamBox.pitchers || []).map(function (id) {
        return teamBox.players && teamBox.players['ID' + id];
      }).filter(Boolean);

      var batRows = batters.map(function (p) {
        var s = (p.stats && p.stats.batting) || {};
        return '<tr><td>' + UI.esc(p.person ? p.person.fullName : '') + '</td>' +
          '<td class="pos">' + UI.esc((p.position && p.position.abbreviation) || '') + '</td>' +
          '<td>' + UI.esc(orDash(s.atBats)) + '</td>' +
          '<td>' + UI.esc(orDash(s.runs)) + '</td>' +
          '<td>' + UI.esc(orDash(s.hits)) + '</td>' +
          '<td>' + UI.esc(orDash(s.rbi)) + '</td>' +
          '<td>' + UI.esc(orDash(s.baseOnBalls)) + '</td>' +
          '<td>' + UI.esc(orDash(s.strikeOuts)) + '</td>' +
          '<td>' + MLB.avg3(s.avg) + '</td>' + sourceCell('boxscore') + '</tr>';
      }).join('');

      var pitRows = pitchers.map(function (p) {
        var s = (p.stats && p.stats.pitching) || {};
        return '<tr><td>' + UI.esc(p.person ? p.person.fullName : '') + '</td>' +
          '<td class="pos"></td>' +
          '<td>' + UI.esc(orDash(s.inningsPitched)) + '</td>' +
          '<td>' + UI.esc(orDash(s.hits)) + '</td>' +
          '<td>' + UI.esc(orDash(s.runs)) + '</td>' +
          '<td>' + UI.esc(orDash(s.earnedRuns)) + '</td>' +
          '<td>' + UI.esc(orDash(s.baseOnBalls)) + '</td>' +
          '<td>' + UI.esc(orDash(s.strikeOuts)) + '</td>' +
          '<td>' + UI.esc(orDash(s.era)) + '</td>' + sourceCell('boxscore') + '</tr>';
      }).join('');

      var info = (teamBox.info || []).map(function (row) {
        return '<div class="box-note">' + UI.esc(row.label || '') + ': ' + UI.esc(row.value || '') + '</div>';
      }).join('');

      return '<div><div class="box-team-head">' + UI.teamLogo({ team: { id: team.id, name: team.name } }) +
        UI.esc(team.name) + '</div>' +
        (batRows
          ? '<table class="box"><thead><tr><th>Batting</th><th>Pos</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>AVG</th><th>Src</th></tr></thead><tbody>' + batRows + '</tbody></table>'
          : '<div class="box-note">Batting lines not published yet.</div>') +
        (pitRows
          ? '<table class="box" style="margin-top:12px"><thead><tr><th>Pitching</th><th></th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>ERA</th><th>Src</th></tr></thead><tbody>' + pitRows + '</tbody></table>'
          : '') +
        info +
      '</div>';
    }

    wrap.innerHTML = '<h3>Box score</h3>' + teamTable('away') + teamTable('home');
  }

  /* ------------------------------------------------------- props / reviews */

  function renderPropsTab() {
    var wrap = $('props-wrap');
    if (!wrap) return;
    var feed = state.feed;
    var play = currentPlay(feed);
    var matchup = (play && play.matchup) || null;
    var summary = '';
    if (matchup && matchup.batter && matchup.pitcher) {
      var batterSeason = seasonLine(feed, matchup.batter.id, 'batting');
      var pitcherSeason = seasonLine(feed, matchup.pitcher.id, 'pitching');
      summary = '<div class="player-line">' + UI.esc(matchup.batter.fullName) + ' vs ' +
        UI.esc(matchup.pitcher.fullName) + '</div>' +
        '<dl class="kv">' +
          '<dt>Batter season AVG</dt><dd>' + MLB.avg3(batterSeason && batterSeason.avg) + '</dd>' +
          '<dt>Pitcher season ERA</dt><dd>' + UI.esc(pitcherSeason && pitcherSeason.era !== undefined ? pitcherSeason.era : '—') + '</dd>' +
        '</dl>';
    }
    wrap.innerHTML = Props.renderPropsTab(state.forecast, { matchupSummary: summary });
  }

  function renderReviewsTab() {
    var wrap = $('reviews-wrap');
    if (!wrap) return;
    var gamesReviews = state.reviews.slice().sort(function (a, b) {
      return (b.atBatIndex - a.atBatIndex) || 0;
    });

    var cards = gamesReviews.map(function (r) {
      var cls = 'review-card' + (r.inProgress ? ' is-live' : '') + (r.runsAtRiskCount ? ' is-at-risk' : '');
      var tracker = '<dl class="score-track">';
      if (r.score) {
        tracker += '<dt>Score after the play</dt><dd>' + r.score.away + '–' + r.score.home + '</dd>';
      }
      if (r.possibleScore) {
        tracker += '<dt>If the reviewed run(s) come off</dt><dd>' + r.possibleScore.away + '–' + r.possibleScore.home +
          ' (conditional, not a prediction)</dd>';
      }
      tracker += '</dl>';

      return '<div class="' + cls + '">' +
        '<div class="review-head">' +
          '<span class="review-type">' + UI.esc(r.typeLabel) + (r.reason ? ': ' + UI.esc(r.reason) : '') + '</span>' +
          '<span>' + UI.esc(r.inningLabel) + '</span>' +
          (r.challengerSide !== 'unknown'
            ? '<span>Challenged by ' + UI.esc(r.challenger) + (r.challengerRole ? ' (' + UI.esc(r.challengerRole) + ')' : '') + '</span>'
            : '') +
          '<span>' + UI.esc(r.outcome) + '</span>' +
          '<a href="https://statsapi.mlb.com/api/v1/game/' + encodeURIComponent(state.gamePk) + '/playByPlay" target="_blank" rel="noopener" title="Official MLB StatsAPI play-by-play source">MLB API ↗</a>' +
        '</div>' +
        '<div class="review-title">' + UI.esc(r.batter.name || '') + ' vs ' + UI.esc(r.pitcher.name || '') + '</div>' +
        (r.description ? '<div class="feed-sub">' + UI.esc(r.description) + '</div>' : '') +
        (r.isABS && r.absCountBefore
          ? '<div class="counter-note">Pitch ' + r.absPitchNumber + ': count before ' +
            r.absCountBefore.balls + '-' + r.absCountBefore.strikes +
            (r.absCountAfter ? ', after ' + r.absCountAfter.balls + '-' + r.absCountAfter.strikes : '') + '</div>'
          : '') +
        (r.runsAtRiskCount
          ? '<div class="feed-chips">' + UI.chip('⚠️ ' + r.runsAtRiskCount + ' run(s) at risk', 'chip-danger',
              'Official payload credits these scoring movements to the reviewed event') + '</div>'
          : '') +
        tracker +
        (r.irregularity ? '<div class="feed-irregular">' + UI.esc(r.irregularity) + '</div>' : '') +
      '</div>';
    }).join('');

    var changeCards = state.scoringChanges.map(function (c) {
      return '<div class="review-card">' +
        '<div class="review-head"><span class="review-type">✏️ Official scoring change</span>' +
          '<span>' + UI.esc(c.inningLabel || '') + '</span>' +
          '<span>' + UI.esc(c.batter || '') + '</span></div>' +
        '<div class="feed-sub">Initial call: ' + UI.esc(c.from && c.from.description ? c.from.description : '') + '</div>' +
        '<div class="feed-sub">Final ruling: ' + UI.esc(c.to && c.to.description ? c.to.description : '') + '</div>' +
        (c.scoreAfter ? '<div class="counter-note">Official score after the play: ' +
          UI.esc(c.scoreAfter.away) + '–' + UI.esc(c.scoreAfter.home) + '</div>' : '') +
        '<div class="feed-irregular">Attribution: ' + UI.esc(c.attribution || 'Official scorer / Elias / club review') + '</div>' +
      '</div>';
    }).join('');

    wrap.innerHTML = (cards || changeCards)
      ? (cards || '') + changeCards
      : '<div class="props-card">No challenges, reviews or scoring changes have been published for this game.</div>';
  }

  function renderReviewBanner() {
    var wrap = $('live-review-banner-wrap');
    if (!wrap) return;
    var active = state.reviews.filter(function (r) { return r.inProgress; });
    var statusReview = state.reviewStatus;
    if (!active.length && !statusReview) { wrap.innerHTML = ''; return; }

    var title = statusReview
      ? '🚨 Under review — ' + statusReview.typeLabel + (statusReview.reason ? ': ' + statusReview.reason : '')
      : '🚨 Review in progress';

    var rows = active.map(function (r) {
      return '<div class="active-item">' +
        UI.esc(r.typeLabel) + (r.reason ? ': ' + UI.esc(r.reason) : '') +
        ' · ' + UI.esc(r.inningLabel) +
        (r.challengerSide !== 'unknown' ? ' · ' + UI.esc(r.challenger) + ' challenged' : '') +
      '</div>';
    }).join('');

    wrap.innerHTML = '<div class="live-review-banner"><div class="lrb-title">' + UI.esc(title) + '</div>' +
      (rows || '<div class="feed-sub">The official status registry reports this game in review; play details are not published yet.</div>') +
      '</div>';
  }

  function updateReviewBadge() {
    var badge = $('reviews-tab-count');
    if (!badge) return;
    var n = state.reviews.length + state.scoringChanges.length;
    badge.textContent = String(n);
    badge.style.display = n ? '' : 'none';
  }

  /* --------------------------------------------------------------- polling */

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tabs-game .tab-btn').forEach(function (btn) {
      btn.classList.toggle('tab-on', btn.getAttribute('data-tab') === tab);
    });
    [['plays', 'panel-plays'], ['boxscore', 'panel-boxscore'], ['props', 'panel-props'], ['reviews', 'panel-reviews']]
      .forEach(function (pair) {
        var el = $(pair[1]);
        if (el) el.style.display = pair[0] === tab ? '' : 'none';
      });
    if (tab === 'boxscore') renderBoxScore();
    if (tab === 'props') renderPropsTab();
    if (tab === 'reviews') renderReviewsTab();
  }

  function deriveReviews() {
    var feed = state.feed;
    if (!feed) return;
    var gameData = feed.gameData || {};
    var teams = {
      away: { id: teamNode(feed, 'away').id || null, name: teamNode(feed, 'away').name || '' },
      home: { id: teamNode(feed, 'home').id || null, name: teamNode(feed, 'home').name || '' },
    };
    state.reviews = Reviews.extractReviews(Reviews.playsOf(feed), {
      gamePk: state.gamePk, teams: teams, feed: feed,
    });
    state.inReview = state.reviews.some(function (r) { return r.inProgress; });
    updateReviewBadge();
  }

  function applyScoringChangesFromLog() {
    state.scoringChanges = [];
    if (!state.log || !Array.isArray(state.log.entries)) return;
    var pk = String(state.gamePk);
    state.log.entries.forEach(function (entry) {
      if (entry && entry.kind === 'scoring_change' && String(entry.gamePk) === pk) {
        if (entry.change) state.scoringChanges.push(entry.change);
      }
    });
  }

  function renderAll() {
    renderHeader();
    renderLivePanel();
    renderLinescore();
    renderPlayByPlay();
    if (state.tab === 'boxscore') renderBoxScore();
    if (state.tab === 'props') renderPropsTab();
    if (state.tab === 'reviews') renderReviewsTab();
    renderReviewBanner();
    updateReviewBadge();
  }

  function pollDelay() {
    var feed = state.feed;
    if (!feed) return LIVE_POLL_MS;
    var status = (feed.gameData && feed.gameData.status) || {};
    if (state.inReview) return REVIEW_POLL_MS;
    if (status.abstractGameState === 'Live') return LIVE_POLL_MS;
    if (status.abstractGameState === 'Preview') return PREVIEW_POLL_MS;
    return FINAL_POLL_MS;
  }

  function scheduleNext() {
    clearTimeout(state.timer);
    var delay = pollDelay();
    state.nextPollAt = Date.now() + delay;
    state.timer = setTimeout(refresh, delay);
  }

  function refresh() {
    if (document.hidden) { scheduleNext(); return; }
    if (state.pollInFlight) return;
    state.pollInFlight = true;

    /* While a review is in flight, probe the lean play-by-play endpoint first
     * and pull the full feed only when the review state flips. */
    var pre = state.inReview
      ? MLB.playByPlay(state.gamePk, { fields: 'allPlays,about,atBatIndex,hasReview,isComplete,reviewDetails,inProgress,playEvents' })
        .then(function (lean) {
          var plays = (lean && lean.allPlays) || [];
          var stillReview = plays.some(function (p) {
            if (!p) return false;
            if (p.reviewDetails && p.reviewDetails.inProgress === true) return true;
            if (Array.isArray(p.playEvents) && p.playEvents.some(function (ev) { return !!(ev && ev.reviewDetails && ev.reviewDetails.inProgress === true); })) return true;
            return !!(p.about && p.about.hasReview === true && p.about.isComplete === false);
          });
          if (!stillReview) state.inReview = false;
          return stillReview ? null : MLB.gameFeed(state.gamePk);
        })
        .catch(function () { return MLB.gameFeed(state.gamePk); })
      : MLB.gameFeed(state.gamePk);

    return pre.then(function (feed) {
      state.pollInFlight = false;
      if (!feed) { scheduleNext(); return; }
      state.feed = feed;
      state.lastError = null;
      state.plays = Reviews.playsOf(feed);
      deriveReviews();

      if (state.log) applyScoringChangesFromLog();

      var sig = signatureOf(feed);
      var reviewChanged = state.reviews.length !== (state.lastReviewCount || 0);
      state.lastReviewCount = state.reviews.length;

      if (sig !== state.lastSignature || reviewChanged) {
        state.lastSignature = sig;
        renderAll();
      }

      setLoading(false);
      statusLine(statusSummary());
      scheduleNext();
    }).catch(function (err) {
      state.pollInFlight = false;
      state.lastError = err;
      setLoading(false);
      if (err && err.quiet) {
        statusLine('StatsAPI asked the page to slow down — pausing briefly.', false);
      } else {
        statusLine('Could not load this game (' + (err && err.message ? err.message : 'network error') + '). Retrying…', true);
      }
      scheduleNext();
    });
  }

  function statusSummary() {
    var feed = state.feed;
    if (!feed) return '';
    var status = UI.statusMeta(feed.gameData.status || {});
    var bits = [status.label];
    if (state.reviews.length) bits.push(state.reviews.length + ' review event(s)');
    if (state.scoringChanges.length) bits.push(state.scoringChanges.length + ' scoring change(s)');
    bits.push('updated ' + new Date().toLocaleTimeString());
    bits.push('source: statsapi.mlb.com/api/v1.1/game/' + state.gamePk + '/feed/live');
    return bits.join(' · ');
  }

  /* 125 ms official-status watcher: paints the banner before the full feed lands. */
  function watchStatus() {
    if (document.hidden || state.watchInFlight || !state.gamePk) return;
    state.watchInFlight = true;
    MLB.gameStatusLean(state.gamePk)
      .then(function (payload) {
        state.watchInFlight = false;
        var status = payload && payload.gameData && payload.gameData.status;
        var review = Reviews.statusReview(status);
        var changed = (review && review.code) !== (state.reviewStatus && state.reviewStatus.code);
        state.reviewStatus = review;
        if (changed) {
          renderReviewBanner();
          refresh();
        }
        if (status && state.feed && state.feed.gameData) {
          var wasLive = state.feed.gameData.status && state.feed.gameData.status.statusCode;
          if (wasLive !== status.statusCode) {
            state.feed.gameData.status = status;
            renderHeader();
          }
        }
      })
      .catch(function () { state.watchInFlight = false; });
  }

  function startCountdown() {
    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(function () {
      var el = $('countdown');
      if (!el) return;
      var left = Math.max(0, state.nextPollAt - Date.now());
      if (document.hidden) { el.textContent = 'paused'; return; }
      el.textContent = (left / 1000).toFixed(left < 2000 ? 1 : 0) + 's';
    }, 200);
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    state.gamePk = parseGamePk();
    if (!state.gamePk) {
      setLoading(false);
      if ($('main')) {
        $('main').innerHTML = '<div class="panel" style="text-align:center;color:var(--muted)">' +
          'No game selected. Open this page from the scoreboard, or add <code>?gamePk=&lt;id&gt;</code> to the URL.</div>';
      }
      statusLine('Missing or invalid gamePk parameter.', true);
      return;
    }

    document.querySelectorAll('.tabs-game .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab') || 'plays'); });
    });

    var refreshBtn = $('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { refresh(); });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { refresh(); watchStatus(); }
    });

    Reviews.loadRegistry();
    setTab('plays');
    setLoading(true);

    var initialDate = parseGameDate() || MLB.todayISO();
    syncNavLinks(initialDate);

    /* The scoring-change log is per date; use the game's official date when the
     * feed has one, today otherwise.  Re-read after the first feed arrives. */
    FeedLog.load(initialDate).then(function (log) {
      state.log = log;
      applyScoringChangesFromLog();
      return refresh();
    }).then(function () {
      var officialDate = state.feed && state.feed.gameData && state.feed.gameData.datetime &&
        state.feed.gameData.datetime.officialDate;
      if (officialDate) syncNavLinks(officialDate);
      if (officialDate && officialDate !== initialDate) {
        return FeedLog.load(officialDate).then(function (log) {
          state.log = log;
          applyScoringChangesFromLog();
          renderReviewsTab();
          updateReviewBadge();
        });
      }
      return null;
    });

    state.watchTimer = setInterval(watchStatus, STATUS_WATCH_MS);
    startCountdown();
  }

  global.Game = {
    init: init,
    refresh: refresh,
    setTab: setTab,
    state: state,
    LIVE_POLL_MS: LIVE_POLL_MS,
    REVIEW_POLL_MS: REVIEW_POLL_MS,
    PREVIEW_POLL_MS: PREVIEW_POLL_MS,
    FINAL_POLL_MS: FINAL_POLL_MS,
    STATUS_WATCH_MS: STATUS_WATCH_MS,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window));
