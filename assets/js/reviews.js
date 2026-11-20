/* reviews.js — challenge & replay-review parser.
 * Reconstructed 2026-11-20. Parses ONLY fields read from official payloads:
 *  - play.reviewDetails (live feed / playByPlay), read defensively: any of
 *    reviewType / challengeTeamId / inProgress / callDate / isOverturned /
 *    hasChallengesRemaining that the payload actually carries; absent fields
 *    stay null (never zero-filled, never guessed).
 *  - play.result.description / .event / .eventType (official play text),
 *    shown verbatim on the row so the outcome wording is auditable.
 *  - runners[] movements with details.isScoringEvent + details.playIndex
 *    (runs-at-risk: only runs credited to the very event under review).
 *  - gameData.review (manager counters) and gameData.absChallenges (ABS
 *    counters), read as-is. Pre-ABS seasons have no absChallenges object.
 * Code glosses were verified 2026-11-20 against the API's own registry,
 * GET /api/v1/gameStatus (https://statsapi.mlb.com/api/v1/gameStatus):
 * MJ = "Player challenge: Pitch Result", NJ = "Umpire Challenge: Pitch
 * Result", MA/MF (all M*) = "Manager challenge: …", NH (N*) = "Umpire
 * review: …" (NH specifically "Umpire review: Home run"), IH = "Instant
 * Replay". That registry governs statusCode; whether reviewDetails
 * .reviewType always uses the identical code set could not be confirmed
 * from a live review payload on 2026-11-20 (off-season, no live games),
 * so that one mapping is flagged in flagged.html (F-004). Unknown codes
 * are displayed raw, never glossed.
 */
