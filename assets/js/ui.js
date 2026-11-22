/* ============================================================================
 * ui.js — shared presentation helpers
 *
 *   UI.esc / UI.attr          HTML escaping
 *   UI.teamLogo / UI.headshot <img> with a graceful initials fallback
 *   UI.TEAM_ABBR              official StatsAPI abbreviations (verified below)
 *   UI.TEAM_COLORS            approximate club palette (visual only)
 *   UI.countDots / UI.outsDots / UI.baseDiamond
 *   UI.statusMeta             official status -> {label, cls, live}
 *   UI.cardChips              review / scoring-change chips for a game card
 * ==========================================================================*/
(function (global) {
  'use strict';

  var LOGO_BASE = 'https://www.mlbstatic.com/team-logos/team-cap-on-dark/';
  var HEADSHOT_BASE = 'https://img.mlbstatic.com/mlb-photos/image/upload/' +
    'd_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/';

  /* Official abbreviations, read from GET /api/v1/teams?sportId=1
   * (verified 2026-11-20 — see docs/verification-report.md row T-2). */
  var TEAM_ABBR = {
    108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL',
    116: 'DET', 117: 'HOU', 118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT',
    135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN',
    143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
  };

  /* Approximate club palette — presentation only, NOT an official source.
   * Flagged for review on flagged.html (U-1). */
  var TEAM_COLORS = {
    108: '#ba0021', 109: '#a71930', 110: '#df4601', 111: '#bd3039', 112: '#0e3386',
    113: '#c6011f', 114: '#00385d', 115: '#33006f', 116: '#0c2340', 117: '#eb6e1f',
    118: '#004687', 119: '#005a9c', 120: '#ab0003', 121: '#002d72', 133: '#003831',
    134: '#fdb827', 135: '#2f241d', 136: '#0c2c56', 137: '#fd5a1e', 138: '#c41e3a',
    139: '#092c5c', 140: '#003278', 141: '#134a8e', 142: '#002b5c', 143: '#e81828',
    144: '#ce1141', 145: '#27251f', 146: '#00a3e0', 147: '#0c2340', 158: '#12284b',
  };

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function teamId(team) {
    if (!team) return null;
    if (typeof team === 'number') return team;
    if (team.team && team.team.id) return Number(team.team.id);
    return team.id ? Number(team.id) : null;
  }

  function teamName(team) {
    if (!team) return '';
    if (team.team) return team.team.name || team.team.teamName || '';
    return team.name || team.teamName || '';
  }

  function abbr(team) {
    var id = teamId(team);
    if (!id) return '';
    if (TEAM_ABBR[id]) return TEAM_ABBR[id];
    var name = teamName(team);
    return name ? name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() : '';
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* Logo with an initials fallback if the CDN image is missing. */
  function teamLogo(team, cls) {
    var id = teamId(team);
    var klass = cls || 'team-logo';
    if (!id) return '<span class="team-logo-fallback">' + esc(abbr(team)) + '</span>';
    return '<img class="' + klass + '" loading="lazy" alt="' + esc(abbr(team)) + '"' +
      ' src="' + LOGO_BASE + id + '.svg"' +
      ' onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),' +
      '{className:\'team-logo-fallback\',textContent:\'' + esc(abbr(team)) + '\'}))">';
  }

  function headshot(personId, name) {
    if (!personId) return '<span class="headshot-fallback">' + esc(initials(name)) + '</span>';
    var ini = esc(initials(name));
    return '<img class="headshot" loading="lazy" alt="" src="' + HEADSHOT_BASE + encodeURIComponent(personId) +
      '/headshot/67/current"' +
      ' onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),' +
      '{className:\'headshot-fallback\',textContent:\'' + ini + '\'}))">';
  }

  function dots(filled, total, cls) {
    var out = '';
    for (var i = 0; i < total; i += 1) {
      out += '<span class="dot' + (i < filled ? ' ' + cls : '') + '"></span>';
    }
    return out;
  }

  function countDots(balls, strikes) {
    var bKnown = typeof balls === 'number' && isFinite(balls);
    var sKnown = typeof strikes === 'number' && isFinite(strikes);
    if (!bKnown && !sKnown) {
      return '<span class="count-block"><span class="count-label" title="Count not provided by official payload">—</span></span>';
    }
    return '<span class="count-block">' +
      '<span class="count-group"><span class="count-label">B</span>' + (bKnown ? dots(balls, 3, 'on-ball') : '<span class="count-label">—</span>') + '</span>' +
      '<span class="count-group"><span class="count-label">S</span>' + (sKnown ? dots(strikes, 2, 'on-strike') : '<span class="count-label">—</span>') + '</span>' +
      '</span>';
  }

  function outsDots(outs) {
    var oKnown = typeof outs === 'number' && isFinite(outs);
    if (!oKnown) {
      return '<span class="count-group"><span class="count-label">OUT</span><span class="count-label">—</span></span>';
    }
    return '<span class="count-group"><span class="count-label">OUT</span>' + dots(outs, 3, 'on-out') + '</span>';
  }

  /* occupied: { first: bool, second: bool, third: bool, scoring: bool } */
  function baseDiamond(occupied) {
    var o = occupied || {};
    function cls(on) { return on ? ' class="on"' : ''; }
    return '<span class="base-diamond" title="Runners on base">' +
      '<i data-base="2B"' + cls(o.second) + '></i>' +
      '<i data-base="3B"' + cls(o.third) + '></i>' +
      '<i data-base="1B"' + cls(o.first) + '></i>' +
      '<i data-base="score"' + cls(o.scoring) + '></i>' +
      '</span>';
  }

  /* Runners from a live feed's linescore. */
  function occupancyFromLinescore(linescore) {
    var off = (linescore && linescore.offense) || {};
    var isTop = !!(linescore && linescore.isTopInning);
    var battingHome = !isTop;
    function on(baseSide) {
      var runner = off[baseSide];
      if (!runner) return false;
      if (runner.id) return true;
      return false;
    }
    return {
      first: on('first'),
      second: on('second'),
      third: on('third'),
      scoring: false,
      battingHome: battingHome,
    };
  }

  /* Official status -> label + class.  Review states come from the StatsAPI's
   * own registry (the M and N families, plus IH); see docs/verification-report.md. */
  function statusMeta(status) {
    var s = status || {};
    var code = s.statusCode || '';
    var abstractState = s.abstractGameState || '';
    var detailed = s.detailedState || '';
    var isReview = /^[MN]/.test(code) || code === 'IH';
    var label = detailed || abstractState || '—';
    var cls = 'preview';
    if (abstractState === 'Live' || abstractState === 'Final') {
      cls = abstractState === 'Live' ? 'live' : 'final';
    } else if (abstractState === 'Preview') {
      cls = 'preview';
    }
    if (s.codedGameState === 'D' || s.codedGameState === 'C') cls = 'final';
    return {
      label: label,
      cls: cls,
      live: abstractState === 'Live',
      final: abstractState === 'Final',
      isReview: isReview,
      reason: s.reason || '',
      code: code,
    };
  }

  function chip(text, cls, title) {
    return '<span class="chip' + (cls ? ' ' + cls : '') + '"' +
      (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
  }

  global.UI = {
    LOGO_BASE: LOGO_BASE,
    TEAM_ABBR: TEAM_ABBR,
    TEAM_COLORS: TEAM_COLORS,
    esc: esc,
    teamId: teamId,
    teamName: teamName,
    abbr: abbr,
    initials: initials,
    teamLogo: teamLogo,
    headshot: headshot,
    countDots: countDots,
    outsDots: outsDots,
    baseDiamond: baseDiamond,
    occupancyFromLinescore: occupancyFromLinescore,
    statusMeta: statusMeta,
    chip: chip,
  };
}(window));
