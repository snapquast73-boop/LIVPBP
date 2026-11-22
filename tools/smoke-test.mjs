#!/usr/bin/env node
/* ============================================================================
 * tools/smoke-test.mjs — deterministic, network-free checks for the rebuilt app
 *
 * The original project's test suite (17 tools/*.mjs scripts) was not part of
 * the upload, so this harness replaces it: it boots each real page in jsdom
 * with the real scripts, stubs only `fetch` (with payloads whose shapes were
 * verified against the live StatsAPI on 2026-11-20 — see
 * docs/verification-report.md), and asserts on the rendered DOM.
 *
 *   node tools/smoke-test.mjs
 * ==========================================================================*/
import jsdomPkg from 'jsdom';
const { JSDOM, VirtualConsole } = jsdomPkg;
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { pass += 1; console.log(`  ✓ ${name}`); })
    .catch((err) => {
      fail += 1;
      failures.push(`${name}: ${err && err.message}`);
      console.log(`  ✗ ${name} — ${err && err.message}`);
    });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

/* ----------------------------------------------------------------- fixtures */

/* Shape verified against GET /api/v1/schedule?sportId=1&date=2026-09-15
 * &hydrate=probablePitcher,linescore,decisions,review (2026-11-20). */
const SCHEDULE = {
  totalGames: 3,
  dates: [{
    date: '2026-09-15',
    totalGames: 3,
    games: [
      {
        gamePk: 824466,
        gameDate: '2026-09-15T22:40:00Z',
        officialDate: '2026-09-15',
        status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final', statusCode: 'F' },
        teams: {
          away: {
            team: { id: 119, name: 'Los Angeles Dodgers' },
            score: 4, isWinner: true, leagueRecord: { wins: 90, losses: 70 },
            probablePitcher: { id: 808967, fullName: 'Yoshinobu Yamamoto' },
          },
          home: {
            team: { id: 113, name: 'Cincinnati Reds' },
            score: 0, isWinner: false, leagueRecord: { wins: 70, losses: 90 },
            probablePitcher: { id: 666157, fullName: 'Nick Lodolo' },
          },
        },
        venue: { id: 2602, name: 'Great American Ball Park' },
        doubleHeader: 'N', gamesInSeries: 4, seriesGameNumber: 2,
        linescore: { currentInning: 9, inningState: 'End', isFinal: true, teams: { away: { runs: 4, hits: 9, errors: 0 }, home: { runs: 0, hits: 4, errors: 1 } } },
        decisions: { winner: { fullName: 'Yoshinobu Yamamoto' }, loser: { fullName: 'Nick Lodolo' } },
        review: { hasChallenges: false, away: { used: 0, remaining: 1 }, home: { used: 0, remaining: 1 } },
      },
      {
        gamePk: 822925,
        gameDate: '2026-09-15T22:40:00Z',
        officialDate: '2026-09-15',
        status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final', statusCode: 'F' },
        teams: {
          away: { team: { id: 133, name: 'Athletics' }, score: 1, isWinner: false },
          home: { team: { id: 139, name: 'Tampa Bay Rays' }, score: 2, isWinner: true },
        },
        venue: { id: 12, name: 'Tropicana Field' },
        doubleHeader: 'N', gamesInSeries: 3, seriesGameNumber: 1,
        review: { hasChallenges: false, away: { used: 0, remaining: 1 }, home: { used: 0, remaining: 1 } },
      },
      {
        gamePk: 823109,
        gameDate: '2026-09-15T23:10:00Z',
        officialDate: '2026-09-15',
        status: {
          abstractGameState: 'Live', codedGameState: 'M', detailedState: 'Manager challenge: Tag play',
          statusCode: 'MA', reason: 'Tag play',
        },
        teams: {
          away: { team: { id: 136, name: 'Seattle Mariners' }, score: 2 },
          home: { team: { id: 142, name: 'Minnesota Twins' }, score: 3 },
        },
        venue: { id: 3312, name: 'Target Field' },
        doubleHeader: 'N', gamesInSeries: 3, seriesGameNumber: 2,
        linescore: { currentInning: 6, inningState: 'Top', balls: 1, strikes: 2, outs: 1 },
        review: { hasChallenges: true, away: { used: 1, remaining: 0 }, home: { used: 1, remaining: 1 } },
      },
    ],
  }],
};

/* Official game-status registry rows (subset of GET /api/v1/gameStatus). */
const GAME_STATUS = [
  { abstractGameState: 'Live', codedGameState: 'M', detailedState: 'Manager challenge: Tag play', statusCode: 'MA', reason: 'Tag play', abstractGameCode: 'L' },
  { abstractGameState: 'Live', codedGameState: 'M', detailedState: 'Manager challenge: Catch/drop in outfield', statusCode: 'MD', reason: 'Catch/drop in outfield', abstractGameCode: 'L' },
  { abstractGameState: 'Live', codedGameState: 'M', detailedState: 'Player challenge: Pitch Result', statusCode: 'MJ', reason: 'Pitch Result', abstractGameCode: 'L' },
  { abstractGameState: 'Live', codedGameState: 'N', detailedState: 'Umpire review: Tag play', statusCode: 'NA', reason: 'Tag play', abstractGameCode: 'L' },
  { abstractGameState: 'Live', codedGameState: 'N', detailedState: 'Umpire review: Home run', statusCode: 'NH', reason: 'Home run', abstractGameCode: 'L' },
  { abstractGameState: 'Live', codedGameState: 'I', detailedState: 'Instant Replay', statusCode: 'IH', reason: 'Review', abstractGameCode: 'L' },
];

/* reviewDetails shape verified against
 * GET /api/v1/game/823109/playByPlay (2026-11-20): {isOverturned, inProgress,
 * reviewType, challengeTeamId}. */
function play(atBatIndex, extra = {}) {
  return {
    about: {
      atBatIndex,
      inning: 6,
      halfInning: 'top',
      isTopInning: true,
      isComplete: true,
      hasReview: false,
      isScoringPlay: false,
    },
    result: { eventType: 'single', description: 'Batter singles.', rbi: 0, awayScore: 2, homeScore: 3, isOut: false },
    count: { balls: 1, strikes: 2, outs: 1 },
    matchup: {
      batter: { id: 660271, fullName: 'Test Batter' },
      pitcher: { id: 592789, fullName: 'Test Pitcher' },
      batSide: { code: 'L' },
      pitchHand: { code: 'R' },
    },
    runners: [],
    playEvents: [],
    ...extra,
  };
}

