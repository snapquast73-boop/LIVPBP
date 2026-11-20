/* feed-log.js — persistent feed log (browser + optional server backend).
 * Reconstructed 2026-11-20 to the contract in server.mjs and README.md:
 *  - payload shape {v:1, date, savedAt, entries, order, snapshots,
 *    irregularities, grace, settled} — the exact shape server.mjs merges;
 *  - localStorage: one log per date, newest 7 dates kept, 500 rows max;
 *  - server (when server.mjs is running): GET/POST /api/feed-log?date=… and
 *    the SSE push GET /api/feed-log/stream?date=… . On static hosting
 *    (GitHub Pages) those endpoints do not exist: every server call fails
 *    quietly and the browser log keeps working — never an error banner.
 *  - malformed stored data is dropped with a console warning, never guessed.
 */
(function () {
  'use strict';

  var KEY_PREFIX = 'livpbp-feed-log-';
  var MAX_ENTRIES = 500;
  var KEEP_DATES = 7;

  function blankLog(dateStr) {
    return { v: 1, date: dateStr, savedAt: Date.now(), entries: [], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] };
  }
  function isValidShape(x, dateStr) {
    return !!x && typeof x === 'object' && x.v === 1 && x.date === dateStr && Array.isArray(x.entries);
  }

  function loadLocal(dateStr) {
    try {
      var raw = localStorage.getItem(KEY_PREFIX + dateStr);
      if (!raw) return blankLog(dateStr);
      var parsed = JSON.parse(raw);
      if (!isValidShape(parsed, dateStr)) {
        console.warn('[feed-log] malformed stored log for ' + dateStr + ' dropped');
        return blankLog(dateStr);
      }
      parsed.order = Array.isArray(parsed.order) ? parsed.order : [];
      parsed.snapshots = (parsed.snapshots && typeof parsed.snapshots === 'object') ? parsed.snapshots : {};
      parsed.irregularities = (parsed.irregularities && typeof parsed.irregularities === 'object') ? parsed.irregularities : {};
      parsed.grace = (parsed.grace && typeof parsed.grace === 'object') ? parsed.grace : {};
      parsed.settled = Array.isArray(parsed.settled) ? parsed.settled : [];
      return parsed;
    } catch (e) {
      console.warn('[feed-log] could not read stored log for ' + dateStr, e);
      return blankLog(dateStr);
    }
  }

  function pruneOldDates(currentDate) {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(KEY_PREFIX) === 0) keys.push(k);
      }
      keys.sort(); // date-stamped keys sort chronologically
      while (keys.length > KEEP_DATES) {
        var old = keys.shift();
        if (old !== KEY_PREFIX + currentDate) localStorage.removeItem(old); else break;
      }
    } catch (e) { /* storage full/blocked: non-fatal */ }
  }

  function saveLocal(log) {
    if (!isValidShape(log, log.date)) return log;
    log.savedAt = Date.now();
    if (log.entries.length > MAX_ENTRIES) {
      var keepKeys = {};
      log.order.slice(-MAX_ENTRIES).forEach(function (k) { keepKeys[k] = 1; });
      log.entries = log.entries.filter(function (e) { return keepKeys[entryKey(e)]; });
      log.order = log.order.filter(function (k) { return keepKeys[k]; });
    }
    try { localStorage.setItem(KEY_PREFIX + log.date, JSON.stringify(log)); } catch (e) { /* non-fatal */ }
    pruneOldDates(log.date);
    return log;
  }

  function entryKey(entry) {
    if (!entry || !entry.review) return null;
    return entry.gamePk + ':' + (entry.review.id || entry.review.atBatIndex || '');
  }

  // Idempotent merge (same rules as server.mjs mergeFeedLogPayloads).
  function mergeInto(log, incoming) {
    if (!incoming || incoming.v !== 1 || incoming.date !== log.date) return log;
    var byKey = {};
    var order = [];
    function add(e, preferIncoming) {
      var k = entryKey(e);
      if (!k) return;
      if (!byKey[k]) { byKey[k] = e; order.push(k); return; }
      if (preferIncoming) {
        var prev = byKey[k];
        byKey[k] = {
          gamePk: e.gamePk || prev.gamePk,
          review: Object.assign({}, prev.review, e.review),
          firstSeen: Math.min(prev.firstSeen || e.firstSeen || Date.now(), e.firstSeen || prev.firstSeen || Date.now()),
          lastSeen: Math.max(prev.lastSeen || 0, e.lastSeen || 0),
          matchupLabel: e.matchupLabel || prev.matchupLabel || null
        };
      }
    }
    log.entries.forEach(function (e) { add(e, false); });
    (incoming.entries || []).forEach(function (e) { add(e, true); });
    log.entries = order.map(function (k) { return byKey[k]; });
    log.order = order;
    Object.keys(incoming.snapshots || {}).forEach(function (g) {
      log.snapshots[g] = Object.assign({}, log.snapshots[g] || {}, incoming.snapshots[g] || {});
    });
    Object.keys(incoming.irregularities || {}).forEach(function (g) {
      var notes = (log.irregularities[g] || []).slice();
      (incoming.irregularities[g] || []).forEach(function (n) {
        if (typeof n === 'string' && notes.indexOf(n) < 0) notes.push(n);
      });
      log.irregularities[g] = notes.slice(-30);
    });
    log.grace = Object.assign({}, log.grace, incoming.grace || {});
    var settled = {};
    (log.settled || []).concat(incoming.settled || []).forEach(function (s) { settled[s] = 1; });
    log.settled = Object.keys(settled);
    return log;
  }

  function upsert(log, entry) {
    var k = entryKey(entry);
    if (!k) return log;
    var found = false;
    log.entries = log.entries.map(function (e) {
      if (entryKey(e) === k) { found = true; return entry; }
      return e;
    });
    if (!found) { log.entries.push(entry); log.order.push(k); }
    return log;
  }

  // ---- optional server backend (server.mjs). Static hosting: silent no-op.
  var serverState = 'unknown'; // 'available' | 'unavailable'
  function serverFetch(path, opts) {
    if (serverState === 'unavailable') return Promise.reject(new Error('server unavailable'));
    return fetch(path, opts).then(function (res) {
      var ct = res.headers.get('Content-Type') || '';
      if (!res.ok || ct.indexOf('application/json') < 0) throw new Error('not the feed-log server');
      serverState = 'available';
      return res.json();
    }).catch(function (err) {
      if (serverState === 'unknown') serverState = 'unavailable';
      throw err;
    });
  }
  function pullServer(dateStr) {
    return serverFetch('/api/feed-log?date=' + encodeURIComponent(dateStr)).catch(function () { return null; });
  }
  function pushServer(log) {
    return serverFetch('/api/feed-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    }).catch(function () { return null; });
  }
  function subscribe(dateStr, onPayload) {
    if (typeof EventSource === 'undefined' || serverState === 'unavailable') return null;
    try {
      var es = new EventSource('/api/feed-log/stream?date=' + encodeURIComponent(dateStr));
      es.addEventListener('feed-log', function (ev) {
        try { onPayload(JSON.parse(ev.data)); } catch (e) { console.warn('[feed-log] bad push payload dropped', e); }
      });
      es.onerror = function () { /* browser auto-reconnects; pull fallback covers gaps */ };
      return es;
    } catch (e) { return null; }
  }

  window.FeedLog = {
    blankLog: blankLog,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    mergeInto: mergeInto,
    upsert: upsert,
    entryKey: entryKey,
    pullServer: pullServer,
    pushServer: pushServer,
    subscribe: subscribe
  };
})();
