import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname, '..');
export const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures/official-824638.json'), 'utf8'));
export function context(overrides = {}) {
  const storage = new Map();
  const globals = { console, URL, URLSearchParams, AbortController, AbortSignal, Response, Headers,
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Intl,
    location: { href: 'https://example.test/LIVPBP/index.html?date=2026-08-28', search: '?date=2026-08-28', protocol: 'https:', pathname: '/LIVPBP/index.html' },
    document: { baseURI: 'https://example.test/LIVPBP/index.html', hidden: false, getElementById: () => null, addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key), key: index => [...storage.keys()][index] ?? null, get length() { return storage.size; } },
    addEventListener() {}, fetch: async () => { throw new Error('Network disabled in unit tests'); }, ...overrides };
  globals.window = globals;
  const ctx = vm.createContext(globals);
  for (const file of ['api.js', 'ui.js', 'reviews.js', 'feed-log.js', 'props.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), ctx, { filename: file });
  ctx.Reviews.setRegistry(fixture.registry);
  return ctx;
}
// Synthetic state transitions exercise edge cases. These are NOT official baseball observations.
export function synthetic() {
  const feed = structuredClone(fixture.feed);
  feed.gameData.status = { abstractGameState: 'Live', detailedState: 'Manager challenge: Tag play', statusCode: 'MA', reason: 'Tag play' };
  feed.liveData.plays.currentPlay = undefined;
  feed.liveData.plays.allPlays = [{ atBatIndex: 0, about: { atBatIndex: 0, inning: 1, halfInning: 'top', isComplete: true },
    result: { event: 'Single', eventType: 'single', isOut: false, awayScore: 1, homeScore: 0, description: 'Synthetic test play' },
    playEvents: [{ index: 0, details: { description: 'Synthetic review event', awayScore: 1, homeScore: 0 },
      reviewDetails: { reviewType: 'MA', challengeTeamId: 113, inProgress: true } }],
    runners: [{ details: { isScoringEvent: true, playIndex: 0, runner: { id: 1 } } }] }];
  feed.liveData.linescore.teams.away.runs = 1;
  feed.liveData.linescore.teams.home.runs = 0;
  return feed;
}