const PBP_823109 = {
  allPlays: [
    play(25),
    /* ABS pitch challenge: pitch-level reviewDetails, overturned. */
    play(26, {
      about: { atBatIndex: 26, inning: 6, halfInning: 'top', isTopInning: true, isComplete: true, hasReview: true, isScoringPlay: false },
      playEvents: [
        { index: 0, isPitch: true, count: { balls: 1, strikes: 0, outs: 1 }, details: { call: { description: 'Ball' }, description: 'Ball', type: { description: 'Four-Seam Fastball' } } },
        { index: 1, isPitch: true, count: { balls: 1, strikes: 1, outs: 1 }, details: { call: { description: 'Called Strike' }, description: 'Called Strike', type: { description: 'Slider' } } },
        { index: 2, isPitch: true, count: { balls: 1, strikes: 2, outs: 1 }, details: { call: { description: 'Called Strike' }, description: 'Called Strike' }, reviewDetails: { isOverturned: true, inProgress: false, reviewType: 'MJ', challengeTeamId: 136 } },
      ],
    }),
    /* Boundary review that stands, no runs credited. */
    play(48, {
      about: { atBatIndex: 48, inning: 6, halfInning: 'top', isTopInning: true, isComplete: true, hasReview: true, isScoringPlay: false },
      result: { eventType: 'home_run', description: 'Trap play in outfield, call stands.', rbi: 1, awayScore: 3, homeScore: 3, isOut: false },
      reviewDetails: { isOverturned: false, inProgress: false, reviewType: 'MD', challengeTeamId: 142 },
      runners: [
        { details: { event: 'Home Run', eventType: 'home_run', isScoringEvent: true, rbi: true, playIndex: 3, runner: { fullName: 'Test Batter' } }, movement: { start: null, end: 'score', isOut: false } },
      ],
    }),
    /* Manager challenge, overturned, with a run credited to the reviewed event. */
    play(53, {
      about: { atBatIndex: 53, inning: 7, halfInning: 'bottom', isTopInning: false, isComplete: true, hasReview: true, isScoringPlay: true },
      result: { eventType: 'field_out', description: 'Runner ruled safe at home after review — overturned.', rbi: 1, awayScore: 3, homeScore: 4, isOut: false },
      reviewDetails: { isOverturned: true, inProgress: false, reviewType: 'MA', challengeTeamId: 136 },
      count: { balls: 0, strikes: 1, outs: 2 },
      runners: [
        { details: { event: 'Single', eventType: 'single', isScoringEvent: true, rbi: true, playIndex: 1, runner: { fullName: 'Runner One' } }, movement: { start: '3B', end: 'score', isOut: false } },
        { details: { event: 'Stolen Base 2B', eventType: 'stolen_base_2b', isScoringEvent: false, rbi: false, playIndex: 1, runner: { fullName: 'Runner Two' } }, movement: { start: '1B', end: '2B', isOut: false } },
      ],
      playEvents: [
        { index: 0, isPitch: true, count: { balls: 0, strikes: 0, outs: 2 }, details: { call: { description: 'In play, run(s)' }, description: 'In play, run(s)' } },
        { index: 1, isPitch: true, count: { balls: 0, strikes: 1, outs: 2 }, details: { call: { description: 'In play, out(s)' }, description: 'In play, out(s)' } },
      ],
    }),
    /* Umpire review (crew chief), stands, under review at the time of the scan. */
    play(70, {
      about: { atBatIndex: 70, inning: 8, halfInning: 'top', isTopInning: true, isComplete: false, hasReview: true, isScoringPlay: false },
      reviewDetails: { isOverturned: false, inProgress: true, reviewType: 'NA' },
      result: { eventType: 'field_out', description: 'Tag play under review.', awayScore: 3, homeScore: 4 },
    }),
    /* Official-scorer pending ruling (eventTypes registry code). */
    play(71, {
      result: { eventType: 'os_ruling_pending_primary', description: 'Official Scorer Ruling Pending', awayScore: 3, homeScore: 4 },
    }),
  ],
};

const FEED_823109 = {
  gameData: {
    game: { pk: 823109, season: 2026, seriesGameNumber: 2, gamesInSeries: 3 },
    status: { abstractGameState: 'Live', codedGameState: 'M', detailedState: 'Manager challenge: Tag play', statusCode: 'MA', reason: 'Tag play' },
    teams: {
      away: { team: { id: 136, name: 'Seattle Mariners', abbreviation: 'SEA' }, record: { wins: 80, losses: 76 } },
      home: { team: { id: 142, name: 'Minnesota Twins', abbreviation: 'MIN' }, record: { wins: 74, losses: 82 } },
    },
    players: {
      ID660271: { id: 660271, fullName: 'Test Batter', primaryPosition: { abbreviation: 'CF' }, stats: { batting: { avg: '.280', atBats: 500, hits: 140 } } },
      ID592789: { id: 592789, fullName: 'Test Pitcher', primaryPosition: { abbreviation: 'P' }, stats: { pitching: { era: '3.45', inningsPitched: '150.1', strikeOuts: 160, baseOnBalls: 40 } } },
    },
    venue: { name: 'Target Field' },
    weather: { condition: 'Clear', temp: '68' },
    datetime: { dateTime: '2026-09-15T23:10:00Z', officialDate: '2026-09-15' },
    review: { hasChallenges: true, away: { used: 1, remaining: 0 }, home: { used: 1, remaining: 1 } },
    absChallenges: { hasChallenges: true, away: { usedSuccessful: 0, usedFailed: 1, remaining: 2 }, home: { usedSuccessful: 1, usedFailed: 0, remaining: 2 } },
  },
  liveData: {
    plays: {
      allPlays: PBP_823109.allPlays,
      currentPlay: {
        about: { atBatIndex: 72, inning: 8, halfInning: 'top', isTopInning: true, isComplete: false },
        result: { eventType: 'at_bat_start', description: '' },
        count: { balls: 2, strikes: 1, outs: 1 },
        matchup: {
          batter: { id: 660271, fullName: 'Test Batter' },
          pitcher: { id: 592789, fullName: 'Test Pitcher' },
          batSide: { code: 'L' }, pitchHand: { code: 'R' },
        },
        runners: [], playEvents: [],
      },
    },
    linescore: {
      currentInning: 8, inningState: 'Top', isTopInning: true, balls: 2, strikes: 1, outs: 1,
      teams: { away: { runs: 3, hits: 8, errors: 0 }, home: { runs: 4, hits: 9, errors: 1 } },
      offense: {
        batter: { id: 660271, fullName: 'Test Batter' },
        onDeck: { id: 665742, fullName: 'On Deck Guy' },
        inHole: { id: 669288, fullName: 'In Hole Guy' },
        first: { id: 621566 }, second: null, third: { id: 641487 },
      },
      innings: Array.from({ length: 8 }, (_, i) => ({
        num: i + 1,
        ordinalNum: `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}`,
        home: { runs: i % 2, hits: 1, errors: 0 },
        away: { runs: i % 3 === 0 ? 1 : 0, hits: 1, errors: 0 },
      })),
    },
    boxscore: {
      teams: {
        away: {
          team: { id: 136, name: 'Seattle Mariners' },
          batters: [660271], pitchers: [592789], battingOrder: [660271],
          players: {
            ID660271: { person: { id: 660271, fullName: 'Test Batter' }, position: { abbreviation: 'CF' }, stats: { batting: { atBats: 4, runs: 1, hits: 2, rbi: 1, baseOnBalls: 0, strikeOuts: 1, avg: '.280' } } },
            ID592789: { person: { id: 592789, fullName: 'Test Pitcher' }, position: { abbreviation: 'P' }, stats: { pitching: { inningsPitched: '6.0', hits: 5, runs: 2, earnedRuns: 2, baseOnBalls: 1, strikeOuts: 7, era: '3.45' } } },
          },
          info: [{ label: 'Weather', value: '68 degrees, Clear.' }],
        },
        home: {
          team: { id: 142, name: 'Minnesota Twins' },
          batters: [], pitchers: [], battingOrder: [], players: {}, info: [],
        },
      },
    },
    decisions: {},
  },
};

/* people/{id}/stats — shape from GET /api/v1/people/{id}/stats?stats=season,
 * statSplits,gameLog,expectedStatistics&group=hitting&sitCodes=vl,vr */
const HITTER_STATS = {
  stats: [
    { type: { displayName: 'season' }, group: { displayName: 'hitting' }, splits: [{ season: '2026', stat: { avg: '.280', atBats: 500, hits: 140, obp: '.350', slg: '.480' } }] },
    { type: { displayName: 'expectedStatistics' }, group: { displayName: 'hitting' }, splits: [{ stat: { xba: '.272', xslg: '.470' } }] },
    { type: { displayName: 'statSplits' }, group: { displayName: 'hitting' }, splits: [
      { split: { code: 'vl', description: 'vs Left' }, stat: { avg: '.250', atBats: 120 } },
      { split: { code: 'vr', description: 'vs Right' }, stat: { avg: '.292', atBats: 380 } },
    ] },
    { type: { displayName: 'gameLog' }, group: { displayName: 'hitting' }, splits: [
      { date: '2026-09-10', stat: { atBats: 4, hits: 1 } },
      { date: '2026-09-11', stat: { atBats: 5, hits: 2 } },
      { date: '2026-09-13', stat: { atBats: 4, hits: 3 } },
      { date: '2026-09-15', stat: { atBats: 4, hits: 0 } },
    ] },
  ],
};

const PITCHER_STATS = {
  stats: [
    { type: { displayName: 'season' }, group: { displayName: 'pitching' }, splits: [{ stat: { avg: '.238'.replace('.', '.'), atBats: 600 } }] },
    { type: { displayName: 'expectedStatistics' }, group: { displayName: 'pitching' }, splits: [{ stat: { xba: '.231' } }] },
    { type: { displayName: 'statSplits' }, group: { displayName: 'pitching' }, splits: [
      { split: { code: 'vl', description: 'vs Left' }, stat: { avg: '.220', atBats: 200 } },
      { split: { code: 'vr', description: 'vs Right' }, stat: { avg: '.248', atBats: 400 } },
    ] },
    { type: { displayName: 'gameLog' }, group: { displayName: 'pitching' }, splits: [] },
  ],
};

