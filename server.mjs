#!/usr/bin/env node
/* Optional local/shared persistence. GitHub Pages needs no Node server. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 2 * 1024 * 1024;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const PAGES = new Set(['index.html', 'game.html', 'reviews.html', 'flagged-for-review.html', '404.html', 'build-info.json']);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function normalizeLog(payload, date) {
  if (!validDate(date)) throw new Error('A valid calendar date is required.');
  if (!plain(payload) || payload.v !== 1 || payload.date !== date) throw new Error('Invalid observation log.');
  const log = { v: 1, date, savedAt: Number.isFinite(payload.savedAt) ? payload.savedAt : 0,
    entries: [], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] };
  log.entries = (Array.isArray(payload.entries) ? payload.entries : []).filter(entry => plain(entry) &&
    Number.isSafeInteger(entry.gamePk) && entry.gamePk > 0 && plain(entry.review) &&
    typeof entry.review.id === 'string' && entry.review.id.length < 150 && typeof entry.review.typeKey === 'string' &&
    Number.isFinite(entry.firstSeen) && Number.isFinite(entry.lastSeen)
  ).slice(0, 500);
  for (const field of ['snapshots', 'irregularities', 'grace']) {
    if (!plain(payload[field])) continue;
    Object.entries(payload[field]).forEach(([key, value]) => {
      if (/^\d{1,14}$/.test(key)) log[field][key] = value;
    });
  }
  log.settled = (Array.isArray(payload.settled) ? payload.settled : []).filter(Number.isSafeInteger);
  return log;
}
export function mergeFeedLogPayloads(existing, incoming, date) {
  const next = normalizeLog(incoming, date);
  let old;
  try { old = normalizeLog(existing, date); } catch (_) { old = normalizeLog({ v: 1, date }, date); }
  const entries = new Map(old.entries.map(entry => [`${entry.gamePk}:${entry.review.id}`, entry]));
  next.entries.forEach(entry => {
    const key = `${entry.gamePk}:${entry.review.id}`, previous = entries.get(key);
    if (!previous || entry.lastSeen > previous.lastSeen) {
      const merged = { ...entry, firstSeen: previous ? Math.min(previous.firstSeen, entry.firstSeen) : entry.firstSeen };
      if (previous?.review?.beforeScore && !merged.review.beforeScore) merged.review = { ...merged.review, beforeScore: previous.review.beforeScore };
      entries.set(key, merged);
    }
  });
  const result = { ...old, savedAt: Math.max(old.savedAt, next.savedAt),
    entries: [...entries.values()].sort((a, b) => b.firstSeen - a.firstSeen).slice(0, 500),
    snapshots: next.savedAt > old.savedAt ? { ...old.snapshots, ...next.snapshots } : old.snapshots,
    grace: { ...old.grace, ...next.grace }, settled: [...new Set([...old.settled, ...next.settled])] };
  Object.keys(next.irregularities).forEach(key => {
    result.irregularities[key] = [...new Set([...(Array.isArray(old.irregularities[key]) ? old.irregularities[key] : []), ...(Array.isArray(next.irregularities[key]) ? next.irregularities[key] : [])])].filter(note => typeof note === 'string').slice(-30);
  });
  result.order = result.entries.map(entry => `${entry.gamePk}:${entry.review.id}`);
  return result;
}
export function createApp({ root = ROOT, dataDir = process.env.DATA_DIR ?? path.join(ROOT, 'data') } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const clients = new Set();
  function json(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
    res.end(body);
  }
  function read(date) {
    try { return normalizeLog(JSON.parse(fs.readFileSync(path.join(dataDir, `feed-log-${date}.json`), 'utf8')), date); }
    catch (_) { return normalizeLog({ v: 1, date }, date); }
  }
  const app = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-MLB-Feed-Log', '1');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    let target, pathname;
    try {
      target = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(target.pathname);
    } catch (_) { json(res, 400, { error: 'Malformed URL' }); return; }
    // Also serve the repository prefix locally, including deep 404 links.
    if (pathname.startsWith('/LIVPBP/')) pathname = pathname.slice('/LIVPBP'.length);
    if (pathname === '/api/health' && ['GET', 'HEAD'].includes(req.method)) {
      if (req.method === 'HEAD') { res.writeHead(200); res.end(); } else json(res, 200, { status: 'ok' });
      return;
    }
    if (['/api/feed-log', '/api/log', '/api/feed-log/stream'].includes(pathname)) {
      if (pathname.endsWith('/stream') && req.method === 'GET') {
        const date = target.searchParams.get('date');
        if (!validDate(date)) { json(res, 400, { error: 'A valid date=YYYY-MM-DD is required' }); return; }
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
        res.write(`retry: 3000\nevent: connected\ndata: ${JSON.stringify({ date })}\n\n`);
        res.write(`event: feed-log\ndata: ${JSON.stringify(read(date))}\n\n`);
        const client = { res, date }; clients.add(client);
        const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': hb\n\n'); }, 20000);
        heartbeat.unref();
        res.on('close', () => { clearInterval(heartbeat); clients.delete(client); });
        return;
      }
      if (req.method === 'GET' && !pathname.endsWith('/stream')) {
        const date = target.searchParams.get('date');
        if (!validDate(date)) { json(res, 400, { error: 'A valid date=YYYY-MM-DD is required' }); return; }
        json(res, 200, read(date)); return;
      }
      if (req.method !== 'POST' || pathname.endsWith('/stream')) { res.setHeader('Allow', 'GET, POST'); json(res, 405, { error: 'Method not allowed' }); return; }
      // Same-origin JSON writes only. This optional server is for trusted local/shared use, not public SaaS.
      if (req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); } catch (_) { json(res, 403, { error: 'Invalid origin' }); return; }
        if (origin.host !== req.headers.host || !['http:', 'https:'].includes(origin.protocol)) { json(res, 403, { error: 'Cross-origin writes are forbidden' }); return; }
      }
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) { json(res, 415, { error: 'JSON content type required' }); return; }
      let body = '', size = 0, tooLarge = false;
      req.setEncoding('utf8');
      req.on('data', chunk => { size += Buffer.byteLength(chunk); if (size > MAX_BODY) tooLarge = true; else body += chunk; });
      req.on('error', () => { if (!res.headersSent) json(res, 400, { error: 'Incomplete request' }); });
      req.on('end', () => {
        if (tooLarge) { json(res, 413, { error: 'Observation log exceeds 2 MB' }); return; }
        let incoming;
        try { incoming = JSON.parse(body); normalizeLog(incoming, incoming?.date); }
        catch (_) { json(res, 400, { error: 'Invalid JSON observation log or calendar date' }); return; }
        try {
          const date = incoming.date, merged = mergeFeedLogPayloads(read(date), incoming, date);
          const destination = path.join(dataDir, `feed-log-${date}.json`);
          const temporary = `${destination}.tmp`;
          fs.writeFileSync(temporary, JSON.stringify(merged)); fs.renameSync(temporary, destination);
          const frame = `event: feed-log\ndata: ${JSON.stringify(merged)}\n\n`;
          let pushed = 0;
          for (const client of clients) {
            if (client.date === date && !client.res.destroyed) { client.res.write(frame); pushed++; }
          }
          json(res, 200, { ok: true, date, savedAt: merged.savedAt, entriesCount: merged.entries.length, pushed });
        } catch (error) { console.error('Observation save failed:', error.message); json(res, 500, { error: 'Observation could not be saved' }); }
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); json(res, 405, { error: 'Method not allowed' }); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const allowedAsset = /^assets\/(?:css|js)\/[a-zA-Z0-9_.-]+\.(?:css|js|svg|png|jpg|webp|ico)$/.test(relative);
    const file = path.resolve(root, relative);
    const allowed = (PAGES.has(relative) || allowedAsset) && file.startsWith(path.resolve(root) + path.sep);
    let stat;
    if (allowed) { try { stat = fs.statSync(file); } catch (_) { /* normal 404 */ } }
    if (!stat?.isFile()) {
      const notFound = path.join(root, '404.html');
      const body = fs.existsSync(notFound) ? fs.readFileSync(notFound) : '404 Not Found';
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end();
    else { const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res); }
  });
  app.on('close', () => { for (const client of clients) client.res.end(); clients.clear(); });
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  const app = createApp();
  app.listen(port, '0.0.0.0', () => console.log(`[MLB Live PBP] http://0.0.0.0:${app.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { app.close(); app.closeAllConnections(); });
}
