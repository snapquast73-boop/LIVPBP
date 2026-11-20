/* Real official-network verification. No fixtures, skipped checks or guessed fallback results. */
import assert from 'node:assert/strict';
import { context } from './test-context.mjs';
import { harness, sourceRows, noOverflow } from './browser-harness.mjs';
const { MLB, Reviews } = context({ fetch });
const sources = [];
async function checked(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json', Origin: 'https://snapquast73-boop.github.io' } });
  assert.equal(response.status, 200, url);
  const cors = response.headers.get('access-control-allow-origin');
  assert.ok(cors === '*' || cors === 'https://snapquast73-boop.github.io', `Browser CORS not permitted: ${url}`);
  sources.push({ url, status: response.status }); return response.json();
}
const registry = await checked(MLB.url('/api/v1/gameStatus')); Reviews.setRegistry(registry);
assert.ok(registry.some(row => row.statusCode === 'MJ' && row.reason === 'Pitch Result'));
assert.ok(registry.some(row => row.statusCode === 'IH' && row.detailedState === 'Instant Replay'));
const events = await checked(MLB.url('/api/v1/eventTypes'));
for (const code of ['os_ruling_pending_primary', 'os_ruling_pending_prior']) assert.ok(events.some(event => event.code === code && event.description === 'Official Scorer Ruling Pending'));
const schedule = await checked(MLB.scheduleURL('2026-08-28'));
const game = schedule.dates.flatMap(day => day.games).find(game => game.gamePk === 824638);
assert.ok(game); assert.equal(game.teams.away.score, 10); assert.equal(game.teams.home.score, 8);
const full = await checked(MLB.gameURL(824638));
const lean = await checked(MLB.url('/api/v1.1/game/824638/feed/live', { fields: MLB.REPLAY_FIELDS }));
assert.equal(full.liveData.linescore.teams.away.runs, game.teams.away.score);
assert.equal(full.liveData.linescore.teams.home.runs, game.teams.home.score);
const fullReviews = JSON.parse(JSON.stringify(Reviews.extract(full, 824638)));
const leanReviews = JSON.parse(JSON.stringify(Reviews.extract(lean, 824638)));
assert.ok(fullReviews.length >= 9, 'Previously checked official archived review records disappeared; review the source');
assert.deepEqual(leanReviews, fullReviews, 'Projection omitted review data consumed by the parser');
for (const row of fullReviews.filter(row => row.typeKey === 'abs')) assert.ok(row.counter && typeof row.counter.remaining === 'number');
await checked(MLB.scheduleURL('2026-11-20'));
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), officialSources: sources, reviewRecords: fullReviews.length }, null, 2));
// Exercise the actual static browser with live API CORS, not route-intercepted scores.
const app = await harness();
try {
  const ctx = await app.browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${app.base}index.html?date=2026-08-28`);
  await page.waitForSelector('.game-card[data-game-pk="824638"]', { timeout: 45000 });
  assert.deepEqual(await page.locator('.game-card[data-game-pk="824638"] .team-score').allTextContents(), ['10', '8']);
  await page.goto(`${app.base}game.html?gamePk=824638&date=2026-08-28`);
  await page.waitForSelector('#header-away .team-score', { timeout: 45000 });
  assert.equal(await page.locator('#header-away .team-score').innerText(), '10');
  await page.getByRole('tab', { name: 'Box Score' }).click(); await sourceRows(page);
  await page.getByRole('tab', { name: /Challenges & Reviews/ }).click();
  assert.ok(await page.locator('#reviews-wrap .feed-row').count() >= 9);
  await sourceRows(page); await noOverflow(page); assert.deepEqual(errors, []);
  await ctx.close(); console.log('Real browser/official MLB CORS smoke passed (no fixtures).');
} finally { await app.close(); }
