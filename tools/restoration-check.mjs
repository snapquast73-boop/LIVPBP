#!/usr/bin/env node
/* tools/restoration-check.mjs — deterministic, network-free checks for the
 * 2026-11-20 restoration (see COORDINATION.md / flagged.html):
 *  1. every local src/href referenced by the site's HTML pages exists;
 *  2. every assets/js/*.js parses (node --check equivalent via vm.Script);
 *  3. server.mjs API contract round-trip on a throwaway port:
 *     GET /api/health, POST+GET /api/feed-log, and static 200s.
 * Run: node tools/restoration-check.mjs   (exit 1 on any failure)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) failures += 1; };

// 1. local references
const pages = ['index.html', 'game.html', 'reviews.html', '404.html', 'flagged.html'];
const refs = new Set();
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|data:|#|mailto:)/.test(u)) continue;
    if (/[\s'"]/.test(u) || u.includes('<')) continue; // JS-constructed URL (e.g. 404.html <base>)
    refs.add(u.split(/[?#]/)[0]);
  }
}
for (const ref of refs) ok(fs.existsSync(path.join(ROOT, ref)), `referenced file exists: ${ref}`);

// 2. JS syntax
for (const f of fs.readdirSync(path.join(ROOT, 'assets/js'))) {
  const code = fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8');
  try { new vm.Script(code, { filename: f }); ok(true, `parses: assets/js/${f}`); }
  catch (e) { ok(false, `parses: assets/js/${f} — ${e.message}`); }
}

// 3. server contract
const PORT = 8137;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe']
});
const req = (method, p, body) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method,
    headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => {
    let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d }));
  });
  r.on('error', reject);
  if (body) r.write(body);
  r.end();
});
try {
  await new Promise((r) => setTimeout(r, 900));
  const health = await req('GET', '/api/health');
  ok(health.status === 200 && JSON.parse(health.body).status === 'ok', 'server: GET /api/health');

  const payload = JSON.stringify({ v: 1, date: '2024-06-01', savedAt: Date.now(),
    entries: [], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] });
  const post = await req('POST', '/api/feed-log', payload);
  ok(post.status === 200 && JSON.parse(post.body).ok === true, 'server: POST /api/feed-log');
  const get = await req('GET', '/api/feed-log?date=2024-06-01');
  ok(get.status === 200 && JSON.parse(get.body).date === '2024-06-01', 'server: GET /api/feed-log round-trip');
  for (const p of ['/', '/index.html', '/game.html', '/reviews.html', '/flagged.html',
                   '/assets/css/style.css', '/assets/js/api.js', '/assets/js/game.js',
                   '/assets/js/scoreboard.js', '/assets/js/reviews-feed.js']) {
    const res = await req('GET', p);
    ok(res.status === 200 && res.body.length > 0, `server: GET ${p} -> 200`);
  }
  const dotRes = await req('GET', '/.git/HEAD');
  ok(dotRes.status === 403, 'server: GET /.git/HEAD -> 403');
  const zeroMergeA = await req('POST', '/api/feed-log', JSON.stringify({
    v: 1, date: '2024-06-01', entries: [{ gamePk: 824638, kind: 'review', review: { atBatIndex: 0, outcome: 'Stands' } }],
  }));
  const zeroMergeB = await req('POST', '/api/feed-log', JSON.stringify({
    v: 1, date: '2024-06-01', entries: [{ gamePk: 824638, kind: 'review', review: { atBatIndex: '', outcome: 'Unknown' } }],
  }));
  ok(zeroMergeA.status === 200 && zeroMergeB.status === 200 && JSON.parse(zeroMergeB.body).entriesCount === 2,
    'server: POST /api/feed-log preserves atBatIndex 0 distinct from empty');
  // clean up the test artifact the POST wrote
  fs.rmSync(path.join(ROOT, 'data', 'feed-log-2024-06-01.json'), { force: true });
  fs.rmSync(path.join(ROOT, 'data', 'feed-log-index.json'), { force: true });
  try { fs.rmdirSync(path.join(ROOT, 'data')); } catch { /* data/ pre-existed */ }
} catch (e) {
  ok(false, 'server contract: ' + e.message);
} finally {
  child.kill('SIGTERM');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