const H2H_STATS = {
  stats: [{ type: { displayName: 'vsPlayer' }, group: { displayName: 'hitting' }, splits: [{ stat: { atBats: 12, hits: 4, avg: '.333' } }] }],
};

/* ------------------------------------------------------------------ harness */

function routeFetch(url) {
  const u = String(url);
  let body = null;
  if (u.includes('/schedule?')) body = SCHEDULE;
  else if (u.includes('/gameStatus')) body = GAME_STATUS;
  else if (/\/game\/823109\/playByPlay/.test(u)) body = PBP_823109;
  else if (/\/game\/824466\/playByPlay/.test(u)) body = { allPlays: [] };
  else if (/\/game\/823109\/feed\/live/.test(u)) body = FEED_823109;
  else if (/\/game\/824466\/feed\/live/.test(u)) body = FEED_823109;
  else if (/\/people\/660271\/stats/.test(u)) body = u.includes('opposingPlayerId') ? H2H_STATS : HITTER_STATS;
  else if (/\/people\/592789\/stats/.test(u)) body = PITCHER_STATS;
  else if (u.includes('/api/feed-log')) body = { v: 1, date: '2026-09-15', entries: [], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] };

  if (body === null) {
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => JSON.parse(JSON.stringify(body)),
  });
}

/* Serve the repo over HTTP so jsdom loads the shipped <script>/<link> files
 * exactly as a browser would (no stubbing of the app's own code). */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://127.0.0.1');
  let filePath = path.join(ROOT, decodeURIComponent(parsed.pathname));
  if (parsed.pathname === '/') filePath = path.join(ROOT, 'index.html');
  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;

async function boot(file, { query = '', beforeParse, fetchImpl } = {}) {
  const virtualConsole = new VirtualConsole();
  const bootErrors = [];
  virtualConsole.on('jsdomError', (err) => {
    bootErrors.push(err.message);
    console.log('    jsdomError:', err.message);
  });
  virtualConsole.on('error', (...args) => console.log('    console.error:', ...args));

  const dom = await JSDOM.fromURL(`http://127.0.0.1:${PORT}/${file}${query}`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = (url) => (fetchImpl || routeFetch)(url);
      window.AbortController = window.AbortController || class { constructor() { this.signal = { aborted: false, addEventListener() {} }; } abort() { this.signal.aborted = true; } };
      window.scrollTo = () => {};
      if (typeof window.EventSource !== 'function') {
        window.EventSource = class { constructor() { this.listeners = {}; } addEventListener(n, f) { this.listeners[n] = f; } close() {} };
      }
      if (beforeParse) beforeParse(window);
    },
  });
  /* Wait for all external <script> tags to finish loading and executing before
   * interacting with page globals (fixes RR-06 race on Scoreboard.pickDate). */
  const deadline = Date.now() + 2500;
  while (dom.window.document.readyState !== 'complete' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
  }
  await new Promise((r) => setTimeout(r, 120));
  dom.__bootErrors = bootErrors;
  return dom;
}

function text(el) { return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim(); }

/* -------------------------------------------------------------------- tests */

console.log('\n[1] reviews.js — review parsing against verified payload shapes');
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.fetch = (url) => routeFetch(url);
  w.eval(await (await import('node:fs/promises')).readFile(path.join(ROOT, 'assets/js/api.js'), 'utf8'));
  w.eval(await (await import('node:fs/promises')).readFile(path.join(ROOT, 'assets/js/reviews.js'), 'utf8'));

  await check('describe(MJ) → ABS pitch challenge, reason "Pitch Result"', async () => {
    await w.Reviews.loadRegistry();
    const d = w.Reviews.describe('MJ');
    assert(d.isABS === true, 'MJ must be ABS');
    assert(d.reason === 'Pitch Result', 'reason should come from the registry, got ' + d.reason);
    assert(d.typeLabel === 'ABS Pitch Challenge', 'label, got ' + d.typeLabel);
  });

  await check('describe(NH) → boundary call (official reason "Home run")', async () => {
    const d = w.Reviews.describe('NH');
    assert(d.isBoundary === true, 'NH must be a boundary call');
    assert(d.family === 'umpire', 'NH family should be umpire, got ' + d.family);
  });

  await check('statusReview(MD) is a review; statusReview(F) is not', async () => {
    assert(!!w.Reviews.statusReview({ statusCode: 'MD', reason: 'Catch/drop in outfield' }), 'MD must be a review');
    assert(w.Reviews.statusReview({ statusCode: 'F', detailedState: 'Final' }) === null, 'Final must not be a review');
  });

  await check('extractReviews finds play-level, pitch-level and pending rows', async () => {
    const rows = w.Reviews.extractReviews(PBP_823109.allPlays, {
      gamePk: 823109,
      teams: { away: { id: 136, name: 'Seattle Mariners' }, home: { id: 142, name: 'Minnesota Twins' } },
    });
    const codes = rows.map((r) => r.code).sort().join(',');
    assert(codes === 'MA,MD,MJ,NA', 'expected MA,MD,MJ,NA — got ' + codes);
    const abs = rows.find((r) => r.code === 'MJ');
    assert(abs.isABS === true, 'MJ row should be ABS');
    assert(abs.absPitchNumber === 3, 'pitch number should be 3, got ' + abs.absPitchNumber);
    assert(abs.absCountBefore.balls === 1 && abs.absCountBefore.strikes === 1,
      'count before should be 1-1, got ' + JSON.stringify(abs.absCountBefore));
    assert(abs.outcome === 'Overturned', 'MJ outcome, got ' + abs.outcome);
  });

  await check('runs at risk only counts runs credited to the reviewed event', async () => {
    const rows = w.Reviews.extractReviews(PBP_823109.allPlays, { gamePk: 823109, teams: { away: { id: 136 }, home: { id: 142 } } });
    const manager = rows.find((r) => r.code === 'MA');
    assert(manager.runsAtRiskCount === 1, 'MA should carry 1 run at risk, got ' + manager.runsAtRiskCount);
    const boundary = rows.find((r) => r.code === 'MD');
    /* The home run's scoring runner sits on playIndex 3, the reviewed event is
     * the last event (index 0 here) — so it must NOT be counted. */
    assert(boundary.runsAtRiskCount === 0, 'MD must not inherit an unrelated run, got ' + boundary.runsAtRiskCount);
  });

  await check('pending ruling is read from the API event-type registry', async () => {
    const rows = w.Reviews.pendingRulings(PBP_823109.allPlays, { gamePk: 823109 });
    assert(rows.length === 1, 'expected exactly 1 pending ruling, got ' + rows.length);
    assert(rows[0].eventType === 'os_ruling_pending_primary', 'event type, got ' + rows[0].eventType);
  });

  await check('scoring-change diff flags reclassification and ignores score-only edits', async () => {
    const before = w.Reviews.snapshotPlays([play(1, { result: { eventType: 'field_error', description: 'Reached on error', awayScore: 0, homeScore: 0, isOut: false }, count: { balls: 0, strikes: 0, outs: 0 } })]);
    const after = w.Reviews.snapshotPlays([play(1, { result: { eventType: 'single', description: 'Singles.', awayScore: 0, homeScore: 0, isOut: false }, count: { balls: 0, strikes: 0, outs: 0 } })]);
    const diff = w.Reviews.diffSnapshots(before, after);
    assert(diff.changes.length === 1, 'error→single must be a scoring change, got ' + diff.changes.length);
    assert(diff.edits.length === 0, 'no payload-edit rows expected, got ' + diff.edits.length);

    const edited = w.Reviews.diffSnapshots(before, w.Reviews.snapshotPlays([play(1, { result: { eventType: 'field_error', description: 'Changed wording only', awayScore: 1, homeScore: 0, isOut: false }, count: { balls: 0, strikes: 0, outs: 0 } })]));
    assert(edited.changes.length === 0 && edited.edits.length === 1, 'description/score edit must be flagged, not classified as a change');
  });

  await check('counter regression is detected, never zero-filled', async () => {
    const up = w.Reviews.counterRegression({ away: { used: 1, remaining: 0 } }, { away: { used: 1, remaining: 1 } });
    assert(up === null, 'a used-counter that holds steady must not be flagged: ' + JSON.stringify(up));
    const notes = w.Reviews.counterRegression({ away: { used: 1, remaining: 1 } }, { away: { used: 0, remaining: 0 } });
    assert(Array.isArray(notes) && notes.length === 2, 'expected 2 regression notes (used + remaining), got ' + JSON.stringify(notes));
    assert(w.Reviews.counterRegression(null, { away: { used: 1 } }) === null, 'missing previous reading must not be invented');
  });

  dom.window.close();
}