(function () {
  'use strict';

  var CODE_GLOSS = {
    MJ: { kind: 'abs', label: 'ABS pitch challenge (player challenge: pitch result)' },
    NJ: { kind: 'abs', label: 'ABS pitch challenge (umpire challenge: pitch result)' },
    MA: { kind: 'challenge', label: 'Manager challenge' },
    MF: { kind: 'challenge', label: 'Manager challenge' },
    NH: { kind: 'boundary', label: 'Boundary / home-run review (umpire review)' }
  };

  function classify(code, inProgress) {
    if (inProgress) return { kind: 'under-review', label: 'Under review' };
    if (!code) return { kind: 'review', label: 'Replay review' };
    var g = CODE_GLOSS[code];
    if (g) return { kind: g.kind, label: g.label };
    if (/^N/.test(code)) return { kind: 'review', label: 'Umpire / crew review (' + code + ')' };
    if (/^M/.test(code)) return { kind: 'challenge', label: 'Challenge (' + code + ')' };
    return { kind: 'review', label: 'Replay review (' + code + ')' };
  }

  function outcomeText(play) {
    var rd = play.reviewDetails || {};
    if (typeof rd.isOverturned === 'boolean') return rd.isOverturned ? 'Overturned' : 'Call stands / confirmed';
    var desc = ((play.result || {}).description || '');
    if (/overturn/i.test(desc)) return 'Overturned (per play description)';
    if (/confirmed/i.test(desc)) return 'Confirmed (per play description)';
    if (/stands/i.test(desc)) return 'Stands (per play description)';
    if (rd.inProgress) return 'Under review';
    return null; // not stated in the payload — left blank, never inferred
  }

  // Runs credited to the reviewed event itself (details.playIndex match when
  // the payload exposes playIndex; otherwise the reviewed play's own runners).
  function runsAtRisk(play) {
    var rd = play.reviewDetails || {};
    var idx = (typeof rd.playIndex === 'number') ? rd.playIndex : null;
    var runs = 0;
    (play.runners || []).forEach(function (r) {
      var d = (r && r.details) || {};
      if (!d.isScoringEvent) return;
      if (idx != null && typeof d.playIndex === 'number' && d.playIndex !== idx) return;
      runs += 1;
    });
    return runs;
  }

  function parsePlay(play, ctx) {
    var rd = play && play.reviewDetails;
    if (!rd || typeof rd !== 'object') return null;
    var hasSignal = rd.reviewType || rd.inProgress || rd.challengeTeamId || rd.callDate;
    if (!hasSignal) return null;
    var c = classify(rd.reviewType || null, !!rd.inProgress);
    var runs = runsAtRisk(play);
    var batterId = play.matchup && play.matchup.batter && play.matchup.batter.id;
    var pitcherId = play.matchup && play.matchup.pitcher && play.matchup.pitcher.id;
    return {
      id: 'pbp-' + (play.atBatIndex != null ? play.atBatIndex : (play.playIndex != null ? play.playIndex : '')) +
          '-' + (rd.reviewType || 'review') + '-' + (rd.callDate || ''),
      kind: c.kind,
      kindLabel: c.label,
      code: rd.reviewType || null,
      inProgress: !!rd.inProgress,
      challengeTeamId: rd.challengeTeamId || null,
      outcome: outcomeText(play),
      atBatIndex: play.atBatIndex != null ? play.atBatIndex : null,
      inning: play.about && play.about.inning != null ? play.about.inning : null,
      halfInning: (play.about && play.about.halfInning) || null,
      description: (play.result && play.result.description) || null,
      event: (play.result && (play.result.event || play.result.eventType)) || null,
      batterId: batterId || null,
      pitcherId: pitcherId || null,
      runsAtRisk: runs,
      awayScore: play.result && play.result.awayScore != null ? play.result.awayScore : null,
      homeScore: play.result && play.result.homeScore != null ? play.result.homeScore : null,
      callDate: rd.callDate || null,
      gamePk: (ctx && ctx.gamePk) || null,
      source: 'StatsAPI play.reviewDetails'
    };
  }

  function parsePlays(allPlays, ctx) {
    var out = [];
    (allPlays || []).forEach(function (p) {
      var r = parsePlay(p, ctx || {});
      if (r) out.push(r);
    });
    return out;
  }

  // Status-based "under review" detection: reads the official status fields
  // only (no play-text matching). detailedState/statusCode/reason verbatim.
  function statusUnderReview(status) {
    if (!status) return null;
    var code = status.statusCode || '';
    var detail = status.detailedState || '';
    if (/^(M|N|IH|MJ|NJ)/.test(code) || /review|challenge/i.test(detail)) {
      return { statusCode: code || null, detailedState: detail || null, reason: status.reason || null };
    }
    return null;
  }

  // Official counters, read as-is. Returns null for a side the payload omits.
  function sideCounter(obj) {
    if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) return null;
    return obj;
  }
  function counters(feed) {
    var gd = (feed && feed.gameData) || {};
    return {
      manager: gd.review ? { away: sideCounter(gd.review.away), home: sideCounter(gd.review.home) } : null,
      abs: gd.absChallenges ? { away: sideCounter(gd.absChallenges.away), home: sideCounter(gd.absChallenges.home) } : null
    };
  }
  function counterText(side, isAbs) {
    if (!side) return null;
    if (isAbs) {
      var parts = [];
      if (side.remaining != null) parts.push(side.remaining + ' ABS challenges left now');
      var det = [];
      if (side.usedSuccessful != null) det.push(side.usedSuccessful + ' successful');
      if (side.usedFailed != null) det.push(side.usedFailed + ' failed');
      if (det.length) parts.push('(' + det.join(' · ') + ')');
      return parts.length ? parts.join(' ') : null;
    }
    if (side.remaining == null) return null;
    var used = side.used != null ? ' (' + side.used + ' used)' : '';
    return side.remaining + ' manager challenge' + (side.remaining === 1 ? '' : 's') + ' left now' + used;
  }

  window.Reviews = {
    CODE_GLOSS: CODE_GLOSS,
    parsePlay: parsePlay,
    parsePlays: parsePlays,
    outcomeText: outcomeText,
    runsAtRisk: runsAtRisk,
    statusUnderReview: statusUnderReview,
    counters: counters,
    counterText: counterText
  };
})();
