/* ============================================================================
 * props.js — transparent two-sided hit forecast + Props & Matchup tab
 *
 * This is an estimate, not an MLB projection and not a betting line.  Every
 * input is read from the StatsAPI; the only constants are the model's own
 * league baseline, regression weights, count factors and clamps, which are
 * listed in docs/verification-report.md and flagged on flagged.html because
 * the original project's derivation scripts were not part of the upload.
 *
 * Signal chain (README §"Two-sided hit forecast"):
 *   season (batter xBA/AVG, pitcher xBA-allowed/opp AVG, log5, ±1.9 logits)
 *   -> platoon splits (shrunken differential)
 *   -> recent form (last 8 game-log games before the modeled date)
 *   -> career head-to-head vs this pitcher (bounded)
 *   -> same-game familiarity (times through the order)
 *   -> live count factor
 * ==========================================================================*/
(function (global) {
  'use strict';

  var MLB = global.MLB;
  var UI = global.UI;

  var LEAGUE_HIT_RATE = 0.245;      /* league average hit rate per PA */
  var MAX_SEASON_LOGITS = 1.9;      /* cap on season evidence from the prior */
  var BATTER_PRIOR_AB = 80;         /* regression weight toward .245 */
  var PITCHER_PRIOR_AB = 120;
  var FORM_GAMES = 8;
  var FORM_WEIGHT = 0.35;
  var FORM_CAP = 0.04;
  var H2H_CAP = 0.055;              /* absolute probability nudge */
  var FAMILIARITY_STEP = 0.0075;    /* per repeat look, capped at 3rd look */
  var CLAMP_NO_COUNT = [0.13, 0.62];
  var CLAMP_WITH_COUNT = [0.10, 0.78];

  /* Count factors, applied in odds space.  Keys are "balls-strikes".
   * Model constants (flagged U-2): the upstream derivation script is missing. */
  var COUNT_FACTORS = {
    '0-0': 1.00, '0-1': 0.98, '0-2': 0.82,
    '1-0': 1.08, '1-1': 1.02, '1-2': 0.88,
    '2-0': 1.18, '2-1': 1.10, '2-2': 0.95,
    '3-0': 1.28, '3-1': 1.30, '3-2': 1.15,
  };

  var TIERS = [
    { key: 'elite', label: 'Elite matchup', min: 0.34, cls: 't-elite' },
    { key: 'favorable', label: 'Favorable', min: 0.29, cls: 't-favorable' },
    { key: 'neutral', label: 'Neutral', min: 0.235, cls: 't-neutral' },
    { key: 'tough', label: 'Tough', min: 0.19, cls: 't-tough' },
    { key: 'pitcher', label: "Pitcher's edge", min: 0, cls: 't-pitcher' },
  ];

  var cache = Object.create(null);
  var CACHE_TTL_MS = 600000;

  function statCacheKey(playerId, group, season) {
    return playerId + ':' + group + ':' + season;
  }

  /* --------------------------------------------------------------- loading */

  function loadPlayer(playerId, group, season, opts) {
    var key = statCacheKey(playerId, group, season);
    var hit = cache[key];
    var nowMs = Date.now();
    if (hit && nowMs - hit.at < CACHE_TTL_MS) return hit.promise;
    var promise = MLB.peopleStats(playerId, group, {
      season: season,
      stats: 'season,statSplits,gameLog,expectedStatistics',
      sitCodes: 'vl,vr',
      ttl: CACHE_TTL_MS,
      signal: opts && opts.signal,
    }).catch(function () {
      /* One quieter retry without the split filter, then give up honestly. */
      return MLB.peopleStats(playerId, group, {
        season: season, stats: 'season,gameLog', ttl: CACHE_TTL_MS, signal: opts && opts.signal,
      }).catch(function () { return null; });
    });
    cache[key] = { at: nowMs, promise: promise };
    return promise;
  }

  function loadH2H(batterId, pitcherId, opts) {
    var key = 'h2h:' + batterId + ':' + pitcherId;
    var hit = cache[key];
    var nowMs = Date.now();
    if (hit && nowMs - hit.at < CACHE_TTL_MS) return hit.promise;
    var promise = MLB.vsPlayer(batterId, pitcherId, 'hitting', { ttl: CACHE_TTL_MS, signal: opts && opts.signal })
      .catch(function () { return null; });
    cache[key] = { at: nowMs, promise: promise };
    return promise;
  }

  function statBlocks(payload) {
    var map = Object.create(null);
    if (!payload || !Array.isArray(payload.stats)) return map;
    payload.stats.forEach(function (block) {
      var name = (block.type && block.type.displayName) || '';
      if (!map[name]) map[name] = block;
    });
    return map;
  }

  function pickCombinedOrFirst(splits) {
    if (!Array.isArray(splits) || !splits.length) return null;
    for (var i = 0; i < splits.length; i += 1) {
      if (splits[i] && !splits[i].team && splits[i].stat) return splits[i].stat;
    }
    return (splits[0] && splits[0].stat) || null;
  }

  function seasonStat(blocks) {
    var block = blocks.season;
    if (!block || !Array.isArray(block.splits) || !block.splits.length) return null;
    return pickCombinedOrFirst(block.splits);
  }

  /* Verified against live GET /api/v1/people/{id}/stats?stats=expectedStatistics
   * (e.g. player 682829 & 656849, 2026-11-20): the official StatsAPI publishes
   * expected batting average in `stat.avg` (and xSLG in `stat.slg`, xwOBA in
   * `stat.woba`), whereas offline fixtures may set `stat.xba` directly.
   * Normalize both without inventing any value when neither is present. */
  function expectedStat(blocks) {
    var block = blocks.expectedStatistics;
    if (!block || !Array.isArray(block.splits) || !block.splits.length) return null;
    var raw = pickCombinedOrFirst(block.splits);
    if (!raw) return null;
    if (raw.xba !== undefined) return raw;
    if (raw.avg !== undefined) {
      var copy = {};
      Object.keys(raw).forEach(function (k) { copy[k] = raw[k]; });
      copy.xba = raw.avg;
      return copy;
    }
    return raw;
  }

  function splitStat(blocks, code) {
    var block = blocks.statSplits;
    if (!block || !Array.isArray(block.splits)) return null;
    var target = String(code || '').toLowerCase();
    var fallback = null;
    for (var i = 0; i < block.splits.length; i += 1) {
      var split = block.splits[i];
      if (!split || !split.split) continue;
      var c = typeof split.split === 'string' ? split.split : split.split.code;
      if (c && String(c).toLowerCase() === target) {
        if (!split.team && split.stat) return split.stat;
        if (!fallback && split.stat) fallback = split.stat;
      }
    }
    return fallback;
  }

  function rateFrom(stat, preferXBA) {
    if (!stat) return null;
    var xba = Number(stat.xba);
    var avg = Number(stat.avg);
    if (preferXBA && isFinite(xba) && xba > 0) return { rate: xba, source: 'xBA' };
    if (isFinite(avg) && avg > 0) return { rate: avg, source: 'AVG' };
    if (isFinite(xba) && xba > 0) return { rate: xba, source: 'xBA' };
    return null;
  }

  function regress(rate, weight, prior) {
    return (rate * weight + prior * (BATTER_PRIOR_AB)) / (weight + BATTER_PRIOR_AB);
  }

  function clamp(value, lo, hi) { return Math.min(hi, Math.max(lo, value)); }

  function logit(p) { return Math.log(p / (1 - p)); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }

  /* log5 (Bill James odds-ratio method) with the league prior as the anchor. */
  function log5(batterRate, pitcherRate) {
    var b = clamp(batterRate, 0.05, 0.6);
    var p = clamp(pitcherRate, 0.05, 0.6);
    var l = LEAGUE_HIT_RATE;
    var num = (b * p) / l;
    var den = num + ((1 - b) * (1 - p)) / (1 - l);
    return den > 0 ? num / den : l;
  }

  function formFromGameLog(blocks, beforeDate) {
    var block = blocks.gameLog;
    if (!block || !Array.isArray(block.splits) || !block.splits.length) return null;
    var rows = block.splits.filter(function (s) {
      if (!s || !s.stat) return false;
      if (!beforeDate) return true;
      return String(s.date || '') < beforeDate;
    });
    rows = rows.slice(-FORM_GAMES);
    var ab = 0;
    var hits = 0;
    rows.forEach(function (r) {
      ab += Number(r.stat.atBats) || 0;
      hits += Number(r.stat.hits) || 0;
    });
    if (!ab) return null;
    return { ab: ab, hits: hits, rate: hits / ab, games: rows.length };
  }

  /* Verified against live GET /api/v1/people/{batterId}/stats?stats=vsPlayer&
   * group=hitting&opposingPlayerId={pitcherId} (2026-11-20): the official
   * endpoint returns `vsPlayerTotal` (career line) and `vsPlayer` (per-season
   * splits), not `season`. Accept `vsPlayerTotal`, `vsPlayer` and `season`. */
  function h2hRate(payload) {
    var blocks = statBlocks(payload);
    var h2hBlock = blocks.vsPlayerTotal || blocks.vsPlayer || blocks.season;
    var stat = h2hBlock && Array.isArray(h2hBlock.splits) ? pickCombinedOrFirst(h2hBlock.splits) : null;
    if (!stat) return null;
    var ab = Number(stat.atBats) || 0;
    var hits = Number(stat.hits) || 0;
    if (!ab) return null;
    /* Heavy regression: a career line against one pitcher is a small sample. */
    var regressed = (hits + LEAGUE_HIT_RATE * 25) / (ab + 25);
    return { ab: ab, hits: hits, rate: regressed };
  }

  function tierFor(p) {
    for (var i = 0; i < TIERS.length; i += 1) {
      if (p >= TIERS[i].min) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  /* Remaining plate appearances for the ">=1 hit in next N PAs" projection.
   * Counts the current/upcoming PA plus ~0.45 PA per remaining team inning,
   * bounded 2..4 while live/pre-game (so the multi-PA band matches the README's
   * 50–95% range and strictly exceeds the single-PA rate), and 0 once Final.
   * Flagged U-9. */
  function remainingPAs(ctx) {
    if (!ctx || ctx.gameFinal) return 0;
    var inning = Number(ctx.inning) || 1;
    var remainingInnings = Math.max(0, 9 - inning + (ctx.half === 'top' ? 1 : 0.5));
    return clamp(1 + Math.round(remainingInnings * 0.45), 2, 4);
  }

  /**
   * getForecast(ctx) -> Promise<forecast>
   * ctx: {
   *   batterId, batterName, batterHand ('L'|'R'|'S'),
   *   pitcherId, pitcherName, pitcherHand,
   *   season, gameDate (YYYY-MM-DD), count:{balls,strikes}, timesFaced,
   *   inning, half:'top'|'bottom', gameLive, gameFinal
   * }
   */
  function getForecast(ctx) {
    ctx = ctx || {};
    if (!ctx.batterId || !ctx.pitcherId) {
      return Promise.resolve(baselineForecast(ctx, 'No batter/pitcher ids in payload'));
    }

    var season = ctx.season || new Date().getUTCFullYear();
    var batterLoaded = loadPlayer(ctx.batterId, 'hitting', season);
    var pitcherLoaded = loadPlayer(ctx.pitcherId, 'pitching', season);
    var h2hLoaded = loadH2H(ctx.batterId, ctx.pitcherId);

    return Promise.all([batterLoaded, pitcherLoaded, h2hLoaded]).then(function (res) {
      var batterPayload = res[0];
      var pitcherPayload = res[1];
      var h2hPayload = res[2];

      var batterBlocks = statBlocks(batterPayload);
      var pitcherBlocks = statBlocks(pitcherPayload);

      var batterSeason = seasonStat(batterBlocks);
      var batterExpected = expectedStat(batterBlocks);
      var pitcherSeason = seasonStat(pitcherBlocks);
      var pitcherExpected = expectedStat(pitcherBlocks);

      var bRate = rateFrom(batterExpected && batterExpected.xba ? batterExpected : batterSeason, true);
      var pRate = rateFrom(pitcherExpected && pitcherExpected.xba ? pitcherExpected : pitcherSeason, true);

      var batterAB = Number(batterSeason && batterSeason.atBats) || 0;
      var pitcherAB = Number(pitcherSeason && pitcherSeason.atBats) || 0;

      var notes = [];
      var batterProb;
      var pitcherProb;

      if (bRate) {
        batterProb = (bRate.rate * batterAB + LEAGUE_HIT_RATE * BATTER_PRIOR_AB) / (batterAB + BATTER_PRIOR_AB);
      } else {
        batterProb = LEAGUE_HIT_RATE;
        notes.push('Batter season rate not published — league baseline used for the batter side.');
      }
      if (pRate) {
        /* Pitcher side: rate he allows, regressed the same way. */
        pitcherProb = (pRate.rate * pitcherAB + LEAGUE_HIT_RATE * PITCHER_PRIOR_AB) / (pitcherAB + PITCHER_PRIOR_AB);
      } else {
        pitcherProb = LEAGUE_HIT_RATE;
        notes.push('Pitcher allowed-rate not published — league baseline used for the pitcher side.');
      }

      var seasonProb = log5(batterProb, pitcherProb);
      /* Cap total season evidence at ±1.9 logits from the league prior. */
      var logitDelta = clamp(logit(seasonProb) - logit(LEAGUE_HIT_RATE), -MAX_SEASON_LOGITS, MAX_SEASON_LOGITS);
      seasonProb = expit(logit(LEAGUE_HIT_RATE) + logitDelta);

      var batterStatsUrl = MLB.API_ROOT + '/v1/people/' + encodeURIComponent(ctx.batterId) +
        '/stats?stats=season,statSplits,gameLog,expectedStatistics&group=hitting&season=' +
        encodeURIComponent(season) + '&sitCodes=vl,vr';
      var pitcherStatsUrl = MLB.API_ROOT + '/v1/people/' + encodeURIComponent(ctx.pitcherId) +
        '/stats?stats=season,statSplits,gameLog,expectedStatistics&group=pitching&season=' +
        encodeURIComponent(season) + '&sitCodes=vl,vr';
      var h2hStatsUrl = MLB.API_ROOT + '/v1/people/' + encodeURIComponent(ctx.batterId) +
        '/stats?stats=vsPlayer&group=hitting&opposingPlayerId=' + encodeURIComponent(ctx.pitcherId);
      var gameFeedUrl = ctx.gamePk
        ? MLB.API_ROOT + '/v1.1/game/' + encodeURIComponent(ctx.gamePk) + '/feed/live'
        : batterStatsUrl;

      var drivers = [];
      drivers.push({
        key: 'season',
        label: 'Season',
        points: (seasonProb - LEAGUE_HIT_RATE) * 100,
        detail: describeSeason(batterSeason, batterExpected, pitcherSeason, pitcherExpected),
        sourceUrl: batterStatsUrl,
        altSourceUrl: pitcherStatsUrl,
      });

      var prob = seasonProb;
      var preSeason = seasonProb;

      /* ---- platoon splits: shrunken differential against own season rate */
      var batterSplitCode = ctx.pitcherHand === 'L' ? 'vl' : 'vr';
      var pitcherSplitCode = ctx.batterHand === 'L' ? 'vl' : 'vr';
      var batterSplit = splitStat(batterBlocks, batterSplitCode);
      var pitcherSplit = splitStat(pitcherBlocks, pitcherSplitCode);
      var platoonDelta = 0;
      if (batterSplit && batterSeason) {
        var bsRate = Number(batterSplit.avg);
        var bSeasonRate = Number(batterSeason.avg);
        if (isFinite(bsRate) && isFinite(bSeasonRate) && bsRate > 0) {
          platoonDelta += (bsRate - bSeasonRate) * 0.5;
        }
      }
      if (pitcherSplit && pitcherSeason) {
        var psRate = Number(pitcherSplit.avg);
        var pSeasonRate = Number(pitcherSeason.avg);
        if (isFinite(psRate) && isFinite(pSeasonRate) && psRate > 0) {
          platoonDelta += (psRate - pSeasonRate) * 0.5;
        }
      }
      if (!batterSplit && !pitcherSplit) {
        drivers.push({
          key: 'platoon', label: 'Platoon', points: 0,
          detail: 'No usable vs-hand split in the payload — no platoon adjustment applied.',
          sourceUrl: batterStatsUrl,
          altSourceUrl: pitcherStatsUrl,
        });
      } else {
        prob = clamp(prob + platoonDelta, 0.02, 0.9);
        drivers.push({
          key: 'platoon', label: 'Platoon', points: (prob - preSeason) * 100,
          detail: 'Batter vs ' + (ctx.pitcherHand === 'L' ? 'LHP' : 'RHP') +
            ' and pitcher vs ' + (ctx.batterHand === 'L' ? 'LHB' : 'RHB') +
            ' splits, halved as a shrunken differential.',
          sourceUrl: batterStatsUrl,
          altSourceUrl: pitcherStatsUrl,
        });
      }

      /* ---- recent form */
      var before = preSeason;
      var form = formFromGameLog(batterBlocks, ctx.gameDate);
      if (form) {
        var seasonRate = Number(batterSeason && batterSeason.avg) || LEAGUE_HIT_RATE;
        var formDelta = clamp((form.rate - seasonRate) * FORM_WEIGHT, -FORM_CAP, FORM_CAP);
        prob = clamp(prob + formDelta, 0.02, 0.9);
        drivers.push({
          key: 'form', label: 'Form', points: (prob - before) * 100,
          detail: 'Last ' + form.games + ' game(s) before this date: ' + form.hits + '-' + form.ab + ' (' + MLB.avg3(form.rate) + ').',
          sourceUrl: batterStatsUrl,
        });
      } else {
        drivers.push({
          key: 'form', label: 'Form', points: 0,
          detail: 'No prior game log for this season — no form adjustment.',
          sourceUrl: batterStatsUrl,
        });
      }

      /* ---- career head-to-head */
      before = prob;
      var h2h = h2hRate(h2hPayload);
      if (h2h) {
        var h2hDelta = clamp((h2h.rate - prob) * 0.25, -H2H_CAP, H2H_CAP);
        prob = clamp(prob + h2hDelta, 0.02, 0.9);
        drivers.push({
          key: 'history', label: 'H2H', points: (prob - before) * 100,
          detail: 'Career vs this pitcher: ' + h2h.hits + '-' + h2h.ab + ' (regressed, capped at ±5.5 pts).',
          sourceUrl: h2hStatsUrl,
        });
      } else {
        drivers.push({
          key: 'history', label: 'H2H', points: 0,
          detail: 'No career batter-vs-pitcher line published — no adjustment.',
          sourceUrl: h2hStatsUrl,
        });
      }

      /* ---- same-game familiarity */
      before = prob;
      var looks = Math.min(Math.max(Number(ctx.timesFaced) || 0, 0), 3);
      if (looks > 0) {
        prob = clamp(prob + looks * FAMILIARITY_STEP, 0.02, 0.9);
        drivers.push({
          key: 'familiarity', label: 'Familiarity', points: (prob - before) * 100,
          detail: looks + ' previous look(s) at this pitcher in this game (+0.75 pt each, capped at the third).',
          sourceUrl: gameFeedUrl,
        });
      } else {
        drivers.push({
          key: 'familiarity', label: 'Familiarity', points: 0,
          detail: 'First look at this pitcher in this game.',
          sourceUrl: gameFeedUrl,
        });
      }

      /* ---- live count */
      var balls = Number(ctx.count && ctx.count.balls);
      var strikes = Number(ctx.count && ctx.count.strikes);
      var hasCount = isFinite(balls) && isFinite(strikes) && !(balls === 0 && strikes === 0 && !ctx.countKnown);
      if (hasCount) {
        before = prob;
        var factor = COUNT_FACTORS[balls + '-' + strikes] || 1;
        prob = expit(logit(prob) + Math.log(factor));
        var clampBand = CLAMP_WITH_COUNT;
        prob = clamp(prob, clampBand[0], clampBand[1]);
        drivers.push({
          key: 'count', label: 'Count ' + balls + '-' + strikes, points: (prob - before) * 100,
          detail: 'Count factor ' + factor.toFixed(2) + ' applied in odds space (model constant, flagged U-2).',
          sourceUrl: gameFeedUrl,
        });
      } else {
        prob = clamp(prob, CLAMP_NO_COUNT[0], CLAMP_NO_COUNT[1]);
        drivers.push({
          key: 'count', label: 'Count', points: 0,
          detail: 'No live count in the payload — pre-pitch estimate.',
          sourceUrl: gameFeedUrl,
        });
      }

      var tier = tierFor(prob);
      var nRemaining = remainingPAs(ctx);
      var atLeastOne = nRemaining > 0 ? 1 - Math.pow(1 - prob, nRemaining) : 0;

      var label = [];
      if (!bRate) label.push('batter baseline fallback');
      if (!pRate) label.push('pitcher baseline fallback');
      if (!bRate && !pRate) label = ['league baseline'];

      return {
        ok: true,
        prob: prob,
        probPct: prob * 100,
        seasonProb: preSeason,
        tier: tier,
        drivers: drivers,
        atLeastOne: atLeastOne,
        remainingPAs: nRemaining,
        notes: notes,
        label: label.join('; '),
        batter: {
          id: ctx.batterId, name: ctx.batterName || '', hand: ctx.batterHand || '',
          season: batterSeason, expected: batterExpected, sourceUrl: batterStatsUrl,
        },
        pitcher: {
          id: ctx.pitcherId, name: ctx.pitcherName || '', hand: ctx.pitcherHand || '',
          season: pitcherSeason, expected: pitcherExpected, sourceUrl: pitcherStatsUrl,
        },
        seasonYear: season,
        gameDate: ctx.gameDate || '',
        gameFinal: !!ctx.gameFinal,
        count: hasCount ? { balls: balls, strikes: strikes } : null,
        model: {
          leagueRate: LEAGUE_HIT_RATE,
          batterRate: batterProb,
          pitcherRate: pitcherProb,
          clamp: hasCount ? CLAMP_WITH_COUNT : CLAMP_NO_COUNT,
        },
      };
    }).catch(function () {
      return baselineForecast(ctx, 'Stats request failed — league baseline shown.');
    });
  }

  function describeSeason(batterSeason, batterExpected, pitcherSeason, pitcherExpected) {
    var bits = [];
    if (batterSeason) bits.push('Batter ' + MLB.avg3(batterSeason.avg) + ' AVG');
    if (batterExpected && batterExpected.xba) bits.push(MLB.avg3(batterExpected.xba) + ' xBA');
    if (pitcherSeason) bits.push('Pitcher allows ' + MLB.avg3(pitcherSeason.avg));
    if (pitcherExpected && pitcherExpected.xba) bits.push(MLB.avg3(pitcherExpected.xba) + ' xBA allowed');
    return bits.join(' · ') || 'No season inputs published.';
  }

  function baselineForecast(ctx, why) {
    var prob = LEAGUE_HIT_RATE;
    var season = (ctx && ctx.season) || new Date().getUTCFullYear();
    var fallbackSourceUrl = (ctx && ctx.batterId)
      ? MLB.API_ROOT + '/v1/people/' + encodeURIComponent(ctx.batterId) + '/stats?stats=season&group=hitting&season=' + encodeURIComponent(season)
      : (ctx && ctx.gamePk)
        ? MLB.API_ROOT + '/v1.1/game/' + encodeURIComponent(ctx.gamePk) + '/feed/live'
        : MLB.API_ROOT + '/v1/teams?sportId=1';
    return {
      ok: false,
      prob: prob,
      probPct: prob * 100,
      seasonProb: prob,
      tier: tierFor(prob),
      drivers: [{
        key: 'season', label: 'Baseline', points: 0,
        detail: why || 'League baseline.',
        sourceUrl: fallbackSourceUrl,
      }],
      atLeastOne: 0,
      remainingPAs: 0,
      notes: [why || 'League baseline.'],
      label: 'league baseline',
      batter: {
        id: ctx && ctx.batterId, name: (ctx && ctx.batterName) || '', hand: (ctx && ctx.batterHand) || '',
        sourceUrl: (ctx && ctx.batterId) ? MLB.API_ROOT + '/v1/people/' + encodeURIComponent(ctx.batterId) + '/stats?stats=season&group=hitting&season=' + encodeURIComponent(season) : '',
      },
      pitcher: {
        id: ctx && ctx.pitcherId, name: (ctx && ctx.pitcherName) || '', hand: (ctx && ctx.pitcherHand) || '',
        sourceUrl: (ctx && ctx.pitcherId) ? MLB.API_ROOT + '/v1/people/' + encodeURIComponent(ctx.pitcherId) + '/stats?stats=season&group=pitching&season=' + encodeURIComponent(season) : '',
      },
      seasonYear: season,
      gameDate: (ctx && ctx.gameDate) || '',
      gameFinal: !!(ctx && ctx.gameFinal),
      count: null,
      model: { leagueRate: LEAGUE_HIT_RATE },
    };
  }

  /* ---------------------------------------------------------------- render */

  function renderForecast(forecast) {
    if (!forecast) return '';
    var f = forecast;
    var width = Math.max(2, Math.min(100, f.probPct));
    var chips = f.drivers.filter(function (d) { return Math.abs(d.points) >= 0.05; })
      .map(function (d) {
        var sign = d.points > 0 ? '+' : '';
        return UI.chip(d.label + ' ' + sign + d.points.toFixed(1) + ' pt', d.points >= 0 ? 'chip-ok' : 'chip-danger', d.detail);
      }).join('');
    return '<div class="forecast">' +
      '<div class="forecast-head">' +
        '<span class="forecast-pa">' + f.probPct.toFixed(1) + '%<small> hit this PA</small></span>' +
        '<span class="forecast-tier ' + f.tier.cls + '">' + UI.esc(f.tier.label) + '</span>' +
        (f.remainingPAs > 0
          ? '<span class="forecast-side">≥1 hit in next ' + f.remainingPAs + ' PA: <b>' +
            (f.atLeastOne * 100).toFixed(0) + '%</b></span>'
          : '<span class="forecast-side">No plate appearances left in this game</span>') +
      '</div>' +
      '<div class="forecast-progress"><i style="width:' + width.toFixed(1) + '%"></i></div>' +
      '<div class="forecast-side">' + UI.esc(f.label ? '(' + f.label + ')' : '') + '</div>' +
      '<div class="forecast-drivers">' + chips + '</div>' +
      '<div class="forecast-side" style="font-size:11.5px;color:var(--dim)">Transparent per-PA estimate from season rates (log5), platoon splits, form, head-to-head, familiarity and count. Not an MLB projection or a betting line.</div>' +
    '</div>';
  }

  function renderPropsTab(forecast, extra) {
    extra = extra || {};
    if (!forecast) {
      return '<div class="props-wrap"><div class="props-card">No at-bat in progress — the forecast is shown on the live at-bat card while a plate appearance is active.</div></div>';
    }
    var f = forecast;
    var batterStat = f.batter && f.batter.season;
    var batterExp = f.batter && f.batter.expected;
    var pitcherStat = f.pitcher && f.pitcher.season;
    var pitcherExp = f.pitcher && f.pitcher.expected;
    var seasonYear = f.seasonYear || new Date().getUTCFullYear();

    var batterSrc = (f.batter && f.batter.sourceUrl) ||
      (f.batter && f.batter.id ? MLB.API_ROOT + '/v1/people/' + encodeURIComponent(f.batter.id) + '/stats?stats=season,statSplits,gameLog,expectedStatistics&group=hitting&season=' + encodeURIComponent(seasonYear) + '&sitCodes=vl,vr' : '');
    var pitcherSrc = (f.pitcher && f.pitcher.sourceUrl) ||
      (f.pitcher && f.pitcher.id ? MLB.API_ROOT + '/v1/people/' + encodeURIComponent(f.pitcher.id) + '/stats?stats=season,statSplits,gameLog,expectedStatistics&group=pitching&season=' + encodeURIComponent(seasonYear) + '&sitCodes=vl,vr' : '');

    var driverRows = f.drivers.map(function (d) {
      var sign = d.points > 0 ? '+' : '';
      return '<dt>' + UI.esc(d.label) + '</dt><dd>' + sign + d.points.toFixed(1) + ' pt</dd>';
    }).join('');

    var detailTableRows = f.drivers.map(function (d) {
      var sign = d.points > 0 ? '+' : '';
      var srcUrl = d.sourceUrl || batterSrc || MLB.API_ROOT + '/v1/teams?sportId=1';
      var links = '<a href="' + UI.esc(srcUrl) + '" target="_blank" rel="noopener" title="Official MLB StatsAPI source for this driver">source</a>';
      if (d.altSourceUrl) {
        links += ' · <a href="' + UI.esc(d.altSourceUrl) + '" target="_blank" rel="noopener" title="Official MLB StatsAPI pitcher source for this driver">pitcher</a>';
      }
      return '<tr>' +
        '<td><b>' + UI.esc(d.label) + '</b></td>' +
        '<td class="driver-pts">' + sign + d.points.toFixed(1) + ' pt</td>' +
        '<td class="driver-detail">' + UI.esc(d.detail) + '</td>' +
        '<td class="src-cell">' + links + '</td>' +
      '</tr>';
    }).join('');

    var isHistorical = Boolean(f.gameFinal || (f.gameDate && f.gameDate < MLB.todayISO()));
    var provenanceNote = isHistorical
      ? '<p class="box-note">Note on historical/completed games (flagged U-6): the <code>gameLog</code> form window filters strictly before <code>' +
        UI.esc(f.gameDate || 'game date') + '</code>, while MLB\'s <code>season</code>, <code>expectedStatistics</code>, <code>statSplits</code>, and <code>vsPlayer</code> endpoints return full-' +
        UI.esc(String(seasonYear)) + ' / career totals rather than pre-game point-in-time snapshots.</p>'
      : '<p class="box-note">Every driver row links directly to the official <code>statsapi.mlb.com</code> endpoint its inputs were read from; model constants are flagged U-2 on <a href="flagged.html">Flagged for Review</a>.</p>';

    return '<div class="props-wrap">' +
      renderForecast(f) +
      '<div class="props-grid">' +
        '<div class="props-card"><h4>Batter</h4>' +
          '<div class="matchup-line">' + UI.esc(f.batter.name || '—') +
            (f.batter.hand ? ' <span class="chip">' + UI.esc(f.batter.hand) + 'HB</span>' : '') +
            (batterSrc ? ' <a class="driver-src-inline" href="' + UI.esc(batterSrc) + '" target="_blank" rel="noopener" title="Official MLB StatsAPI batter stats">MLB API ↗</a>' : '') +
          '</div>' +
          '<dl class="kv">' +
            '<dt>AVG</dt><dd>' + MLB.avg3(batterStat && batterStat.avg) + '</dd>' +
            '<dt>xBA</dt><dd>' + MLB.avg3(batterExp && batterExp.xba) + '</dd>' +
            '<dt>OBP</dt><dd>' + MLB.avg3(batterStat && batterStat.obp) + '</dd>' +
            '<dt>SLG</dt><dd>' + MLB.avg3(batterStat && batterStat.slg) + '</dd>' +
            '<dt>AB</dt><dd>' + (batterStat && batterStat.atBats !== undefined ? batterStat.atBats : '—') + '</dd>' +
          '</dl>' +
        '</div>' +
        '<div class="props-card"><h4>Pitcher</h4>' +
          '<div class="matchup-line">' + UI.esc(f.pitcher.name || '—') +
            (f.pitcher.hand ? ' <span class="chip">' + UI.esc(f.pitcher.hand) + 'HP</span>' : '') +
            (pitcherSrc ? ' <a class="driver-src-inline" href="' + UI.esc(pitcherSrc) + '" target="_blank" rel="noopener" title="Official MLB StatsAPI pitcher stats">MLB API ↗</a>' : '') +
          '</div>' +
          '<dl class="kv">' +
            '<dt>Opp AVG</dt><dd>' + MLB.avg3(pitcherStat && pitcherStat.avg) + '</dd>' +
            '<dt>xBA allowed</dt><dd>' + MLB.avg3(pitcherExp && pitcherExp.xba) + '</dd>' +
            '<dt>Opp AB</dt><dd>' + (pitcherStat && pitcherStat.atBats !== undefined ? pitcherStat.atBats : '—') + '</dd>' +
          '</dl>' +
        '</div>' +
        '<div class="props-card"><h4>Model drivers</h4><dl class="kv">' + driverRows + '</dl></div>' +
      '</div>' +
      '<div class="props-card"><h4>How each driver moved the number</h4>' +
        '<table class="driver-table">' +
          '<thead><tr><th>Driver</th><th>Shift</th><th>Input &amp; adjustment</th><th title="Official source for this row">Src</th></tr></thead>' +
          '<tbody>' + detailTableRows + '</tbody>' +
        '</table>' +
        provenanceNote +
      '</div>' +
      (extra.matchupSummary ? '<div class="props-card"><h4>Matchup</h4>' + extra.matchupSummary + '</div>' : '') +
    '</div>';
  }

  global.Props = {
    getForecast: getForecast,
    renderForecast: renderForecast,
    renderPropsTab: renderPropsTab,
    tierFor: tierFor,
    remainingPAs: remainingPAs,
    COUNT_FACTORS: COUNT_FACTORS,
    LEAGUE_HIT_RATE: LEAGUE_HIT_RATE,
    clearCache: function () { cache = Object.create(null); },
  };
}(window));