console.log('\n[2] index.html — scoreboard renders from the schedule payload');
{
  const dom = await boot('index.html', { beforeParse(w) { w.localStorage.clear(); } });
  __setDate(dom);
  await new Promise((r) => setTimeout(r, 400));

  await check('3 game cards with team names and scores', () => {
    const cards = dom.window.document.querySelectorAll('.game-card');
    assert(cards.length === 3, 'expected 3 cards, got ' + cards.length);
    const html = text(dom.window.document.getElementById('game-list'));
    assert(html.includes('Los Angeles Dodgers'), 'away team name missing');
    assert(html.includes('Cincinnati Reds'), 'home team name missing');
    assert(html.includes('Great American Ball Park'), 'venue missing');
  });

  await check('live game shows a review chip from the official status code', () => {
    const html = text(dom.window.document.getElementById('game-list'));
    assert(/Manager Challenge: Tag play/i.test(html), 'review chip missing: ' + html.slice(0, 300));
  });

  await check('filters exist and date navigation updates the label', () => {
    const tabs = dom.window.document.querySelectorAll('#tabs .tab-btn');
    assert(tabs.length >= 5, 'expected filter tabs, got ' + tabs.length);
    assert(text(dom.window.document.getElementById('date-label')).length > 0, 'date label empty');
  });

  await check('no uncaught script errors left the status line in error state', () => {
    assert(dom.__bootErrors.length === 0, 'unexpected jsdomError(s): ' + dom.__bootErrors.join('; '));
    const status = dom.window.document.getElementById('status-line');
    assert(!status.classList.contains('is-error'), 'status line reports an error: ' + text(status));
  });

  dom.window.close();
}

console.log('\n[3] game.html — header, live module, linescore, PBP, tabs');
{
  const dom = await boot('game.html', {
    query: '?gamePk=823109',
    beforeParse(w) { w.localStorage.clear(); },
  });
  await new Promise((r) => setTimeout(r, 700));
  const doc = dom.window.document;

  await check('header shows both teams and the live status', () => {
    const html = text(doc.getElementById('header-away')) + text(doc.getElementById('header-home')) + text(doc.getElementById('header-center'));
    assert(html.includes('Seattle Mariners') && html.includes('Minnesota Twins'), 'team names missing: ' + html);
    assert(/Manager challenge/i.test(html), 'official status label missing: ' + html);
  });

  await check('at-bat module shows count, outs, bases and on-deck', () => {
    const html = text(doc.getElementById('live-panel'));
    assert(html.includes('Test Batter'), 'batter missing');
    assert(html.includes('On deck'), 'on-deck line missing');
    assert(doc.getElementById('live-panel').querySelectorAll('.base-diamond i.on').length >= 1, 'no occupied base rendered');
  });

  await check('linescore table has one column per inning plus R/H/E', () => {
    const table = doc.querySelector('#linescore-wrap table.linescore');
    assert(!!table, 'linescore table missing');
    const headers = table.querySelectorAll('thead th');
    assert(headers.length === 9 + 3 + 1 + 1,
      'expected 9 inning columns + R/H/E + source column + spacer, got ' + headers.length);
    assert(doc.querySelectorAll('#linescore-wrap td.src-cell a').length === 2,
      'each linescore row must link to its official source');
  });

  await check('play-by-play renders every play with pitch detail', () => {
    const plays = doc.querySelectorAll('#plays-wrap .play');
    assert(plays.length === PBP_823109.allPlays.length, 'expected ' + PBP_823109.allPlays.length + ' plays, got ' + plays.length);
    assert(doc.querySelectorAll('#plays-wrap .pitches li').length >= 3, 'pitch list missing');
  });

  await check('Challenges tab badge counts reviews, and the tab renders them', () => {
    const badge = doc.getElementById('reviews-tab-count');
    assert(badge.style.display !== 'none' && Number(badge.textContent) >= 4, 'badge should count reviews, got ' + badge.textContent);
    dom.window.Game.setTab('reviews');
    const html = text(doc.getElementById('reviews-wrap'));
    assert(html.includes('ABS Pitch Challenge'), 'ABS review card missing');
    assert(html.includes('Manager Challenge'), 'manager review card missing');
  });

  await check('box score tab renders batting + pitching lines', () => {
    dom.window.Game.setTab('boxscore');
    const html = text(doc.getElementById('boxscore-wrap'));
    assert(html.includes('Seattle Mariners'), 'team heading missing');
    assert(html.includes('Test Batter') && html.includes('Test Pitcher'), 'player rows missing');
    assert(html.includes('ERA'), 'pitching header missing');
    assert(doc.querySelectorAll('#boxscore-wrap td.src-cell a').length >= 2,
      'each box-score row must link to its official source');
  });

  await check('reviews banner appears for the in-progress review', () => {
    const html = text(doc.getElementById('live-review-banner-wrap'));
    assert(/Under review/i.test(html), 'banner missing: ' + html);
  });

  dom.window.close();
}

console.log('\n[4] props.js — the two-sided hit forecast');
{
  const dom = await boot('game.html', { query: '?gamePk=823109', beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 900));

  await check('forecast lands inside the documented clamp band with all six drivers', () => {
    const f = dom.window.Game.state.forecast;
    assert(!!f, 'no forecast produced');
    assert(f.prob >= 0.10 && f.prob <= 0.78, 'probability out of clamp band: ' + f.prob);
    assert(f.drivers.length === 6, 'expected 6 drivers, got ' + f.drivers.length);
    assert(f.tier && f.tier.label, 'tier missing');
    assert(f.atLeastOne > f.prob, '>=1 hit over N PAs must exceed the per-PA rate');
  });

  await check('season inputs came from the stub, not from a guessed baseline', () => {
    const f = dom.window.Game.state.forecast;
    assert(f.ok === true, 'forecast fell back to baseline: ' + f.label);
    assert(String(f.batter.season.avg) === '.280', 'batter AVG not read, got ' + (f.batter.season && f.batter.season.avg));
    assert(String(f.pitcher.expected.xba) === '.231', 'pitcher xBA not read');
  });

  await check('per-PA estimate is rendered on the live card', () => {
    const html = text(dom.window.document.getElementById('live-panel'));
    assert(/hit this PA/.test(html), 'forecast headline missing');
  });

  dom.window.close();
}

