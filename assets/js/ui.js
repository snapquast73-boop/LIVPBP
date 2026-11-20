/* ui.js — shared UI helpers: escaping, team logos/colours, count dots,
 * runners diamond, player headshots.
 * Team ids/names/abbreviations are loaded at runtime from the official
 * GET /api/v1/teams?sportId=1 endpoint (verified live 2026-11-20:
 * https://statsapi.mlb.com/api/v1/teams?sportId=1) — never hard-coded data.
 * Logo/headshot URL patterns are the ones documented in README.md
 * ("Team logos" / "Player headshots" rows of the endpoint table).
 */
(function () {
  'use strict';

  // Presentation only (colours are styling, not data). Keyed by official team id.
  var TEAM_COLORS = {
    108: '#BA0021', 109: '#A71930', 110: '#DF4601', 111: '#BD3039', 112: '#0E3386',
    113: '#C6011F', 114: '#00385D', 115: '#33006F', 116: '#0C2340', 117: '#EB6E1F',
    118: '#004687', 119: '#005A9C', 120: '#AB0003', 121: '#FF5910', 133: '#003831',
    134: '#FDB827', 135: '#FFC425', 136: '#005C5C', 137: '#FD5A1E', 138: '#C41E3A',
    139: '#092C5C', 140: '#003278', 141: '#134A8E', 142: '#002B5C', 143: '#E81828',
    144: '#CE1141', 145: '#27251F', 146: '#00A3E0', 147: '#003087', 158: '#FFC52F'
  };

  var teamsById = {}; // id -> {id,name,abbreviation,teamName}
  var teamsPromise = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loadTeams() {
    if (!teamsPromise) {
      teamsPromise = window.MLBApi.getTeams().then(function (data) {
        ((data && data.teams) || []).forEach(function (t) { teamsById[t.id] = t; });
        return teamsById;
      }).catch(function () { return teamsById; }); // pages still render from schedule data
    }
    return teamsPromise;
  }
  function team(id) { return teamsById[id] || null; }
  function abbr(id, fallback) {
    var t = teamsById[id];
    return (t && t.abbreviation) || fallback || (id ? String(id) : '?');
  }
  function color(id) { return TEAM_COLORS[id] || '#5b6b7f'; }

  function logoURL(teamId) {
    return 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/' + teamId + '.svg';
  }
  function logoImg(teamId, cls) {
    if (!teamId) return '';
    return '<img class="' + (cls || 'team-logo') + '" loading="lazy" alt="" src="' + logoURL(teamId) +
      '" onerror="this.style.display=\'none\'">';
  }
  function headshotURL(playerId) {
    return 'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/' +
      playerId + '/headshot/67/current';
  }
  function headshotImg(playerId, cls) {
    if (!playerId) return '';
    return '<img class="' + (cls || 'headshot') + '" loading="lazy" alt="" src="' + headshotURL(playerId) +
      '" onerror="this.style.display=\'none\'">';
  }

  function countDots(count) {
    count = count || {};
    var balls = count.balls || 0, strikes = count.strikes || 0, outs = count.outs || 0;
    function dots(n, max, cls) {
      var h = '';
      for (var i = 0; i < max; i++) h += '<span class="dot ' + cls + (i < n ? ' on' : '') + '"></span>';
      return h;
    }
    return '<span class="count-dots" title="' + balls + '-' + strikes + ', ' + outs + ' out">' +
      '<span class="dot-row">' + dots(balls, 4, 'ball') + '</span>' +
      '<span class="dot-row">' + dots(strikes, 3, 'strike') + '</span>' +
      '<span class="dot-row">' + dots(outs, 3, 'out') + '</span></span>';
  }

  // offense: linescore.offense {first,second,third} player objects (or ids)
  function hasRunner(base) { return !!(base && (base.id || base.fullName)); }
  function diamond(offense) {
    offense = offense || {};
    var f = hasRunner(offense.first), s = hasRunner(offense.second), t = hasRunner(offense.third);
    return '<span class="diamond" aria-label="runners">' +
      '<span class="base b2' + (s ? ' on' : '') + '"></span>' +
      '<span class="base b3' + (t ? ' on' : '') + '"></span>' +
      '<span class="base b1' + (f ? ' on' : '') + '"></span></span>';
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function inningLabel(linescore) {
    if (!linescore || !linescore.currentInning) return '';
    var half = linescore.inningHalf || linescore.currentInningState || '';
    return (half ? half + ' ' : '') + (linescore.currentInningOrdinal || ordinal(linescore.currentInning));
  }

  window.UI = {
    esc: esc,
    TEAM_COLORS: TEAM_COLORS,
    loadTeams: loadTeams,
    team: team,
    abbr: abbr,
    color: color,
    logoURL: logoURL,
    logoImg: logoImg,
    headshotURL: headshotURL,
    headshotImg: headshotImg,
    countDots: countDots,
    diamond: diamond,
    ordinal: ordinal,
    inningLabel: inningLabel
  };
})();
