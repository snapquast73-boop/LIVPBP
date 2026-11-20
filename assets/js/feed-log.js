/* Browser-local observation logs; optional same-origin Node persistence, never required by Pages. */
(() => {
  'use strict';
  const PREFIX = 'mlbReplayFeedLog.v2.';
  const cache = new Map();
  const listeners = new Set();
  let capability;
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const empty = date => ({ v: 1, date, savedAt: 0, entries: [], order: [], snapshots: {}, irregularities: {}, grace: {}, settled: [] });
  function clean(input, date) {
    const result = empty(date);
    if (!plain(input) || input.v !== 1 || input.date !== date) return result;
    result.savedAt = typeof input.savedAt === 'number' ? input.savedAt : 0;
    result.entries = (Array.isArray(input.entries) ? input.entries : []).filter(entry =>
      plain(entry) && Number.isSafeInteger(entry.gamePk) && entry.gamePk > 0 && plain(entry.review) &&
      typeof entry.review.id === 'string' && entry.review.id.length < 150 && typeof entry.review.typeKey === 'string' &&
      typeof entry.firstSeen === 'number' && Number.isFinite(entry.firstSeen) && typeof entry.lastSeen === 'number' && Number.isFinite(entry.lastSeen)
    ).slice(0, 500).map(entry => ({ ...entry, review: { ...entry.review,
      flags: Array.isArray(entry.review.flags) ? entry.review.flags.filter(flag => typeof flag === 'string').slice(-30) : [] } }));
    for (const field of ['snapshots', 'irregularities', 'grace']) {
      if (!plain(input[field])) continue;
      for (const [key, value] of Object.entries(input[field])) {
        if (/^\d+$/.test(key) && key.length < 15) result[field][key] = value;
      }
    }
    result.settled = Array.isArray(input.settled) ? input.settled.filter(value => Number.isSafeInteger(value)) : [];
    return result;
  }
  function merge(existing, incoming) {
    const result = clean(existing, existing.date);
    const next = clean(incoming, existing.date);
    const entries = new Map(result.entries.map(entry => [`${entry.gamePk}:${entry.review.id}`, entry]));
    next.entries.forEach(entry => {
      const key = `${entry.gamePk}:${entry.review.id}`;
      const old = entries.get(key);
      if (!old || entry.lastSeen > old.lastSeen) entries.set(key, entry);
    });
    result.entries = [...entries.values()].sort((a, b) => b.firstSeen - a.firstSeen || b.review.atBatIndex - a.review.atBatIndex).slice(0, 500);
    // Never replace a newer browser's baseline with a stale shared snapshot.
    if (next.savedAt > result.savedAt) result.snapshots = { ...result.snapshots, ...next.snapshots };
    Object.keys(next.irregularities).forEach(key => {
      result.irregularities[key] = [...new Set([...(Array.isArray(result.irregularities[key]) ? result.irregularities[key] : []), ...(Array.isArray(next.irregularities[key]) ? next.irregularities[key] : [])])].filter(note => typeof note === 'string').slice(-30);
    });
    result.savedAt = Math.max(result.savedAt, next.savedAt);
    return result;
  }
  function read(date) {
    if (!MLB.validDate(date)) throw new Error('Invalid feed-log date.');
    if (cache.has(date)) return cache.get(date);
    let input;
    try { input = JSON.parse(localStorage.getItem(PREFIX + date) ?? 'null'); }
    catch (error) { console.warn('Unreadable local observation log; no data guessed.', error); }
    const log = clean(input, date);
    cache.set(date, log);
    return log;
  }
  function save(log) {
    const result = clean(log, log.date);
    cache.set(log.date, result);
    try {
      localStorage.setItem(PREFIX + log.date, JSON.stringify(result));
      const dates = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX)) dates.push(key.slice(PREFIX.length));
      }
      dates.sort().reverse().slice(7).forEach(date => localStorage.removeItem(PREFIX + date));
    } catch (error) { console.warn('Observation persistence unavailable in this browser.', error); }
    listeners.forEach(listener => listener(log.date));
    return result;
  }
  async function backend() {
    if (capability !== undefined) return capability;
    capability = (async () => {
      if (!/^https?:$/.test(location.protocol)) return false;
      try {
        const response = await fetch(new URL('index.html', document.baseURI), { method: 'HEAD', signal: AbortSignal.timeout(4000) });
        return response.ok && response.headers.get('X-MLB-Feed-Log') === '1';
      } catch (_) { return false; }
    })();
    return capability;
  }
  function endpoint(date, stream = false) {
    const target = new URL(`api/feed-log${stream ? '/stream' : ''}`, document.baseURI);
    target.searchParams.set('date', date);
    return target.href;
  }
  async function sync(date, write = false) {
    if (!await backend()) return read(date);
    const response = await fetch(endpoint(date), write ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(read(date)), signal: AbortSignal.timeout(8000)
    } : { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Shared observation log unavailable (HTTP ${response.status}).`);
    if (write) return read(date);
    return save(merge(read(date), await response.json()));
  }
  async function subscribe(date, onChange) {
    if (!await backend() || typeof EventSource === 'undefined') return () => {};
    const stream = new EventSource(endpoint(date, true));
    let failures = 0;
    stream.addEventListener('feed-log', event => {
      try { save(merge(read(date), JSON.parse(event.data))); failures = 0; onChange?.(); }
      catch (error) { console.warn('Invalid shared observation ignored.', error); }
    });
    stream.onerror = () => { if (++failures >= 3) stream.close(); };
    return () => stream.close();
  }
  if (typeof addEventListener === 'function') addEventListener('storage', event => {
    if (!event.key?.startsWith(PREFIX) || !event.newValue) return;
    const date = event.key.slice(PREFIX.length);
    if (!MLB.validDate(date)) return;
    try { cache.set(date, merge(read(date), JSON.parse(event.newValue))); listeners.forEach(listener => listener(date)); }
    catch (_) { console.warn('Invalid cross-tab observation ignored.'); }
  });
  window.FeedLog = Object.freeze({ empty, clean, merge, read, save, sync, subscribe, onChange: listener => { listeners.add(listener); return () => listeners.delete(listener); } });
})();