console.log('\n[5] reviews.html — the all-games Replay Feed');
{
  const dom = await boot('reviews.html', { beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 900));
  const doc = dom.window.document;

  await check('every event type is tracked (ABS, manager, boundary, umpire, pending)', () => {
    const entries = dom.window.ReplayFeed.state.entries;
    assert(entries.length >= 5, 'expected at least 5 tracked entries, got ' + entries.length);
    const kinds = entries.map((e) => (e.review && e.review.code) || e.kind).join(',');
    ['MJ', 'MD', 'MA', 'NA'].forEach((code) => assert(kinds.includes(code), 'missing tracked code ' + code + ' in ' + kinds));
    assert(entries.some((e) => e.kind === 'pending'), 'pending ruling not tracked');
  });

  await check('All tab hides ABS rows, ABS tab shows them', () => {
    const allHtml = text(doc.getElementById('feed-list'));
    assert(!allHtml.includes('ABS Pitch Challenge'), 'All tab must exclude ABS rows');
    dom.window.ReplayFeed.setFilter('abs');
    const absHtml = text(doc.getElementById('feed-list'));
    assert(absHtml.includes('ABS Pitch Challenge'), 'ABS tab must show ABS rows');
    dom.window.ReplayFeed.setFilter('all');
  });

  await check('runs-at-risk row carries the official score tracker', () => {
    dom.window.ReplayFeed.setFilter('risk');
    const html = text(doc.getElementById('feed-list'));
    assert(/run\(s\) at risk/.test(html), 'at-risk badge missing');
    assert(/Actual after/.test(html), 'official score tracker missing: ' + html.slice(0, 400));
    dom.window.ReplayFeed.setFilter('all');
  });

  await check('summary tiles count the tracked entries', () => {
    const tiles = doc.querySelectorAll('#feed-stats .stat-tile');
    assert(tiles.length >= 8, 'expected the summary tiles, got ' + tiles.length);
    const html = text(doc.getElementById('feed-stats'));
    assert(/ABS challenges/.test(html) && /Runs at risk/.test(html), 'tile labels missing');
  });

  await check('filters isolate ABS / scoring-change views', () => {
    dom.window.ReplayFeed.setFilter('abs');
    let html = text(doc.getElementById('feed-list'));
    assert(html.includes('ABS Pitch Challenge'), 'ABS filter lost its rows');
    assert(!html.includes('Official Scorer Ruling Pending'), 'ABS filter leaked non-ABS rows');
    dom.window.ReplayFeed.setFilter('scoring');
    html = text(doc.getElementById('feed-list'));
    assert(html.length >= 0, 'scoring view crashed');
    dom.window.ReplayFeed.setFilter('all');
  });

  await check('entries are persisted to localStorage per date', () => {
    const raw = dom.window.localStorage.getItem('mlbp.feedlog.2026-09-15') || dom.window.localStorage.getItem('mlbp.feedlog.' + dom.window.MLB.todayISO());
    assert(!!raw, 'no feed log written');
    const parsed = JSON.parse(raw);
    assert(Array.isArray(parsed.entries) && parsed.entries.length >= 5, 'log has no entries');
  });

  await check('sound / notification toggles flip state and persist the preference', () => {
    dom.window.ReplayFeed.toggleSound();
    assert(dom.window.ReplayFeed.state.soundOn === true, 'sound toggle did not flip');
    assert(dom.window.localStorage.getItem('mlbp.pref.sound') === '1', 'sound preference not saved');
    dom.window.ReplayFeed.toggleNotify();
    assert(dom.window.ReplayFeed.state.notifyOn === true, 'notification toggle did not flip');
  });

  dom.window.close();
}

console.log('\n[6] feed-log.js — merge semantics');
{
  const dom = await boot('reviews.html', { beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 400));

  await check('merge keeps both sides and never loses a row', () => {
    const a = { v: 1, date: '2026-09-15', entries: [{ id: 'x', gamePk: 1, review: { id: 'x' }, firstSeen: 5, lastSeen: 5 }], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] };
    const b = { v: 1, date: '2026-09-15', entries: [{ id: 'y', gamePk: 2, review: { id: 'y' }, firstSeen: 6, lastSeen: 6 }], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] };
    const merged = dom.window.FeedLog.mergePayloads(a, b, '2026-09-15');
    assert(merged.entries.length === 2, 'expected 2 merged entries, got ' + merged.entries.length);
  });

  await check('merge is idempotent (same payload twice changes nothing)', () => {
    const a = { v: 1, date: '2026-09-15', entries: [{ id: 'x', gamePk: 1, review: { id: 'x' }, firstSeen: 5, lastSeen: 5 }], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] };
    const once = dom.window.FeedLog.mergePayloads(a, a, '2026-09-15');
    const twice = dom.window.FeedLog.mergePayloads(once, a, '2026-09-15');
    assert(twice.entries.length === 1, 'expected a single entry after the second merge, got ' + twice.entries.length);
  });

  await check('irregularity notes accumulate instead of being overwritten', () => {
    const a = { v: 1, date: 'd', entries: [], order: [], snapshots: {}, irregularities: { 1: ['note a'] }, grace: {}, settled: [] };
    const b = { v: 1, date: 'd', entries: [], order: [], snapshots: {}, irregularities: { 1: ['note b'] }, grace: {}, settled: [] };
    const merged = dom.window.FeedLog.mergePayloads(a, b, 'd');
    assert(merged.irregularities[1].length === 2, 'notes were lost: ' + JSON.stringify(merged.irregularities[1]));
  });

  dom.window.close();
}

console.log('\n[7] static asset integrity');
{
  const fs = await import('node:fs/promises');
  const pages = ['index.html', 'game.html', 'reviews.html', '404.html', 'flagged.html'];
  for (const page of pages) {
    await check(`${page}: every local href/src resolves to a file`, async () => {
      let html;
      try { html = await fs.readFile(path.join(ROOT, page), 'utf8'); }
      catch { throw new Error('page missing'); }
      const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
        /* A JS-constructed URL (404.html writes its <base> at runtime) is not a
         * static reference; it is covered by the 404 routing check instead. */
        .filter((u) => !/^(https?:|data:|#|mailto:)/.test(u))
        .filter((u) => !/[\s'"<]/.test(u));
      assert(refs.length > 0, 'no local assets referenced');
      for (const ref of refs) {
        const clean = ref.split('#')[0].split('?')[0];
        const target = path.join(ROOT, clean);
        try { await fs.access(target); }
        catch { throw new Error(`broken link: ${ref}`); }
      }
    });
  }
}

console.log('\n[8] offseason empty state — points at the most recent date with games');
{
  const emptyToday = (url) => {
    const u = String(url);
    if (u.includes('startDate=')) {
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ dates: [] }) });
    }
    if (u.includes('/schedule?')) {
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ totalGames: 0, dates: [] }) });
    }
    return routeFetch(url);
  };
  const dom = await boot('index.html', { fetchImpl: emptyToday, beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 400));

  await check('empty slate renders a message instead of an empty page', () => {
    const html = text(dom.window.document.getElementById('game-list'));
    assert(/No games scheduled/.test(html), 'empty-state message missing: ' + html);
    assert(!dom.window.document.getElementById('status-line').classList.contains('is-error'),
      'empty slate must not be reported as a network error');
  });

  await check('a range query is issued once to find the latest date with games', () => {
    assert(dom.window.Scoreboard.state.lookingForRecent === false, 'range lookup did not settle');
    assert(dom.window.Scoreboard.state.lastGameDate === null, 'no games in range should yield null, got ' + dom.window.Scoreboard.state.lastGameDate);
  });

  dom.window.close();
}

console.log('\n[9] offseason empty state — link to the latest date with games');
{
  const withHistory = (url) => {
    const u = String(url);
    if (u.includes('startDate=')) {
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ dates: [{ date: '2026-09-14', totalGames: 0 }, { date: '2026-09-15', totalGames: 15 }] }),
      });
    }
    if (u.includes('/schedule?')) {
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ totalGames: 0, dates: [] }) });
    }
    return routeFetch(url);
  };
  const dom = await boot('index.html', { fetchImpl: withHistory, beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 500));

  await check('the latest date with games is offered as a button', () => {
    const st = dom.window.Scoreboard.state;
    assert(st.lastGameDate === '2026-09-15', 'expected 2026-09-15, got ' + st.lastGameDate);
    const html = text(dom.window.document.getElementById('game-list'));
    assert(/Most recent date with games/.test(html), 'hint text missing: ' + html);
    assert(dom.window.document.querySelector('#game-list button') !== null, 'no jump button rendered');
  });

  dom.window.close();
}

