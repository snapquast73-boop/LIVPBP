import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp, mergeFeedLogPayloads, normalizeLog, validDate } from '../server.mjs';
const date = '2026-08-28';
const entry = (id, seen) => ({ gamePk: 824638, review: { id, typeKey: 'scoring' }, firstSeen: seen, lastSeen: seen });
const log = (entries = [], savedAt = 1) => ({ v: 1, date, savedAt, entries, snapshots: {}, irregularities: {} });
test('server validates calendar dates and payloads', () => {
  assert.equal(validDate('2026-02-29'), false); assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('../2026-01-01'), false); assert.throws(() => normalizeLog(null, date));
  assert.equal(normalizeLog({ ...log(), snapshots: JSON.parse('{"__proto__":{"polluted":true}}') }, date).snapshots.polluted, undefined);
});
test('server merge preserves zero-index IDs, independent entries and newest observations', () => {
  const merged = mergeFeedLogPayloads(log([entry('0:event-0', 3)]), log([entry('0:event-0', 2), entry('1:event-0', 2)], 2), date);
  assert.equal(merged.entries.length, 2); assert.equal(merged.entries[0].lastSeen, 3);
  assert.equal(merged.entries[0].review.id, '0:event-0');
});
test('HTTP: assets, project prefix, errors, disk persistence, SSE, and security boundaries', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'livpbp-test-'));
  const app = createApp({ dataDir: directory });
  app.listen(0, '0.0.0.0'); await once(app, 'listening');
  const origin = `http://127.0.0.1:${app.address().port}`;
  t.after(async () => { app.closeAllConnections(); await new Promise(resolve => app.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  for (const page of ['/', '/LIVPBP/', '/game.html', '/reviews.html', '/flagged-for-review.html', '/assets/js/api.js', '/LIVPBP/assets/css/style.css']) {
    const response = await fetch(origin + page); assert.equal(response.status, 200, page); assert.equal(response.headers.get('X-MLB-Feed-Log'), '1'); await response.text();
  }
  for (const secret of ['/.git/config', '/server.mjs', '/package.json', '/data/feed-log-2026-08-28.json', '/%2e%2e/.git/config', '/assets/js/../../server.mjs']) {
    const response = await fetch(origin + secret); assert.equal(response.status, 404, secret); await response.text();
  }
  assert.equal((await fetch(origin + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(origin + '/api/feed-log?date=2026-02-29')).status, 400);
  assert.equal((await fetch(origin + '/api/feed-log', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(origin + '/api/feed-log', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: '{}' })).status, 403);
  assert.equal((await fetch(origin + '/api/feed-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' })).status, 400);
  const abort = new AbortController();
  const stream = await fetch(`${origin}/api/feed-log/stream?date=${date}`, { signal: abort.signal });
  const reader = stream.body.getReader(); let text = new TextDecoder().decode((await reader.read()).value);
  assert.match(text, /event: connected/); assert.match(text, /event: feed-log/);
  const response = await fetch(origin + '/api/feed-log', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(log([entry('0:event-0', 1)])) });
  assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.pushed, 1);
  text = new TextDecoder().decode((await reader.read()).value); assert.match(text, /0:event-0/);
  abort.abort(); await reader.cancel().catch(() => {});
  const saved = await (await fetch(`${origin}/api/feed-log?date=${date}`)).json(); assert.equal(saved.entries.length, 1);
  assert.ok(fs.existsSync(path.join(directory, `feed-log-${date}.json`)));
  const head = await fetch(origin + '/index.html', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
});
