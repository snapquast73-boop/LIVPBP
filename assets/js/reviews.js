/* ============================================================================
 * reviews.js — challenge / replay-review / ABS parser
 *
 * Everything here is read from the official payload; nothing is inferred:
 *
 *   - review TYPE comes from `reviewDetails.reviewType` (a gameStatus code —
 *     MJ/NJ = pitch challenge, M* = manager challenge, N* = umpire review, IH =
 *     instant replay) resolved through GET /api/v1/gameStatus, the API's own
 *     registry of codes and official wording.
 *   - OUTCOME comes from `reviewDetails.isOverturned` / `isOverturned`:
 *     true = Overturned, false = Stands.  The payload has no separate
 *     "Confirmed" flag, so the UI never claims that distinction.
 *   - RUNS AT RISK only counts `runners[]` entries with
 *     `details.isScoringEvent === true` whose `details.playIndex` is the
 *     reviewed event — never a score change elsewhere in the plate appearance.
 *   - SCORING CHANGES are detected by diffing each completed play's official
 *     classification between polls (the payload carries no change marker).
 * ==========================================================================*/
(function (global) {
  'use strict';

  var MLB = global.MLB;

  /* Verified 2026-11-20 against GET /api/v1/gameStatus (see
   * docs/verification-report.md rows T-3/T-4).  Used only as an offline
   * fallback before/if the registry request resolves. */
  var FALLBACK_REASONS = {
    IH: 'Review',
    MA: 'Tag play', MB: 'Touching a base', MC: 'Force play', MD: 'Catch/drop in outfield',
    ME: 'Slide interference', MF: 'Close play at 1st', MG: 'Grounds rule', MH: 'Home run', MI: 'Hit by pitch',
    MJ: 'Pitch Result', MK: 'Record keeping', ML: 'Multiple issues', MM: 'Timing play',
    MN: 'Fan interference', MO: 'Fair/foul in outfield', MP: 'Home-plate collision',
    MQ: 'Rules check', MR: 'Passing runners', MS: 'Stadium boundary call',
    MT: 'Trap play in outfield', MU: 'Tag-up play', MV: 'Catchers Interference',
    NA: 'Tag play', NB: 'Touching a base', NC: 'Force play', ND: 'Catch/drop in outfield',
    NE: 'Slide interference', NF: 'Close play at 1st', NG: 'Grounds rule', NH: 'Home run',
    NI: 'Hit by pitch', NJ: 'Pitch Result', NK: 'Record keeping', NL: 'Multiple issues',
    NM: 'Timing play', NN: 'Fan interference', NO: 'Fair/foul in outfield',
    NP: 'Home-plate collision', NQ: 'Rules check', NR: 'Passing runners',
    NS: 'Stadium boundary call', NT: 'Trap play in outfield', NU: 'Tag-up play',
    NW: 'Def Shift Violation',
  };

  /* Boundary-call reviews per the uploaded README: "boundary-call reviews
   * (potential home runs / fair-foul at the wall)" with "NH = boundary-call
   * review" and "boundary reviews are not charged to a team's counter" — so a
   * boundary call is an umpire-side review (registry N* family) of a home run,
   * fair/foul at the wall, or stadium-boundary play. A *manager challenge* of
   * one of those plays (registry MH/MD/MO/MT/MS, "Manager challenge: …") is a
   * charged challenge, not a boundary review. Verified 2026-11-22 against
   * GET /api/v1/gameStatus and matching LIVPBP2's classification
   * (audit/reference-parity-2026-11-22.md). */
  var BOUNDARY_REASONS = [
    'Home run', 'Fair/foul in outfield', 'Stadium boundary call',
  ];

  /* Event types the API itself flags as an undecided official-scorer ruling
   * (GET /api/v1/eventTypes, description "Official Scorer Ruling Pending"). */
  var PENDING_RULING_TYPES = ['os_ruling_pending_primary', 'os_ruling_pending_prior'];

  var HIT_TYPES = ['single', 'double', 'triple', 'home_run'];

  var registryByCode = null;
  var registryPromise = null;

  function loadRegistry() {
    if (!registryPromise) {
      registryPromise = MLB.gameStatusRegistry()
        .then(function (map) { registryByCode = map || null; return registryByCode; })
        .catch(function () { registryByCode = null; return null; });
    }
    return registryPromise;
  }

  function describe(code) {
    var clean = String(code || '').toUpperCase();
    var row = registryByCode && registryByCode[clean];
    var reason = (row && row.reason) || FALLBACK_REASONS[clean] || '';
    var detailed = (row && row.detailedState) || '';

    var family = 'review';
    var isABS = clean === 'MJ' || clean === 'NJ';
    if (isABS) family = 'abs';
    else if (/^M/.test(clean)) family = 'manager';
    else if (/^N/.test(clean)) family = 'umpire';
    else if (clean === 'IH') family = 'replay';

    var typeLabel =
      isABS ? 'ABS Pitch Challenge' :
      family === 'manager' ? 'Manager Challenge' :
      family === 'umpire' ? 'Umpire Review' :
      family === 'replay' ? 'Instant Replay Review' :
      'Review';

    return {
      code: clean,
      family: family,
      isABS: isABS,
      typeLabel: typeLabel,
      reason: reason,
      detailedState: detailed,
      isBoundary: !isABS && family !== 'manager' &&
        (BOUNDARY_REASONS.indexOf(reason) !== -1 || clean === 'NH'),
    };
  }

  function statusReview(status) {
    var code = String((status && status.statusCode) || '').toUpperCase();
    if (!code) return null;
    var isReview = /^[MN]/.test(code) || code === 'IH';
    if (!isReview) return null;
    var info = describe(code);
    return {
      code: code,
      family: info.family,
      typeLabel: info.typeLabel,
      reason: (status.reason || info.reason || ''),
      isABS: info.isABS,
      isBoundary: info.isBoundary,
      detailedState: status.detailedState || info.detailedState,
    };
  }

  function playsOf(payload) {
    if (!payload) return [];
    if (payload.liveData && payload.liveData.plays && payload.liveData.plays.allPlays) {
      return payload.liveData.plays.allPlays;
    }
    return payload.allPlays || [];
  }

  function sideOfTeamId(gamePk, teamId, teams) {
    if (!teamId || !teams) return 'unknown';
    var id = Number(teamId);
    if (teams.home && Number(teams.home.id) === id) return 'home';
    if (teams.away && Number(teams.away.id) === id) return 'away';
    return 'unknown';
  }

  /* Runs credited to one event of a play: `details.playIndex` must equal the
   * reviewed event's index.  Never widened to the rest of the plate appearance. */
  function runsForEvent(play, eventIndex) {
    var runs = [];
    var events = (play && play.playEvents) || [];
    var target = null;
    if (typeof eventIndex === 'number' && isFinite(eventIndex)) target = Number(eventIndex);
    else if (events.length) {
      var lastEv = events[events.length - 1];
      target = (lastEv && typeof lastEv.index === 'number' && isFinite(lastEv.index))
        ? Number(lastEv.index)
        : events.length - 1;
    }
    if (target === null) return runs;

    ((play && play.runners) || []).forEach(function (r) {
      var d = r && r.details;
      if (!d || d.isScoringEvent !== true) return;
      if (Number(d.playIndex) !== target) return;
      runs.push({
        playIndex: Number(d.playIndex),
        runnerName: (d.runner && d.runner.fullName) || '',
        rbi: d.rbi === true,
        movement: r.movement || null,
      });
    });
    return runs;
  }

  function runsScoredInPlay(play) {
    var count = 0;
    ((play && play.runners) || []).forEach(function (r) {
      if (r && r.details && r.details.isScoringEvent === true) count += 1;
    });
    return count;
  }

  function scoreOf(play, feed) {
    var res = (play && play.result) || {};
    var away = res.awayScore;
    var home = res.homeScore;
    if (typeof away === 'number' && typeof home === 'number') return { away: away, home: home };
    var ls = feed && feed.liveData && feed.liveData.linescore;
    var t = ls && ls.teams;
    if (t && t.away && t.home && typeof t.away.runs === 'number' && typeof t.home.runs === 'number') {
      return { away: t.away.runs, home: t.home.runs };
    }
    return null;
  }

  function outcomeLabel(details) {
    if (!details) return 'Unknown';
    if (details.inProgress === true) return 'Under review';
    if (details.isOverturned === true) return 'Overturned';
    if (details.isOverturned === false) return 'Stands';
    return 'Unknown';
  }

  function countBefore(playEvents, index) {
    if (!playEvents || index <= 0) return { balls: 0, strikes: 0 };
    var prev = playEvents[index - 1];
    var c = (prev && prev.count) || { balls: 0, strikes: 0 };
    return { balls: Number(c.balls) || 0, strikes: Number(c.strikes) || 0 };
  }

  function countAfter(playEvents, index) {
    var ev = playEvents && playEvents[index];
    var c = (ev && ev.count) || null;
    if (!c) return null;
    return { balls: Number(c.balls) || 0, strikes: Number(c.strikes) || 0 };
  }

  /* Official pitch number on a playEvent (RR-02, verified on game 823243
   * atBatIndex 54 where 2 non-pitch actions precede 3 pitches, so array
   * index + 1 is 5 while official `pitchNumber` is 3). Prefer `ev.pitchNumber`;
   * if unprojected fixtures omit `pitchNumber` on `isPitch: true` items, count
   * only `isPitch === true` events; otherwise return null (never array index). */
  function pitchNumberOf(playEvents, index) {
    if (!playEvents || index === null || index < 0 || index >= playEvents.length) return null;
    var ev = playEvents[index];
    if (!ev) return null;
    if (typeof ev.pitchNumber === 'number' && isFinite(ev.pitchNumber)) return Number(ev.pitchNumber);
    if (ev.isPitch === true) {
      var count = 0;
      for (var i = 0; i <= index; i += 1) {
        if (playEvents[i] && playEvents[i].isPitch === true) count += 1;
      }
      return count || null;
    }
    return null;
  }

  function halfInningLabel(play) {
    var about = (play && play.about) || {};
    var half = about.halfInning || (about.isTopInning === false ? 'bottom' : 'top');
    var inning = about.inning;
    if (!inning) return '';
    var word = String(half).toLowerCase().indexOf('top') === 0 ? 'Top' : 'Bot';
    return word + ' ' + inning;
  }

  function challengerLabel(side, teams, gamePk) {
    if (side === 'away' || side === 'home') {
      var team = teams && teams[side];
      var name = (team && (team.name || team.teamName)) || (side === 'away' ? 'Away' : 'Home');
      return name;
    }
    return 'Not specified in payload';
  }

  /* Official ABS challenger role (batter vs catcher/pitcher) derived strictly
   * from official matchup names in play/event description or battingSide vs
   * challengerSide — never guessed when challengerSide is unknown. */
  function absChallengerRole(play, eventDescription, playDescription, battingSide, challengerSide) {
    var batterName = (play && play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '';
    var pitcherName = (play && play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '';
    var text = String((eventDescription || '') + ' ' + (playDescription || ''));
    if (batterName && text.indexOf(batterName + ' challenged') !== -1) return 'batter';
    if (pitcherName && text.indexOf(pitcherName + ' challenged') !== -1) return 'pitcher';
    if (/challenged\s*\(pitch result\)/i.test(text)) {
      if (challengerSide === 'away' || challengerSide === 'home') {
        return challengerSide === battingSide ? 'batter' : 'catcher';
      }
    }
    if (challengerSide === 'away' || challengerSide === 'home') {
      return challengerSide === battingSide ? 'batter' : 'catcher / pitcher';
    }
    return null;
  }

  /**
   * extractReviews(plays, meta)
   *   meta: { gamePk, teams:{away:{id,name},home:{id,name}}, feed }
   * Returns one record per review event (play-level and pitch-level/ABS).
   */
  function extractReviews(plays, meta) {
    meta = meta || {};
    var gamePk = meta.gamePk;
    var teams = meta.teams || {};
    var out = [];
    var seen = Object.create(null);

    (plays || []).forEach(function (play) {
      if (!play) return;
      var about = play.about || {};
      var atBatIndex = Number(about.atBatIndex);
      var events = play.playEvents || [];
      var playDesc = (play.result && play.result.description) || '';

      function push(details, playIndex, eventDescription) {
        if (!details) return;
        var code = String(details.reviewType || '').toUpperCase();
        if (!code && details.inProgress !== true && typeof details.isOverturned !== 'boolean') return;
        var key = gamePk + ':' + atBatIndex + ':' + (playIndex === null ? 'p' : playIndex) + ':' + code;
        if (seen[key]) return;
        seen[key] = true;

        var info = describe(code);
        var side = sideOfTeamId(gamePk, details.challengeTeamId, teams);
        var inning = Number(about.inning) || null;
        var halfInning = about.halfInning || (about.isTopInning === false ? 'bottom' : 'top');
        var battingSide = String(halfInning).toLowerCase().indexOf('top') === 0 ? 'away' : 'home';
        var eventIndex = (playIndex !== null && events[playIndex] &&
          typeof events[playIndex].index === 'number' && isFinite(events[playIndex].index))
          ? Number(events[playIndex].index)
          : (playIndex === null ? null : playIndex);
        var runs = runsForEvent(play, eventIndex);
        var score = scoreOf(play, meta.feed);
        var scoreAfter = score;
        var possible = null;
        if (score && runs.length) {
          possible = { away: score.away, home: score.home };
          possible[battingSide] = Math.max(0, possible[battingSide] - runs.length);
        }

        /* Verified on live 2026 games (823424 atBatIndex 36, 824638 atBatIndex 72 & 86):
         * PA-ending ABS pitch challenges (strikeout/walk) attach `reviewDetails` at
         * `play.reviewDetails` (`playIndex === null`) rather than `playEvents[i]`.
         * Resolve the final pitch index in `playEvents` so pitch number and counts
         * before/after are still reported from the official playEvents array. */
        var absIndex = playIndex;
        if (absIndex === null && info.isABS && events.length) {
          for (var ei = events.length - 1; ei >= 0; ei -= 1) {
            if (events[ei] && (events[ei].isPitch || events[ei].count)) {
              absIndex = ei;
              break;
            }
          }
        }

        out.push({
          id: key,
          gamePk: gamePk,
          atBatIndex: atBatIndex,
          playIndex: playIndex,
          code: code,
          family: info.family,
          typeLabel: info.typeLabel,
          reason: info.reason,
          isABS: info.isABS,
          isBoundary: info.isBoundary,
          inning: inning,
          halfInning: halfInning,
          inningLabel: halfInningLabel(play),
          battingSide: battingSide,
          batter: {
            id: (play.matchup && play.matchup.batter && play.matchup.batter.id) || null,
            name: (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '',
          },
          pitcher: {
            id: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.id) || null,
            name: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '',
          },
          challengingTeamId: details.challengeTeamId || null,
          challengerSide: side,
          challenger: challengerLabel(side, teams, gamePk),
          challengerRole: info.isABS ? absChallengerRole(play, eventDescription, playDesc, battingSide, side) : null,
          inProgress: details.inProgress === true,
          isOverturned: typeof details.isOverturned === 'boolean' ? details.isOverturned : null,
          outcome: outcomeLabel(details),
          description: eventDescription || playDesc,
          playDescription: playDesc,
          eventType: (play.result && play.result.eventType) || '',
          score: score,
          scoreAfter: scoreAfter,
          possibleScore: possible,
          runsAtRisk: runs,
          runsAtRiskCount: runs.length,
          absPitchNumber: absIndex === null ? null : pitchNumberOf(events, absIndex),
          absCountBefore: absIndex === null ? null : countBefore(events, absIndex),
          absCountAfter: absIndex === null ? null : countAfter(events, absIndex),
          reviewDetails: details,
        });
      }

      /* Pitch-level reviews (ABS pitch challenges live here). */
      events.forEach(function (ev, index) {
        var details = ev && ev.reviewDetails;
        if (!details) return;
        push(details, index, ev.details && ev.details.description);
      });

      /* Play-level reviews (manager challenges, crew-chief/umpire reviews). */
      var pitchLevelReview = events.some(function (ev) { return !!(ev && ev.reviewDetails); });
      if (play.reviewDetails) push(play.reviewDetails, null, playDesc);
      else if (about.hasReview === true && !pitchLevelReview) {
        /* The play is flagged as reviewed but carries no reviewDetails block.
         * Report it honestly instead of guessing a type. */
        var key = gamePk + ':' + atBatIndex + ':p:';
        if (!seen[key]) {
          seen[key] = true;
          out.push({
            id: key,
            gamePk: gamePk,
            atBatIndex: atBatIndex,
            playIndex: null,
            code: '',
            family: 'unknown',
            typeLabel: 'Review (type not in payload)',
            reason: '',
            isABS: false,
            isBoundary: false,
            inning: Number(about.inning) || null,
            halfInning: about.halfInning || null,
            inningLabel: halfInningLabel(play),
            battingSide: String(about.halfInning || '').toLowerCase().indexOf('top') === 0 ? 'away' : 'home',
            batter: { id: (play.matchup && play.matchup.batter && play.matchup.batter.id) || null, name: (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '' },
            pitcher: { id: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.id) || null, name: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '' },
            challengingTeamId: null,
            challengerSide: 'unknown',
            challenger: 'Not specified in payload',
            inProgress: about.isComplete === false,
            isOverturned: null,
            outcome: 'Unknown',
            description: playDesc,
            playDescription: playDesc,
            eventType: (play.result && play.result.eventType) || '',
            score: scoreOf(play, meta.feed),
            scoreAfter: scoreOf(play, meta.feed),
            possibleScore: null,
            runsAtRisk: [],
            runsAtRiskCount: 0,
            absPitchNumber: null,
            absCountBefore: null,
            absCountAfter: null,
            reviewDetails: null,
            irregularity: 'Play flagged hasReview but the payload has no reviewDetails block — type and outcome are unverified.',
          });
        }
      }
    });

    out.sort(function (a, b) {
      if (a.atBatIndex !== b.atBatIndex) return a.atBatIndex - b.atBatIndex;
      return (a.playIndex === null ? 9999 : a.playIndex) - (b.playIndex === null ? 9999 : b.playIndex);
    });
    return out;
  }

  /* Official-scorer pending ruling (hit vs error undecided) — from the API's
   * own event-type registry, never from wording we invented. */
  function isPendingRuling(play) {
    var type = (play && play.result && play.result.eventType) || '';
    return PENDING_RULING_TYPES.indexOf(type) !== -1;
  }

  function pendingRulings(plays, meta) {
    var rows = [];
    (plays || []).forEach(function (play) {
      if (!isPendingRuling(play)) return;
      var about = play.about || {};
      var res = play.result || {};
      rows.push({
        id: (meta && meta.gamePk) + ':' + about.atBatIndex + ':pending',
        gamePk: meta && meta.gamePk,
        atBatIndex: Number(about.atBatIndex),
        inningLabel: halfInningLabel(play),
        eventType: res.eventType,
        description: res.description || '',
        batter: (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '',
        pitcher: (play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName) || '',
        score: scoreOf(play, meta && meta.feed),
        teams: (meta && meta.teams) || null,
        source: 'GET /api/v1/eventTypes — os_ruling_pending_primary / os_ruling_pending_prior (' +
          (res.eventType === PENDING_RULING_TYPES[0] ? 'primary' : 'prior') + ')',
      });
    });
    return rows;
  }

  /* --------------------------------------------------------- scoring changes */

  function isHitEvent(eventType) { return HIT_TYPES.indexOf(eventType) !== -1; }

  function classificationOf(play) {
    var res = (play && play.result) || {};
    var about = (play && play.about) || {};
    var count = (play && play.count) || {};
    var errors = 0;
    ((play && play.runners) || []).forEach(function (r) {
      var d = r && r.details;
      if (d && /error/.test(String(d.eventType || ''))) errors += 1;
    });
    return {
      atBatIndex: Number(about.atBatIndex),
      eventType: res.eventType || '',
      isOut: res.isOut === true,
      outs: typeof count.outs === 'number' ? count.outs : null,
      rbi: typeof res.rbi === 'number' ? res.rbi : null,
      awayScore: typeof res.awayScore === 'number' ? res.awayScore : null,
      homeScore: typeof res.homeScore === 'number' ? res.homeScore : null,
      description: res.description || '',
      isHit: isHitEvent(res.eventType),
      errors: errors,
      inningLabel: halfInningLabel(play),
      batter: (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || '',
    };
  }

  /* Snapshot of every completed play's official classification, keyed by atBatIndex. */
  function snapshotPlays(plays, previous) {
    var map = Object.create(null);
    (plays || []).forEach(function (play) {
      var about = (play && play.about) || {};
      if (about.isComplete !== true) return;
      var c = classificationOf(play);
      map[c.atBatIndex] = c;
    });
    return map;
  }

  /**
   * diffSnapshots(prev, next) -> { changes: [], edits: [], vanished: [] }
   *   changes  = official reclassification (hit<->error, out<->hit, extra base…)
   *   edits    = same classification but a different description / RBI / score
   *              (payload edit, flagged instead of "corrected")
   *   vanished = a previously completed play that is no longer in the payload
   */
  function diffSnapshots(prev, next) {
    var changes = [];
    var edits = [];
    var vanished = [];
    if (!prev) return { changes: changes, edits: edits, vanished: vanished };

    Object.keys(next).forEach(function (key) {
      var before = prev[key];
      var after = next[key];
      if (!before) return;
      var reclassified = before.eventType !== after.eventType ||
        before.isOut !== after.isOut ||
        (before.outs !== null && after.outs !== null && before.outs !== after.outs);
      if (reclassified) {
        changes.push({
          atBatIndex: after.atBatIndex,
          inningLabel: after.inningLabel,
          batter: after.batter,
          from: before,
          to: after,
          scoreAfter: { away: after.awayScore, home: after.homeScore },
          attribution: 'Official scorer / Elias / club review — see mlb.com/official-information/scoring-changes',
        });
      } else if (before.description !== after.description || before.rbi !== after.rbi ||
        before.awayScore !== after.awayScore || before.homeScore !== after.homeScore) {
        edits.push({
          atBatIndex: after.atBatIndex,
          inningLabel: after.inningLabel,
          batter: after.batter,
          before: before,
          after: after,
          note: 'Payload edited without reclassification (description / RBI / score only) — flagged for review, not corrected.',
        });
      }
    });

    Object.keys(prev).forEach(function (key) {
      if (!next[key]) vanished.push(prev[key]);
    });

    return { changes: changes, edits: edits, vanished: vanished };
  }

  /* --------------------------------------------------- official counters */

  function managerCounters(review) {
    if (!review) return null;
    var away = review.away || null;
    var home = review.home || null;
    if (!away && !home) return null;
    return {
      hasChallenges: review.hasChallenges === true,
      away: away ? { used: numOrNull(away.used), remaining: numOrNull(away.remaining) } : { used: null, remaining: null },
      home: home ? { used: numOrNull(home.used), remaining: numOrNull(home.remaining) } : { used: null, remaining: null },
    };
  }

  function absCounters(absChallenges) {
    if (!absChallenges) return null;
    function side(v) {
      if (!v) return { usedSuccessful: null, usedFailed: null, remaining: null };
      return {
        usedSuccessful: numOrNull(v.usedSuccessful),
        usedFailed: numOrNull(v.usedFailed),
        remaining: numOrNull(v.remaining),
      };
    }
    return {
      hasChallenges: absChallenges.hasChallenges === true,
      away: side(absChallenges.away),
      home: side(absChallenges.home),
    };
  }

  function numOrNull(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /* Counter that moved backwards between two observations = irregularity.
   * Never silently corrected (README §"challenges-remaining tracker").
   * Accepts either flat `{ away, home }` or nested `{ manager, abs }` snapshots. */
  function counterRegression(prev, next) {
    if (!prev || !next) return null;
    var notes = [];
    function checkPair(pRoot, nRoot, prefix) {
      if (!pRoot || !nRoot) return;
      ['away', 'home'].forEach(function (side) {
        var p = pRoot[side] || {};
        var n = nRoot[side] || {};
        ['used', 'usedSuccessful', 'usedFailed', 'remaining'].forEach(function (field) {
          if (typeof p[field] === 'number' && typeof n[field] === 'number' && n[field] < p[field]) {
            notes.push((prefix ? prefix + '.' : '') + side + '.' + field + ' moved backwards (' + p[field] + ' → ' + n[field] + ')');
          }
        });
      });
    }
    if (prev.away || prev.home || next.away || next.home) {
      checkPair(prev, next, '');
    }
    if (prev.manager || next.manager) checkPair(prev.manager, next.manager, 'manager');
    if (prev.abs || next.abs) checkPair(prev.abs, next.abs, 'abs');
    return notes.length ? notes : null;
  }

  /* Both-teams summary from the uploaded README:
   * "Challenges left: CIN 1 MGR · 2 ABS — CHC 1 MGR · 2 ABS" — shown on hover
   * of a row's counter and on the Under-Review live strip. Team labels come
   * from meta.awayLabel/meta.homeLabel (or meta.awayAbbr/homeAbbr). Official
   * counters only: an absent counter (pre-ABS seasons have no absChallenges
   * object) is omitted, never zero-filled; if nothing is known the summary
   * is ''. */
  function countersSummary(meta) {
    if (!meta) return '';
    function sideSummary(side, abbr) {
      var bits = [];
      var m = meta.manager && meta.manager[side];
      var a = meta.abs && meta.abs[side];
      if (m && typeof m.remaining === 'number') bits.push(m.remaining + ' MGR');
      if (a && typeof a.remaining === 'number') bits.push(a.remaining + ' ABS');
      if (!bits.length) return '';
      return (abbr || (side === 'away' ? 'Away' : 'Home')) + ' ' + bits.join(' · ');
    }
    var awayPart = sideSummary('away', meta.awayLabel || meta.awayAbbr);
    var homePart = sideSummary('home', meta.homeLabel || meta.homeAbbr);
    if (!awayPart && !homePart) return '';
    return 'Challenges left: ' + (awayPart || '—') + ' — ' + (homePart || '—');
  }

  /* Largest-angle counter line used on feed rows and the live strip. */
  function counterLine(meta) {
    if (!meta) return '';
    /* The uploaded README shows the challenging team's abbreviation as a
     * prefix: "CIN: 2 ABS challenges left now (2 successful · 0 failed)" /
     * "PIT: 1 manager challenge left now (0 used)". */
    var prefix = meta.label ? meta.label + ': ' : '';
    var parts = [];
    if (meta.manager && meta.manager[meta.side]) {
      var m = meta.manager[meta.side];
      if (typeof m.remaining === 'number') {
        parts.push(m.remaining + ' manager challenge' + (m.remaining === 1 ? '' : 's') + ' left now (' +
          (typeof m.used === 'number' ? m.used + ' used' : 'used not published') + ')');
      }
    }
    if (meta.abs && meta.abs[meta.side]) {
      var a = meta.abs[meta.side];
      if (typeof a.remaining === 'number') {
        var bits = [];
        if (typeof a.usedSuccessful === 'number') bits.push(a.usedSuccessful + ' successful');
        if (typeof a.usedFailed === 'number') bits.push(a.usedFailed + ' failed');
        parts.push(a.remaining + ' ABS challenge' + (a.remaining === 1 ? '' : 's') + ' left now (' +
          (bits.length ? bits.join(' · ') : 'used not published') + ')');
      }
    }
    return prefix + parts.join(' · ');
  }

  global.Reviews = {
    loadRegistry: loadRegistry,
    describe: describe,
    statusReview: statusReview,
    playsOf: playsOf,
    runsForEvent: runsForEvent,
    runsScoredInPlay: runsScoredInPlay,
    scoreOf: scoreOf,
    extractReviews: extractReviews,
    pendingRulings: pendingRulings,
    isPendingRuling: isPendingRuling,
    snapshotPlays: snapshotPlays,
    diffSnapshots: diffSnapshots,
    classificationOf: classificationOf,
    managerCounters: managerCounters,
    absCounters: absCounters,
    counterRegression: counterRegression,
    countersSummary: countersSummary,
    counterLine: counterLine,
    isHitEvent: isHitEvent,
    BOUNDARY_REASONS: BOUNDARY_REASONS,
    PENDING_RULING_TYPES: PENDING_RULING_TYPES,
  };
}(window));