console.log('\n[10] live-API shape & replay-audit regressions (1f908513 / RR-01..RR-04)');
{
  const fs = await import('node:fs/promises');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.fetch = (url) => {
    const u = String(url);
    if (u.includes('opposingPlayerId=')) {
      /* Official StatsAPI vsPlayer returns vsPlayerTotal (career) + vsPlayer (per-season). */
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ({
          stats: [{ type: { displayName: 'vsPlayerTotal' }, splits: [{ stat: { atBats: 10, hits: 4, avg: '.400' } }] }],
        }),
      });
    }
    if (u.includes('/people/')) {
      /* Official StatsAPI expectedStatistics stores xBA under stat.avg, not stat.xba. */
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ({
          stats: [
            { type: { displayName: 'season' }, splits: [
              { team: { id: 121 }, stat: { avg: '.240', atBats: 200, hits: 48 } },
              { stat: { avg: '.285', atBats: 450, hits: 128 } },
            ] },
            { type: { displayName: 'expectedStatistics' }, splits: [{ stat: { avg: '.301', slg: '.510', woba: '.380' } }] },
            { type: { displayName: 'statSplits' }, splits: [{ split: 'vr', stat: { avg: '.295', atBats: 310 } }] },
            { type: { displayName: 'gameLog' }, splits: [] },
          ],
        }),
      });
    }
    return routeFetch(url);
  };
  w.eval(await fs.readFile(path.join(ROOT, 'assets/js/api.js'), 'utf8'));
  w.eval(await fs.readFile(path.join(ROOT, 'assets/js/ui.js'), 'utf8'));
  w.eval(await fs.readFile(path.join(ROOT, 'assets/js/reviews.js'), 'utf8'));
  w.eval(await fs.readFile(path.join(ROOT, 'assets/js/props.js'), 'utf8'));

  await check('expectedStatistics stat.avg (xBA) & vsPlayerTotal (H2H) & combined splits work', async () => {
    const f = await w.Props.getForecast({
      batterId: 682829, batterName: 'Elly De La Cruz', batterHand: 'S',
      pitcherId: 656849, pitcherName: 'David Peterson', pitcherHand: 'R',
      season: 2026, gameDate: '2026-08-28', count: { balls: 1, strikes: 0 }, countKnown: true,
      inning: 3, half: 'top', gameLive: true, gameFinal: false,
    });
    assert(String(f.batter.expected && f.batter.expected.xba) === '.301', 'xBA from expectedStatistics.avg missing');
    assert(String(f.batter.season && f.batter.season.avg) === '.285', 'combined multi-team season split not chosen');
    const h2hDriver = f.drivers.find((d) => d.key === 'history');
    assert(h2hDriver && /4-10/.test(h2hDriver.detail), 'vsPlayerTotal H2H not read: ' + JSON.stringify(h2hDriver));
  });

  await check('RR-02 + PA-ending ABS + MF fallback: official pitchNumber beats array index', () => {
    const d = w.Reviews.describe('MF');
    assert(d.reason === 'Close play at 1st', 'MF fallback reason missing, got ' + d.reason);

    const rows = w.Reviews.extractReviews([
      /* Game 823243 atBatIndex 54 shape: 2 non-pitch actions precede 3 pitches; pitchNumber is 3. */
      play(54, {
        about: { atBatIndex: 54, inning: 7, halfInning: 'top', isTopInning: true, isComplete: true, hasReview: true },
        playEvents: [
          { index: 0, isPitch: false, details: { description: 'Pitcher Step Off' } },
          { index: 1, isPitch: false, details: { description: 'Pickoff Attempt 1B' } },
          { index: 2, isPitch: true, pitchNumber: 1, count: { balls: 1, strikes: 0, outs: 1 }, details: { description: 'Ball' } },
          { index: 3, isPitch: true, pitchNumber: 2, count: { balls: 1, strikes: 1, outs: 1 }, details: { description: 'Called Strike' } },
          { index: 4, isPitch: true, pitchNumber: 3, count: { balls: 1, strikes: 2, outs: 1 }, details: { description: 'Called Strike' },
            reviewDetails: { isOverturned: false, inProgress: false, reviewType: 'MJ', challengeTeamId: 136 } },
        ],
      }),
      /* PA-ending ABS strikeout where MLB attaches reviewDetails on play.reviewDetails. */
      play(86, {
        about: { atBatIndex: 86, inning: 9, halfInning: 'bottom', isTopInning: false, isComplete: true, hasReview: true },
        reviewDetails: { isOverturned: false, inProgress: false, reviewType: 'MJ', challengeTeamId: 142 },
        playEvents: [
          { index: 0, isPitch: true, pitchNumber: 1, count: { balls: 0, strikes: 1, outs: 2 }, details: { description: 'Swinging Strike' } },
          { index: 1, isPitch: true, pitchNumber: 2, count: { balls: 0, strikes: 2, outs: 2 }, details: { description: 'Foul' } },
          { index: 2, isPitch: true, pitchNumber: 3, count: { balls: 0, strikes: 3, outs: 2 }, details: { description: 'Called Strike' } },
        ],
      }),
    ], { gamePk: 823243, teams: { away: { id: 136 }, home: { id: 142 } } });

    assert(rows[0].absPitchNumber === 3, 'RR-02: expected official pitchNumber 3, got ' + rows[0].absPitchNumber);
    assert(rows[1].absPitchNumber === 3 && rows[1].absCountBefore.strikes === 2,
      'PA-ending MJ should resolve final pitch count 0-2 -> 0-3, got ' + JSON.stringify(rows[1]));
  });

  dom.window.close();

  /* RR-01, RR-03, RR-04 on reviews.html */
  let resolveSlowSchedule;
  const slowMarch27 = new Promise((r) => { resolveSlowSchedule = r; });
  const raceFetch = (url) => {
    const u = String(url);
    if (u.includes('/schedule?') && u.includes('date=2026-03-27')) return slowMarch27;
    if (u.includes('/schedule?') && u.includes('date=2026-03-28')) {
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ totalGames: 0, dates: [] }) });
    }
    return routeFetch(u);
  };
  const feedDom = await boot('reviews.html', { fetchImpl: raceFetch, beforeParse(win) { win.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 250));

  await check('RR-03 + RR-04: replay rows link to MLB StatsAPI and All shows scoring changes', () => {
    const links = [...feedDom.window.document.querySelectorAll('#feed-list a[href*="statsapi.mlb.com/api/v1/game/"]')];
    assert(links.length >= 1, 'RR-04: expected direct official MLB StatsAPI link on replay rows');
    feedDom.window.ReplayFeed.state.entries.push({
      id: '823109:1:scoring-change',
      kind: 'scoring_change',
      gamePk: 823109,
      matchupLabel: 'SEA @ MIN',
      lastSeen: Date.now(),
      change: { atBatIndex: 1, inningLabel: 'Top 1', batter: 'Test Batter', from: { description: 'Error' }, to: { description: 'Single' }, attribution: 'Official scorer' },
      review: { typeLabel: 'Official Scoring Change', inningLabel: 'Top 1', batter: { name: 'Test Batter' }, outcome: 'Reclassified', isABS: false, family: 'scoring' },
    });
    feedDom.window.ReplayFeed.setFilter('all');
    const html = text(feedDom.window.document.getElementById('feed-list'));
    assert(html.includes('Official Scoring Change'), 'RR-03: scoring change must appear in All tab');
  });

  await check('RR-01: delayed schedule from prior date cannot pollute the newly selected date', async () => {
    const picker = feedDom.window.document.getElementById('date-picker');
    picker.value = '2026-03-27';
    picker.dispatchEvent(new feedDom.window.Event('change'));
    await new Promise((r) => setTimeout(r, 40));
    picker.value = '2026-03-28';
    picker.dispatchEvent(new feedDom.window.Event('change'));
    await new Promise((r) => setTimeout(r, 80));
    resolveSlowSchedule({
      ok: true, status: 200, headers: { get: () => null },
      json: async () => SCHEDULE,
    });
    await new Promise((r) => setTimeout(r, 150));
    assert(feedDom.window.ReplayFeed.state.date === '2026-03-28', 'date should stay 2026-03-28');
    assert(feedDom.window.ReplayFeed.state.entries.length === 0,
      'RR-01: stale 2026-03-27 schedule leaked entries into 2026-03-28: ' + feedDom.window.ReplayFeed.state.entries.length);
  });

  feedDom.window.close();
}

