import test from 'node:test';
import assert from 'node:assert/strict';
import { context, fixture, synthetic } from './test-context.mjs';

const date = '2026-08-28', pk = 824638;
test('calendar dates, identifiers and official-only URLs are validated', () => {
  const { MLB } = context();
  assert.equal(MLB.validDate('2026-02-29'), false);
  assert.equal(MLB.validDate('2024-02-29'), true);
  assert.equal(MLB.validDate('2026-13-01'), false);
  assert.equal(MLB.validDate('2026-08-28'), true);
  for (const bad of [null, '', -1, 0, '1&x=2', '../1', '3.5', Infinity]) assert.throws(() => MLB.id(bad));
  assert.equal(MLB.id('0824638'), String(pk));
  assert.throws(() => MLB.url('https://example.com/'));
  assert.throws(() => MLB.statsURL(1, 'unknown', 2026));
  assert.match(MLB.scheduleURL(date), /^https:\/\/statsapi\.mlb\.com\//);
});
test('missing official values stay blank and explicit zero survives', () => {
  const { UI } = context();
  for (const value of [undefined, null, '', NaN, false, {}, '-.--']) { assert.equal(UI.value(value), ''); assert.match(UI.cell(value), /unverified/); }
  assert.equal(UI.value(0), '0'); assert.equal(UI.cell(0), '<td>0</td>');
  assert.equal(UI.record({ wins: 0, losses: 0 }), '0–0');
  assert.equal(UI.record({ wins: 0 }), '');
});
test('HTML and source attributes are escaped; every table row has an official link', () => {
  const { UI, MLB } = context();
  const html = UI.table('<caption>', ['Name'], [[UI.cell('<img src=x onerror=alert(1)>')], [UI.cell(null)]], MLB.gameURL(pk));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  for (const [, row] of html.matchAll(/<tr>(.*?)<\/tr>/g)) assert.match(row, /https:\/\/statsapi\.mlb\.com/);
  assert.throws(() => UI.source('javascript:alert(1)'));
  assert.throws(() => UI.source('https://statsapi.mlb.com.evil.test/'));
});
test('official archived ABS excerpt uses exact counters and no later PA score', () => {
  const { Reviews } = context();
  const rows = Reviews.extract(fixture.feed, pk);
  assert.equal(rows.length, 1); assert.equal(rows[0].typeKey, 'abs');
  assert.equal(rows[0].outcome, 'Overturned'); assert.equal(rows[0].counter.remaining, 2);
  assert.equal(rows[0].counter.usedSuccessful, 3); assert.equal(rows[0].counter.usedFailed, 0);
  assert.equal(rows[0].beforeScore, null); assert.equal(rows[0].scoreAfter, null);
  assert.equal(Reviews.visibleInAll(rows[0]), false); assert.equal(Reviews.shouldAlert(rows[0]), false);
});
test('ABS has no invented counters when absent in older feeds', () => {
  const { Reviews } = context(); const feed = structuredClone(fixture.feed);
  delete feed.gameData.absChallenges;
  const row = Reviews.extract(feed, pk)[0];
  assert.equal(row.counter, null); assert.ok(row.flags.some(flag => flag.includes('unverified')));
});
test('unknown review codes and unknown progress are flagged, never guessed', () => {
  const { Reviews } = context(); const feed = synthetic();
  feed.liveData.plays.allPlays[0].playEvents[0].reviewDetails = { reviewType: 'ZZ' };
  const row = Reviews.extract(feed, pk)[0];
  assert.equal(row.typeKey, 'unknown'); assert.equal(row.inProgress, null); assert.equal(row.outcome, null);
  assert.ok(row.flags.length >= 3);
  assert.equal(Reviews.activeStatus({ statusCode: 'ZZ', detailedState: 'challenge text' }), null);
  assert.equal(Reviews.activeStatus({ statusCode: 'IH' }).typeKey, 'review');
});
test('plain challenge/review text is not accepted as a review record', () => {
  const { Reviews } = context(); const feed = synthetic();
  delete feed.liveData.plays.allPlays[0].playEvents[0].reviewDetails;
  feed.liveData.plays.allPlays[0].result.description = 'A player challenged himself to improve';
  assert.equal(Reviews.extract(feed, pk).length, 0);
});
test('top-level mirrors deduplicate while two separate ABS pitch reviews remain distinct', () => {
  const { Reviews } = context(); const feed = synthetic(), play = feed.liveData.plays.allPlays[0];
  play.reviewDetails = { ...play.playEvents[0].reviewDetails };
  assert.equal(Reviews.extract(feed, pk).length, 1);
  play.playEvents.push({ ...structuredClone(play.playEvents[0]), index: 1 });
  assert.equal(Reviews.extract(feed, pk).length, 2);
  assert.notEqual(Reviews.extract(feed, pk)[0].id, Reviews.extract(feed, pk)[1].id);
});
test('latest currentPlay replaces an older allPlays copy, including index zero', () => {
  const { Reviews } = context(); const feed = synthetic();
  feed.liveData.plays.currentPlay = structuredClone(feed.liveData.plays.allPlays[0]);
  feed.liveData.plays.currentPlay.result.description = 'Latest synthetic description';
  assert.equal(Reviews.plays(feed).length, 1);
  assert.equal(Reviews.plays(feed)[0].result.description, 'Latest synthetic description');
});
test('runs at risk requires scoring movement tied to this exact event', () => {
  const { Reviews } = context(); const feed = synthetic();
  assert.equal(Reviews.extract(feed, pk)[0].runsAtRisk, 1);
  feed.liveData.plays.allPlays[0].runners[0].details.playIndex = 9;
  assert.equal(Reviews.extract(feed, pk)[0].runsAtRisk, null);
  feed.liveData.plays.allPlays[0].runners[0].details.playIndex = 0;
  feed.liveData.plays.allPlays[0].runners[0].details.isScoringEvent = false;
  assert.equal(Reviews.extract(feed, pk)[0].runsAtRisk, null);
});
test('before-score is captured only while active; resolved event uses its own explicit score', () => {
  const { Reviews, FeedLog } = context(); const log = FeedLog.empty(date), feed = synthetic();
  Reviews.observe(log, feed, pk);
  assert.equal(log.entries[0].review.beforeScore.away, 1);
  feed.liveData.plays.allPlays[0].playEvents[0].reviewDetails.inProgress = false;
  feed.liveData.plays.allPlays[0].playEvents[0].reviewDetails.isOverturned = false;
  feed.liveData.linescore.teams.away.runs = 10;
  Reviews.observe(log, feed, pk);
  assert.equal(log.entries[0].review.beforeScore.away, 1);
  assert.equal(log.entries[0].review.scoreAfter.away, 1);
  assert.equal(log.entries[0].review.outcome, 'Not overturned');
  const afterOnly = FeedLog.empty(date); Reviews.observe(afterOnly, feed, pk);
  assert.equal(afterOnly.entries[0].review.beforeScore, null);
});
test('backwards official counters are retained and flagged, never repaired', () => {
  const { Reviews, FeedLog } = context(); const log = FeedLog.empty(date), feed = synthetic();
  feed.gameData.review.away.used = 2; Reviews.observe(log, feed, pk);
  feed.gameData.review.away.used = 1; Reviews.observe(log, feed, pk);
  assert.equal(log.entries[0].review.counter.used, 1);
  assert.ok(log.entries[0].review.flags.some(flag => flag.includes('backwards')));
});
test('no historical scoring change is invented on first observation; observed reclassification is retained', () => {
  const { Reviews, FeedLog } = context(); const log = FeedLog.empty(date), feed = synthetic();
  Reviews.observe(log, feed, pk); assert.equal(log.entries.filter(entry => entry.review.typeKey === 'scoring').length, 0);
  const play = feed.liveData.plays.allPlays[0]; play.result.eventType = 'field_error'; play.result.event = 'Field Error';
  Reviews.observe(log, feed, pk);
  let change = log.entries.find(entry => entry.review.typeKey === 'scoring');
  assert.equal(change.review.initialCall, 'Single'); assert.equal(change.review.finalCall, 'Field Error');
  play.result.eventType = 'double'; play.result.event = 'Double'; Reviews.observe(log, feed, pk);
  change = log.entries.find(entry => entry.review.typeKey === 'scoring');
  assert.equal(change.review.initialCall, 'Single'); assert.equal(change.review.history.length, 2);
  assert.equal(log.entries.filter(entry => entry.review.typeKey === 'scoring').length, 1);
});
test('newly reported isOut must not become an invented reclassification', () => {
  const { Reviews, FeedLog } = context(); const log = FeedLog.empty(date), feed = synthetic();
  delete feed.liveData.plays.allPlays[0].result.isOut; Reviews.observe(log, feed, pk);
  feed.liveData.plays.allPlays[0].result.isOut = false; Reviews.observe(log, feed, pk);
  assert.equal(log.entries.filter(entry => entry.review.typeKey === 'scoring').length, 0);
});
test('description edits and vanished plays are flagged instead of hidden or called scoring changes', () => {
  const { Reviews, FeedLog } = context(); const log = FeedLog.empty(date), feed = synthetic();
  Reviews.observe(log, feed, pk);
  feed.liveData.plays.allPlays[0].result.description = 'Edited synthetic description'; Reviews.observe(log, feed, pk);
  assert.equal(log.entries.filter(entry => entry.review.typeKey === 'scoring').length, 0);
  assert.ok(log.irregularities[pk][0].includes('without a reclassification'));
  feed.liveData.plays.allPlays = []; Reviews.observe(log, feed, pk);
  assert.ok(log.irregularities[pk].some(note => note.includes('absent')));
  assert.ok(log.snapshots[pk][0]);
  assert.equal(log.entries[0].review.inProgress, null);
});
test('official scorer pending uses exact official event type', () => {
  const { Reviews } = context(); const feed = synthetic();
  feed.liveData.plays.allPlays[0].result.eventType = 'os_ruling_pending_primary';
  const rows = Reviews.extract(feed, pk); assert.equal(rows.filter(row => row.typeKey === 'pending').length, 1);
});
test('logs survive reload with numeric zero-index keys, flags and scoring baselines', () => {
  const ctx = context(), feed = synthetic(), log = ctx.FeedLog.empty(date);
  ctx.Reviews.observe(log, feed, pk); ctx.FeedLog.save(log);
  const serialized = ctx.localStorage.getItem(`mlbReplayFeedLog.v2.${date}`);
  const other = context(); other.localStorage.setItem(`mlbReplayFeedLog.v2.${date}`, serialized);
  const restored = other.FeedLog.read(date);
  assert.equal(restored.entries.length, 1); assert.ok(restored.snapshots[pk][0]);
  assert.equal(restored.entries[0].review.beforeScore.away, 1);
});
test('malformed storage is ignored; seven-date retention and entry caps hold', () => {
  const ctx = context({ console: { warn() {}, log() {} } });
  ctx.localStorage.setItem('mlbReplayFeedLog.v2.2026-08-01', '{bad json');
  assert.equal(ctx.FeedLog.read('2026-08-01').entries.length, 0);
  for (let day = 1; day <= 9; day++) ctx.FeedLog.save(ctx.FeedLog.empty(`2026-08-${String(day).padStart(2, '0')}`));
  assert.equal(ctx.localStorage.length, 7);
  assert.equal(ctx.FeedLog.clean({ v: 1, date, entries: [null, {}, { gamePk: 'bad', review: {} }] }, date).entries.length, 0);
});
test('shared merge does not clobber newer observations with stale data', () => {
  const { Reviews, FeedLog } = context(), feed = synthetic(), old = FeedLog.empty(date);
  Reviews.observe(old, feed, pk); old.savedAt = 100; old.entries[0].lastSeen = 100;
  const newer = structuredClone(old); newer.savedAt = 200; newer.entries[0].lastSeen = 200; newer.entries[0].review.outcome = 'Overturned';
  const merged = FeedLog.merge(newer, old);
  assert.equal(merged.entries[0].review.outcome, 'Overturned'); assert.equal(merged.savedAt, 200);
});
test('review HTML and projection table always link every row, leaving unsupported predictions blank', () => {
  const { Reviews, Props, FeedLog } = context(), log = FeedLog.empty(date);
  Reviews.observe(log, synthetic(), pk);
  const html = Reviews.render(log.entries[0], date) + Props.render(fixture.feed);
  for (const [, row] of html.matchAll(/<tr>(.*?)<\/tr>/g)) assert.match(row, /https:\/\/statsapi\.mlb\.com/);
  assert.match(html, /Possible after — unverified/); assert.match(html, /Hit forecast — unverified/);
  assert.doesNotMatch(html, /[0-9]+%/);
});
test('Retry-After numeric/date parsing is bounded with a conservative default', () => {
  const { MLB } = context(); const now = Date.parse('2026-11-20T00:00:00Z');
  assert.equal(MLB.retryAfter('2', now), 2000); assert.equal(MLB.retryAfter(null, now), 60000);
  assert.equal(MLB.retryAfter('0', now), 1000); assert.equal(MLB.retryAfter('999999', now), 300000);
  assert.equal(MLB.retryAfter('Fri, 20 Nov 2026 00:00:05 GMT', now), 5000);
});
test('in-flight official fetches are coalesced; HTTP 429 quiets subsequent requests', async () => {
  let calls = 0, resolve;
  const ctx = context({ fetch: () => { calls++; return new Promise(done => { resolve = done; }); } });
  const one = ctx.MLB.schedule(date), two = ctx.MLB.schedule(date);
  assert.equal(calls, 1); resolve(new Response(JSON.stringify(fixture.schedule))); await Promise.all([one, two]);
  const limited = context({ fetch: async () => { calls++; return new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }); } });
  await assert.rejects(limited.MLB.schedule(date), /HTTP 429/);
  const count = calls; await assert.rejects(limited.MLB.live(pk), /pause/); assert.equal(calls, count);
});
test('older-game fallback is restricted to an actual 404, not errors or rate limits', async () => {
  const urls = [];
  const ctx = context({ fetch: async target => { urls.push(target); return new Response('{}', { status: urls.length === 1 ? 404 : 200 }); } });
  await ctx.MLB.live(pk); assert.equal(urls.length, 2); assert.match(urls[1], /api\/v1\/game/);
  let calls = 0;
  const bad = context({ fetch: async () => { calls++; return new Response('{}', { status: 500 }); } });
  await assert.rejects(bad.MLB.live(pk), /HTTP 500/); assert.equal(calls, 1);
});
test('static hosting discovers no backend without hitting nonexistent API routes', async () => {
  const requests = [];
  const { FeedLog } = context({ fetch: async (target, options) => { requests.push([String(target), options.method]); return new Response(null, { status: 200 }); } });
  await FeedLog.sync(date); await FeedLog.sync(date, true);
  assert.equal(requests.length, 1); assert.equal(requests[0][1], 'HEAD'); assert.match(requests[0][0], /\/LIVPBP\/index\.html$/);
});
test('polling cannot overlap and pauses when hidden', async () => {
  let calls = 0, resolve, visibility;
  const document = { baseURI: 'https://example.test/LIVPBP/', hidden: false, getElementById: () => null,
    addEventListener: (_, handler) => { visibility = handler; }, removeEventListener() {} };
  const { UI } = context({ document });
  const poll = UI.poll(() => { calls++; return new Promise(done => { resolve = done; }); }, 10000);
  const first = poll.refresh(); poll.refresh(); assert.equal(calls, 1);
  document.hidden = true; visibility(); resolve(10000); await first;
  poll.refresh(); assert.equal(calls, 1);
  document.hidden = false; visibility(); assert.equal(calls, 2);
  resolve(10000); poll.stop();
});
