/* ============================================================================
 * feed-log.js — persistence for everything the Replay Feed tracks
 *
 * Two layers, both idempotent:
 *   1. localStorage  — always available, one log per date, newest 7 dates kept
 *   2. server store  — optional: POST/GET /api/feed-log (server.mjs), plus a
 *      server-sent-event stream that pushes other browsers' writes
 *
 * On static hosting (GitHub Pages) the API endpoints do not exist: every
 * request fails quietly and the page keeps working from localStorage alone —
 * the documented graceful degradation.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var KEY_PREFIX = 'mlbp.feedlog.';
  var INDEX_KEY = 'mlbp.feedlog.index';
  var KEEP_DATES = 7;
  var MAX_ENTRIES = 500;
  var WRITE_COALESCE_MS = 1000;

  var apiState = { checked: false, available: false, lastError: null };
  var saveTimers = Object.create(null);
  var pendingPayloads = Object.create(null);
  var listeners = [];
  var stream = null;

  function emptyPayload(date) {
    return {
      v: 1,
      date: date,
      savedAt: Date.now(),
      entries: [],
      order: [],
      snapshots: {},
      irregularities: {},
      grace: {},
      settled: [],
    };
  }

  function storageGet(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function readIndex() {
    try {
      var raw = storageGet(INDEX_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function writeIndex(dates) {
    var sorted = dates.slice().sort();
    while (sorted.length > KEEP_DATES) {
      var drop = sorted.shift();
      try { global.localStorage.removeItem(KEY_PREFIX + drop); } catch (e) { /* ignore */ }
    }
    storageSet(INDEX_KEY, JSON.stringify(sorted));
  }

  function normalize(payload, date) {
    if (!payload || typeof payload !== 'object') return emptyPayload(date);
    return {
      v: 1,
      date: date,
      savedAt: Number(payload.savedAt) || Date.now(),
      entries: Array.isArray(payload.entries) ? payload.entries.filter(Boolean) : [],
      order: Array.isArray(payload.order) ? payload.order.slice() : [],
      snapshots: (payload.snapshots && typeof payload.snapshots === 'object') ? payload.snapshots : {},
      irregularities: (payload.irregularities && typeof payload.irregularities === 'object') ? payload.irregularities : {},
      grace: (payload.grace && typeof payload.grace === 'object') ? payload.grace : {},
      settled: Array.isArray(payload.settled) ? payload.settled.slice() : [],
    };
  }

  function entryKey(entry) {
    if (!entry) return null;
    if (entry.id !== undefined && entry.id !== null && entry.id !== '') return String(entry.id);
    if (entry.review && entry.gamePk !== undefined) {
      var rid = entry.review.id !== undefined && entry.review.id !== null && entry.review.id !== ''
        ? entry.review.id
        : (entry.review.atBatIndex !== undefined && entry.review.atBatIndex !== null ? entry.review.atBatIndex : '');
      return entry.gamePk + ':' + rid;
    }
    return null;
  }

  /* Merge two logs without losing rows, baselines or note chains. */
  function mergePayloads(a, b, date) {
    var base = normalize(a, date);
    var add = normalize(b, date);
    var map = Object.create(null);
    var order = [];

    function take(entry, preferNew) {
      var key = entryKey(entry);
      if (!key) return;
      var prev = map[key];
      if (!prev) {
        map[key] = entry;
        order.push(key);
        return;
      }
      var merged = Object.assign({}, prev, entry);
      merged.firstSeen = Math.min(
        Number(prev.firstSeen) || Number(entry.firstSeen) || Date.now(),
        Number(entry.firstSeen) || Number(prev.firstSeen) || Date.now()
      );
      merged.lastSeen = Math.max(Number(prev.lastSeen) || 0, Number(entry.lastSeen) || 0);
      if (prev.review && entry.review) merged.review = Object.assign({}, prev.review, entry.review);
      map[key] = merged;
    }

    base.entries.forEach(function (e) { take(e, false); });
    add.entries.forEach(function (e) { take(e, true); });

    /* Bounded, newest-first list. */
    var mergedEntries = order.map(function (k) { return map[k]; })
      .sort(function (x, y) { return (Number(y.lastSeen) || 0) - (Number(x.lastSeen) || 0); })
      .slice(0, MAX_ENTRIES);

    var snapshots = Object.assign({}, base.snapshots);
    Object.keys(add.snapshots).forEach(function (pk) {
      snapshots[pk] = Object.assign({}, snapshots[pk] || {}, add.snapshots[pk] || {});
    });

    var irregularities = Object.assign({}, base.irregularities);
    Object.keys(add.irregularities).forEach(function (pk) {
      var prevNotes = Array.isArray(irregularities[pk]) ? irregularities[pk] : [];
      var notes = Array.isArray(add.irregularities[pk]) ? add.irregularities[pk] : [];
      var combined = prevNotes.slice();
      notes.forEach(function (n) {
        if (typeof n === 'string' && combined.indexOf(n) === -1) combined.push(n);
      });
      irregularities[pk] = combined.slice(-30);
    });

    var grace = Object.assign({}, base.grace, add.grace);
    var settledSet = Object.create(null);
    base.settled.concat(add.settled).forEach(function (s) { settledSet[s] = true; });

    return {
      v: 1,
      date: date,
      savedAt: Date.now(),
      entries: mergedEntries,
      order: mergedEntries.map(entryKey),
      snapshots: snapshots,
      irregularities: irregularities,
      grace: grace,
      settled: Object.keys(settledSet),
    };
  }

  function loadLocal(date) {
    var raw = storageGet(KEY_PREFIX + date);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return null;
      return normalize(parsed, date);
    } catch (e) {
      global.console && global.console.warn && global.console.warn('[feed-log] dropping malformed local log for ' + date);
      return null;
    }
  }

  function saveLocal(date, payload) {
    var ok = storageSet(KEY_PREFIX + date, JSON.stringify(payload));
    if (ok) {
      var index = readIndex();
      if (index.indexOf(date) === -1) index.push(date);
      writeIndex(index);
    }
    return ok;
  }

  /* --------------------------------------------------------------- server */

  function serverFetch(path, opts) {
    return fetch(path, Object.assign({ cache: 'no-store', credentials: 'same-origin' }, opts || {}))
      .then(function (res) {
        if (!res.ok) {
          var err = new Error('HTTP ' + res.status);
          err.status = res.status;
          throw err;
        }
        return res.json();
      });
  }

  function isStaticHost() {
    var host = (global.location && global.location.hostname) || '';
    return /\.github\.io$/i.test(host);
  }

  function loadServer(date) {
    if (isStaticHost()) {
      apiState.checked = true;
      apiState.available = false;
      return Promise.resolve(null);
    }
    if (apiState.checked && !apiState.available) return Promise.resolve(null);
    return serverFetch('/api/feed-log?date=' + encodeURIComponent(date))
      .then(function (data) {
        apiState.checked = true;
        apiState.available = true;
        return normalize(data, date);
      })
      .catch(function (err) {
        apiState.checked = true;
        apiState.available = false;
        apiState.lastError = err;
        return null;
      });
  }

  /* Load = merge(server, local).  Whichever exists wins nothing; both merge. */
  function load(date) {
    var local = loadLocal(date);
    return loadServer(date).then(function (remote) {
      if (!remote && !local) return emptyPayload(date);
      if (!remote) return local;
      if (!local) {
        saveLocal(date, remote);
        return remote;
      }
      var merged = mergePayloads(remote, local, date);
      saveLocal(date, merged);
      return merged;
    });
  }

  function postNow(date) {
    var payload = pendingPayloads[date];
    if (!payload) return Promise.resolve(null);
    pendingPayloads[date] = null;
    if (apiState.checked && !apiState.available) return Promise.resolve(null);
    return serverFetch('/api/feed-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      apiState.available = true;
      return res;
    }).catch(function (err) {
      apiState.available = false;
      apiState.lastError = err;
      return null;
    });
  }

  /* save() is coalesced to at most one write per second per date. */
  function save(date, payload) {
    var normalized = normalize(payload, date);
    saveLocal(date, normalized);
    pendingPayloads[date] = normalized;
    if (saveTimers[date]) return;
    saveTimers[date] = setTimeout(function () {
      saveTimers[date] = null;
      postNow(date);
    }, WRITE_COALESCE_MS);
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function emit(payload) {
    listeners.forEach(function (fn) {
      try { fn(payload); } catch (e) { global.console && global.console.warn && global.console.warn('[feed-log] listener failed', e); }
    });
  }

  /* Live push: the server streams every accepted write to open pages.  Absent
   * on static hosting — the ordinary poll stays the fallback. */
  function openStream(date) {
    if (typeof global.EventSource !== 'function') return null;
    if (apiState.checked && !apiState.available) return null;
    try {
      stream = new global.EventSource('/api/feed-log/stream?date=' + encodeURIComponent(date));
    } catch (e) {
      return null;
    }
    stream.addEventListener('feed-log', function (evt) {
      try {
        var payload = JSON.parse(evt.data);
        apiState.available = true;
        emit(normalize(payload, date));
      } catch (e) {
        global.console && global.console.warn && global.console.warn('[feed-log] ignoring malformed push frame');
      }
    });
    stream.addEventListener('error', function () {
      /* Browser retries automatically; if the endpoint is missing the stream
       * simply stays closed and the poll keeps the page current. */
      apiState.available = false;
    });
    return stream;
  }

  function closeStream() {
    if (stream) {
      try { stream.close(); } catch (e) { /* ignore */ }
      stream = null;
    }
  }

  global.FeedLog = {
    emptyPayload: emptyPayload,
    normalize: normalize,
    mergePayloads: mergePayloads,
    load: load,
    save: save,
    onChange: onChange,
    openStream: openStream,
    closeStream: closeStream,
    entryKey: entryKey,
    state: apiState,
    MAX_ENTRIES: MAX_ENTRIES,
    KEEP_DATES: KEEP_DATES,
  };
}(window));