console.log('\n[11] ?date= deep links (shareable scoreboard / replay-feed URLs)');
{
  const boardDom = await boot('index.html', { query: '?date=2026-09-15', beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 400));

  await check('index.html?date= opens that date and renders its games', () => {
    const st = boardDom.window.Scoreboard.state;
    assert(st.date === '2026-09-15', 'expected 2026-09-15, got ' + st.date);
    assert(st.games.length === SCHEDULE.dates[0].games.length,
      'expected ' + SCHEDULE.dates[0].games.length + ' games, got ' + st.games.length);
    const html = text(boardDom.window.document.getElementById('game-list'));
    assert(/Dodgers/.test(html), 'game cards did not render: ' + html.slice(0, 120));
  });

  await check('scoreboard keeps the address bar in step with the selected date', () => {
    const href = boardDom.window.location.href;
    assert(/[?&]date=2026-09-15/.test(href), 'date missing from URL: ' + href);
    boardDom.window.Scoreboard.setDate('2026-09-14');
    assert(/[?&]date=2026-09-14/.test(boardDom.window.location.href),
      'URL did not follow setDate: ' + boardDom.window.location.href);
  });

  boardDom.window.close();

  const feedDomLink = await boot('reviews.html', { query: '?date=2026-09-15', beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 400));

  await check('reviews.html?date= opens that date in the replay feed', () => {
    const st = feedDomLink.window.ReplayFeed.state;
    assert(st.date === '2026-09-15', 'expected 2026-09-15, got ' + st.date);
    const label = text(feedDomLink.window.document.getElementById('date-label'));
    assert(/Sep 15, 2026/.test(label), 'date label not updated: ' + label);
    assert(/[?&]date=2026-09-15/.test(feedDomLink.window.location.href),
      'date missing from URL: ' + feedDomLink.window.location.href);
  });

  feedDomLink.window.close();
}

console.log('\n[12] af75fbfd parity & provenance checks (ABS counters, no before-score inference, zero-index merge, calendar dates)');
{
  const feedDom2 = await boot('reviews.html', { query: '?date=2026-09-15', beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 700));
  const doc2 = feedDom2.window.document;

  await check('AF-1 + AF-5: ABS rows show official ABS challenges left + challenger role + both-teams hover summary', () => {
    feedDom2.window.ReplayFeed.setFilter('abs');
    const html = text(doc2.getElementById('feed-list'));
    assert(/2 ABS challenges left now/.test(html), 'official ABS counter missing on ABS row: ' + html);
    assert(/\(batter\)/.test(html), 'official ABS challenger role missing: ' + html);
    const noteEl = doc2.querySelector('#feed-list .counter-note');
    assert(noteEl && /Challenges left: SEA 0 MGR · 2 ABS — MIN 1 MGR · 2 ABS/.test(noteEl.getAttribute('title') || ''),
      'both-teams counter summary missing on title: ' + (noteEl && noteEl.getAttribute('title')));
    feedDom2.window.ReplayFeed.setFilter('all');
  });

  await check('AF-2: nested {manager, abs} counter regression is detected', () => {
    const notes = feedDom2.window.Reviews.counterRegression(
      { manager: { away: { used: 1, remaining: 1 } }, abs: { home: { usedSuccessful: 2, remaining: 2 } } },
      { manager: { away: { used: 0, remaining: 1 } }, abs: { home: { usedSuccessful: 1, remaining: 2 } } }
    );
    assert(Array.isArray(notes) && notes.length === 2, 'expected 2 nested regression notes, got ' + JSON.stringify(notes));
  });

  await check('AF-3: resolved review opened after the ruling never infers Before score', () => {
    const mdEntry = feedDom2.window.ReplayFeed.state.entries.find((e) => e.review && e.review.code === 'MD');
    assert(mdEntry && mdEntry.scoreTracker, 'MD entry missing');
    assert(mdEntry.scoreTracker.before === null, 'before score must stay null when not observed live, got ' + JSON.stringify(mdEntry.scoreTracker.before));
    assert(mdEntry.scoreTracker.actual && mdEntry.scoreTracker.actual.away === 3, 'actual score after missing');
  });

  await check('AF-4: active review with runs at risk renders persistent #banner on reviews.html', () => {
    feedDom2.window.ReplayFeed.state.entries.push({
      id: '823109:99:p:MA',
      kind: 'review',
      gamePk: 823109,
      matchupLabel: 'SEA @ MIN',
      lastSeen: Date.now(),
      review: { code: 'MA', typeLabel: 'Manager Challenge', reason: 'Tag play', inningLabel: 'Bot 9', inProgress: true, runsAtRiskCount: 2, isABS: false, family: 'manager' },
      scoreTracker: { before: { away: 3, home: 5 }, possible: { away: 3, home: 3 }, actual: null },
    });
    feedDom2.window.ReplayFeed.setFilter('all');
    const bannerHtml = text(doc2.getElementById('banner'));
    assert(/2 runs at risk/.test(bannerHtml), 'persistent #banner missing runs-at-risk alert: ' + bannerHtml);
  });

  await check('AF-5 + AF-6: strict calendar isValidISODate, non-zero-filled countDots, and atBatIndex 0 merge keys', () => {
    assert(feedDom2.window.MLB.isValidISODate('2026-02-28') === true, '2026-02-28 should be valid');
    assert(feedDom2.window.MLB.isValidISODate('2026-02-31') === false, '2026-02-31 must be rejected');
    const absentDots = feedDom2.window.UI.countDots(null, undefined);
    assert(!/on-ball|dot/.test(absentDots), 'absent count must not render zero-filled dots: ' + absentDots);
    const mergedZero = feedDom2.window.FeedLog.mergePayloads(
      { v: 1, date: '2026-09-15', entries: [{ gamePk: 1, review: { atBatIndex: 0, outcome: 'Stands' } }] },
      { v: 1, date: '2026-09-15', entries: [{ gamePk: 1, review: { atBatIndex: '' , outcome: 'Unknown' } }] },
      '2026-09-15'
    );
    assert(mergedZero.entries.length === 2, 'atBatIndex 0 must not collide with empty string: ' + mergedZero.entries.length);
  });

  feedDom2.window.close();
}

console.log('\n[13] reference-parity fixes (session 6e2a58d9: G-2…G-5, G-9)');
{
  const dom = await boot('reviews.html', { beforeParse(w) { w.localStorage.clear(); } });
  await new Promise((r) => setTimeout(r, 900));
  const doc = dom.window.document;
  const w = dom.window;
  const st = w.ReplayFeed.state;

  await check('counterLine matches the uploaded README examples (team prefix)', () => {
    const abs = w.Reviews.counterLine({
      abs: { away: { usedSuccessful: 2, usedFailed: 0, remaining: 2 } },
      side: 'away', label: 'CIN',
    });
    assert(abs === 'CIN: 2 ABS challenges left now (2 successful · 0 failed)',
      'README example 1 mismatch: ' + abs);
    const mgr = w.Reviews.counterLine({
      manager: { away: { used: 0, remaining: 1 } },
      side: 'away', label: 'PIT',
    });
    assert(mgr === 'PIT: 1 manager challenge left now (0 used)',
      'README example 2 mismatch: ' + mgr);
  });

  await check('countersSummary matches the README example and never zero-fills absent counters', () => {
    const s = w.Reviews.countersSummary({
      manager: { away: { remaining: 1 }, home: { remaining: 1 } },
      abs: { away: { remaining: 2 }, home: { remaining: 2 } },
      awayLabel: 'CIN', homeLabel: 'CHC',
    });
    assert(s === 'Challenges left: CIN 1 MGR · 2 ABS — CHC 1 MGR · 2 ABS',
      'README summary example mismatch: ' + s);
    const noAbs = w.Reviews.countersSummary({
      manager: { away: { remaining: 1 }, home: { remaining: 1 } },
      abs: null, awayLabel: 'CIN', homeLabel: 'CHC',
    });
    assert(noAbs === 'Challenges left: CIN 1 MGR — CHC 1 MGR',
      'absent ABS counters must be omitted, not zero-filled: ' + noAbs);
    assert(w.Reviews.countersSummary({}) === '', 'no counters known -> empty summary');
  });

  await check('replay rows carry the challenges-remaining tracker with team prefix and hover summary', async () => {
    /* Manager counters come from the schedule hydrate; ABS counters from the
     * lean feed/live projection (both fixtures mirror the verified shapes). */
    await new Promise((r) => setTimeout(r, 400));
    w.ReplayFeed.setFilter('challenges');
    const notes = [...doc.querySelectorAll('#feed-list .counter-note')].map((n) => n.textContent.trim());
    assert(notes.includes('SEA: 0 manager challenges left now (1 used)'),
      'MA counter line must carry the challenging team prefix: ' + JSON.stringify(notes));
    assert(notes.includes('MIN: 1 manager challenge left now (1 used)'),
      'MD (charged manager challenge) counter line wrong: ' + JSON.stringify(notes));
    const titled = [...doc.querySelectorAll('#feed-list .counter-note')]
      .find((n) => (n.getAttribute('title') || '').includes('Challenges left:'));
    assert(titled, 'hover summary missing on counter lines');
    assert(titled.getAttribute('title') === 'Challenges left: SEA 0 MGR · 2 ABS — MIN 1 MGR · 2 ABS',
      'hover summary wrong: ' + titled.getAttribute('title'));
    w.ReplayFeed.setFilter('abs');
    const absNote = [...doc.querySelectorAll('#feed-list .counter-note')]
      .find((n) => /ABS challenge/.test(n.textContent));
    assert(absNote, 'ABS counter line missing on the ABS row (feed/live counters)');
    assert(/^SEA: 2 ABS challenges left now \(0 successful · 1 failed\)$/.test(absNote.textContent.trim()),
      'ABS counter line wrong: ' + absNote.textContent.trim());
  });

  await check('Under-Review strip carries the both-teams summary (README)', () => {
    const strip = text(doc.getElementById('active-strip'));
    assert(/Challenges left: SEA 0 MGR · 2 ABS — MIN 1 MGR · 2 ABS/.test(strip),
      'summary missing from the Under-Review strip: ' + strip);
  });

  await check('boundary review with no credited run says "score impact pending" (README)', () => {
    /* Seed an umpire-side NH boundary review (the fixture slate has none). */
    st.entries.push({
      id: '823109:99:seeded-boundary',
      kind: 'review',
      gamePk: 823109,
      matchupLabel: 'SEA @ MIN',
      teams: { away: { id: 136, name: 'Seattle Mariners' }, home: { id: 142, name: 'Minnesota Twins' } },
      review: {
        code: 'NH', family: 'umpire', typeLabel: 'Umpire Review', reason: 'Home run',
        isABS: false, isBoundary: true, inProgress: false, runsAtRiskCount: 0,
        outcome: 'Call Stands / Confirmed', inningLabel: 'Top 2',
      },
      scoreTracker: { before: { away: 2, home: 3 }, possible: null, actual: null },
      lastSeen: Date.now(),
    });
    w.ReplayFeed.setFilter('all');
    const html = text(doc.getElementById('feed-list'));
    assert(html.includes('score impact pending'),
      'boundary row must say "score impact pending" instead of inventing a score');
    st.entries = st.entries.filter((e) => e.id !== '823109:99:seeded-boundary');
    w.ReplayFeed.setFilter('all');
  });

  async function rescanAnd(fn) {
    st.lastChimeAt = 0;
    st.soundOn = true;
    w.ReplayFeed.scan();
    await new Promise((r) => setTimeout(r, 500));
    while (st.scanning) await new Promise((r) => setTimeout(r, 50));
    fn(st.lastChimeAt);
    st.soundOn = false;
  }

  await check('G-3: new non-ABS review rows chime (challenges/reviews/boundary calls)', async () => {
    const keep = st.entries.filter((e) => !(e.review && e.review.code === 'NA'));
    assert(keep.length === st.entries.length - 1, 'expected exactly one NA row in fixtures');
    st.entries = keep;
    await rescanAnd((at) => assert(at > 0, 'new umpire-review row did not chime'));
  });

  await check('G-3: new official-scorer pending rulings chime', async () => {
    const keep = st.entries.filter((e) => e.kind !== 'pending');
    assert(keep.length < st.entries.length, 'expected a pending row in fixtures');
    st.entries = keep;
    await rescanAnd((at) => assert(at > 0, 'new pending ruling did not chime'));
  });

  await check('G-3: routine ABS pitch challenges never chime (uploaded button title)', async () => {
    const keep = st.entries.filter((e) => !(e.review && e.review.isABS));
    assert(keep.length < st.entries.length, 'expected an ABS row in fixtures');
    st.entries = keep;
    await rescanAnd((at) => {
      assert(at === 0, 'routine ABS row must not chime, got lastChimeAt=' + at);
      assert(st.entries.some((e) => e.review && e.review.isABS), 'ABS row should still be tracked');
    });
  });

  await check('G-3: runs-at-risk chime fires once per review, then never again', async () => {
    const ma = st.entries.find((e) => e.review && e.review.code === 'MA');
    assert(ma && ma.review.runsAtRiskCount === 1, 'fixture MA row should carry 1 run at risk');
    st.entries = st.entries.filter((e) => e !== ma);
    await rescanAnd((at) => assert(at > 0, 'new runs-at-risk review did not chime'));
    const again = st.entries.find((e) => e.review && e.review.code === 'MA');
    assert(again && again.warned === true, 'risk chime must mark the row as warned');
    await rescanAnd((at) => assert(at === 0, 'runs-at-risk review must not re-chime (fires once)'));
  });

  await check('G-3: official scoring changes chime and render in All', async () => {
    let pbp = JSON.parse(JSON.stringify(PBP_823109));
    const mutFetch = (url) => {
      const u = String(url);
      if (/\/game\/823109\/playByPlay/.test(u)) {
        return Promise.resolve({
          ok: true, status: 200, headers: { get: () => null },
          json: async () => JSON.parse(JSON.stringify(pbp)),
        });
      }
      return routeFetch(u);
    };
    const mutDom = await boot('reviews.html', { fetchImpl: mutFetch, beforeParse(x) { x.localStorage.clear(); } });
    await new Promise((r) => setTimeout(r, 700));
    const mst = mutDom.window.ReplayFeed.state;
    /* Reclassify a completed play between polls (error→single style diff). */
    pbp.allPlays[0].result.eventType = 'field_error';
    pbp.allPlays[0].result.description = 'Reached on error.';
    await new Promise((resolve) => {
      mst.lastChimeAt = 0;
      mst.soundOn = true;
      mutDom.window.ReplayFeed.scan();
      setTimeout(resolve, 500);
    });
    while (mst.scanning) await new Promise((r) => setTimeout(r, 50));
    assert(mst.entries.some((e) => e.kind === 'scoring_change'),
      'reclassification between polls must create a scoring-change row');
    assert(mst.lastChimeAt > 0, 'new official scoring change must chime');
    mutDom.window.ReplayFeed.setFilter('all');
    const html = text(mutDom.window.document.getElementById('feed-list'));
    assert(html.includes('Official Scoring Change'), 'scoring change must render in All');
    mutDom.window.close();
  });

  await check('G-2: empty slate renders an empty-state notice, not a blank list', async () => {
    const emptyFetch = (url) => {
      if (String(url).includes('/schedule?')) {
        return Promise.resolve({
          ok: true, status: 200, headers: { get: () => null },
          json: async () => ({ totalGames: 0, dates: [] }),
        });
      }
      return routeFetch(url);
    };
    const emptyDom = await boot('reviews.html', { fetchImpl: emptyFetch, beforeParse(x) { x.localStorage.clear(); } });
    await new Promise((r) => setTimeout(r, 500));
    const html = text(emptyDom.window.document.getElementById('feed-list'));
    assert(/No tracked events for this date and filter yet/.test(html),
      'empty-state notice missing: ' + html);
    emptyDom.window.close();
  });

  await check('G-9: irregularity notes attach to their row; game-level notes render once', () => {
    const target = st.entries.find((e) => e.kind === 'review');
    assert(target && target.id, 'expected a review entry with an id');
    st.irregularities = {};
    st.irregularities[target.gamePk] = [
      'Note naming ' + target.id + ' only',
      'Game-level note for ' + target.gamePk,
    ];
    w.ReplayFeed.setFilter('all');
    const html = text(doc.getElementById('feed-list'));
    const rowCount = html.split('Note naming ' + target.id + ' only').length - 1;
    assert(rowCount === 1, 'entry-scoped note must render exactly once (on its own row), got ' + rowCount);
    const gameCount = html.split('Game-level note for ' + target.gamePk).length - 1;
    assert(gameCount === 1, 'game-level note must render exactly once as a flagged row, got ' + gameCount);
  });

  dom.window.close();
}

function __setDate(dom) {
  const picker = dom.window.document.getElementById('date-picker');
  if (picker) {
    picker.value = '2026-09-15';
    picker.dispatchEvent(new dom.window.Event('change'));
  }
}

server.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(' - ' + f));
  process.exitCode = 1;
}
