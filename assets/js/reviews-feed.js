(() => {
  'use strict';
  let selected = UI.selectedDate(), games = [], generation = 0, filter = 'all', initial = true;
  let lastScan = new Map(), recentFinals = new Map(), seenLive = new Set(), failures = new Map();
  let audio, lastChime = 0, unsubscribe = () => {};
  const root = document.getElementById('feed-list');
  function preference(key, fallback = false) {
    try { return localStorage.getItem(key) === 'true' || (localStorage.getItem(key) === null && fallback); } catch (_) { return fallback; }
  }
  function store(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) { /* Browser storage can be disabled. */ } }
  let sound = preference('mlbReplaySound'), notifications = preference('mlbReplayNotifications');
  function alertUI() {
    const soundButton = document.getElementById('sound-toggle-btn');
    soundButton.textContent = sound ? '🔊 Sound On' : '🔇 Sound Off';
    soundButton.setAttribute('aria-pressed', String(sound));
    const notify = document.getElementById('notify-toggle-btn');
    const on = notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    notify.textContent = on ? '🔴 Run Alerts On' : '⚪ Run Alerts Off';
    notify.setAttribute('aria-pressed', String(on));
  }
  async function chime() {
    if (!sound || Date.now() - lastChime < 2500) return;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    audio ??= new Context();
    if (audio.state !== 'running') return; // Never bypass browser autoplay consent.
    lastChime = Date.now();
    const tone = (offset, hz, duration, volume, drop = false) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + offset;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(hz, start);
      if (drop) oscillator.frequency.exponentialRampToValueAtTime(hz * .55, start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(start); oscillator.stop(start + duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    [0, .2, .4].forEach((offset, index) => tone(offset, 780 - index * 90, .2, .045, true));
    tone(.52, 523.25, .65, .025); tone(.62, 659.25, .55, .02);
  }
  function announce(rows) {
    if (initial) return;
    if (rows.some(entry => Reviews.shouldAlert(entry.review))) chime().catch(error => console.warn('Sound unavailable:', error));
    if (!notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    rows.filter(entry => entry.review.runsAtRisk).forEach(entry => {
      try {
        const notice = new Notification('MLB review — runs at risk', { body: `${entry.matchupLabel}: official scoring movement on the reviewed event. Outcome unverified.`, tag: `${entry.gamePk}:${entry.review.id}` });
        notice.onclick = () => { window.focus(); location.href = UI.gameHref(entry.gamePk, selected); notice.close(); };
      } catch (error) { console.warn('Desktop notifications unavailable:', error); }
    });
  }
  function rowsFor(key, entries) {
    return entries.filter(entry => {
      const row = entry.review;
      if (key === 'all') return Reviews.visibleInAll(row);
      if (key === 'active') return row.inProgress === true;
      if (key === 'risk') return Boolean(row.runsAtRisk) && row.inProgress === true;
      return row.typeKey === key;
    });
  }
  function render() {
    const log = FeedLog.read(selected), entries = log.entries;
    const tabs = [['all', 'All'], ['abs', 'ABS'], ['challenge', 'Challenges'], ['review', 'Reviews'], ['boundary', 'Boundary Calls'], ['active', 'Under Review'], ['risk', '⚠ Runs at Risk'], ['pending', 'Scoring Pending'], ['scoring', '✏ Scoring Changes']];
    document.getElementById('feed-tabs').innerHTML = tabs.map(([key, label]) => `<button class="tab-btn${filter === key ? ' tab-on' : ''}" data-filter="${key}" aria-pressed="${filter === key}">${label} <span class="tab-badge">${rowsFor(key, entries).length}</span></button>`).join('');
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; render(); }));
    document.getElementById('feed-stats').innerHTML = [['all', 'Observed events (excluding ABS)'], ['abs', 'ABS challenges'], ['active', 'Under review / pending'], ['risk', 'Runs-at-risk reviews']].map(([key, label]) => `<div class="summary-item"><strong>${rowsFor(key, entries).length}</strong><span>${label}</span>${UI.source(MLB.scheduleURL(selected), 'Schedule')}</div>`).join('');
    const visible = rowsFor(filter, entries);
    const notes = Object.entries(log.irregularities).flatMap(([pk, items]) => (Array.isArray(items) ? items : []).map(note => `<p>${UI.escape(note)} <a href="${UI.gameHref(pk, selected)}">Game</a> · ${UI.source(MLB.gameURL(pk))}</p>`));
    root.innerHTML = visible.length ? visible.map(entry => Reviews.render(entry, selected)).join('') : `<div class="empty-state"><h2>${initial ? 'Loading official replay records…' : 'No matching official records observed'}</h2><p>${filter === 'all' ? 'As in the uploaded project, routine ABS pitch challenges are kept in the ABS tab, not All. ' : ''}${failures.size ? 'Some games could not be checked; the result is incomplete.' : 'Records appear only when MLB supplies review details or a scoring change is actually observed.'}</p><p>${UI.source(MLB.scheduleURL(selected), 'Official schedule')}</p></div>`;
    if (notes.length) root.insertAdjacentHTML('beforeend', `<section class="panel"><h2>Flagged observations</h2>${notes.join('')}<a href="flagged-for-review.html">Flagged for Review →</a></section>`);
    const active = games.filter(game => Reviews.activeStatus(game.status));
    document.getElementById('active-strip').innerHTML = active.length ? `<h2>🚨 Official under-review status</h2>${active.map(game => `<p><a href="${UI.gameHref(game.gamePk, selected)}">${UI.teamName(game.teams?.away?.team)} @ ${UI.teamName(game.teams?.home?.team)}</a> · ${UI.escape(game.status.detailedState)}${game.status.reason ? ` · ${UI.escape(game.status.reason)}` : ''} · ${UI.source(MLB.scheduleURL(selected), 'Status')}</p>`).join('')}` : '';
    const risks = rowsFor('risk', entries);
    if (risks.length) UI.setBanner(`<strong>⚠ Runs at risk</strong> — MLB credits scoring movements to an event now under review. Alternate scores and the ruling are unverified, not predicted. ${risks.map(entry => `<a href="${UI.gameHref(entry.gamePk, selected)}">${UI.escape(entry.matchupLabel)}</a>`).join(' · ')}`, 'banner-danger');
    else if (failures.size) UI.setBanner(`Some official game feeds could not be checked: ${[...failures].map(([pk, message]) => `${UI.source(MLB.gameURL(pk), `Game ${pk}`)} — ${UI.escape(message)}`).join('; ')}. Results are incomplete; retrying automatically.`, 'banner-danger');
    else UI.setBanner();
  }
  function due(game) {
    if (!lastScan.has(game.gamePk)) return UI.state(game.status) !== 'preview';
    if (UI.state(game.status) === 'live') return true;
    return recentFinals.has(game.gamePk) && Date.now() - recentFinals.get(game.gamePk) < 30 * 60000;
  }
  async function scan(game, version, date) {
    try {
      const payload = await MLB.replay(game.gamePk);
      if (version !== generation) return;
      if (!payload.gameData || !Array.isArray(payload.liveData?.plays?.allPlays)) throw new Error('Official play-by-play is missing — unverified.');
      const log = FeedLog.read(date);
      const beforeRisks = new Set(log.entries.filter(entry => entry.review.runsAtRisk).map(entry => `${entry.gamePk}:${entry.review.id}`));
      const added = Reviews.observe(log, payload, game.gamePk);
      const newlyRisky = log.entries.filter(entry => entry.review.runsAtRisk && !beforeRisks.has(`${entry.gamePk}:${entry.review.id}`));
      const notices = new Map([...added, ...newlyRisky].map(entry => [`${entry.gamePk}:${entry.review.id}`, entry]));
      FeedLog.save(log);
      lastScan.set(game.gamePk, Date.now()); failures.delete(game.gamePk);
      announce([...notices.values()]); render();
    } catch (error) { if (version === generation) { failures.set(game.gamePk, error.message); render(); } }
  }
  async function update() {
    const version = generation, date = selected;
    document.getElementById('refresh-btn').disabled = true;
    try {
      const payload = await MLB.schedule(date);
      if (version !== generation) return 1000;
      if (!Array.isArray(payload.dates)) throw new Error('Official schedule is missing — no results inferred.');
      games = payload.dates.flatMap(day => day.games ?? []).filter(game => Number.isSafeInteger(game.gamePk));
      games.forEach(game => {
        if (UI.state(game.status) === 'live') seenLive.add(game.gamePk);
        else if (UI.state(game.status) === 'final' && seenLive.has(game.gamePk) && !recentFinals.has(game.gamePk)) recentFinals.set(game.gamePk, Date.now());
      });
      const queue = games.filter(due).sort((a, b) => Number(Boolean(Reviews.activeStatus(b.status))) - Number(Boolean(Reviews.activeStatus(a.status))));
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (cursor < queue.length && version === generation) await scan(queue[cursor++], version, date);
      }));
      if (version !== generation) return 1000;
      initial = false; render();
      const status = `${games.length} scheduled games · ${lastScan.size} official feeds checked · ${failures.size} unavailable · Updated ${new Date().toLocaleTimeString()} · Counts describe observed records, not a complete scoring-change archive`;
      UI.setStatus(status);
      document.getElementById('live-dot').classList.toggle('offline', failures.size > 0);
      // Coalesce backend writes to one per completed scan; Pages uses only localStorage.
      FeedLog.sync(date, true).catch(error => console.warn(error.message));
      return games.some(game => UI.state(game.status) === 'live') || recentFinals.size || failures.size ? 10000 : 60000;
    } catch (error) {
      if (version !== generation) return 1000;
      UI.setBanner(`${UI.escape(error.message)} The feed is incomplete; previous observations may be stale. <button class="btn" onclick="ReplayFeed.refresh()">Retry</button>`, 'banner-danger');
      UI.setStatus('Official schedule could not be checked. No missing records have been invented.');
      document.getElementById('live-dot').classList.add('offline');
      initial = false;
      return Math.max(30000, MLB.cooldown());
    } finally { document.getElementById('refresh-btn').disabled = false; }
  }
  const poller = UI.poll(update);
  const owner = { refresh() { lastScan = new Map(); poller.refresh(); } };
  window.ReplayFeed = owner;
  const applyDate = UI.dateControls(owner, () => selected, next => {
    selected = next; generation++; initial = true; games = []; lastScan = new Map(); recentFinals = new Map(); seenLive = new Set(); failures = new Map();
    unsubscribe(); render();
    const version = generation;
    FeedLog.sync(next).then(() => { if (version === generation) render(); }).catch(error => console.warn(error.message));
    FeedLog.subscribe(next, render).then(close => { if (version === generation) unsubscribe = close; else close(); });
    poller.refresh();
  });
  document.getElementById('refresh-btn').addEventListener('click', owner.refresh);
  document.getElementById('sound-toggle-btn').addEventListener('click', async () => {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) { UI.setBanner('This browser does not support Web Audio. Sound remains off.'); return; }
    try {
      audio ??= new Context(); await audio.resume(); sound = !sound;
      store('mlbReplaySound', sound); alertUI();
      if (sound) await chime();
    } catch (error) { sound = false; alertUI(); UI.setBanner(`Sound is unavailable: ${UI.escape(error.message)}`); }
  });
  document.getElementById('notify-toggle-btn').addEventListener('click', async () => {
    if (typeof Notification === 'undefined' || !window.isSecureContext) { UI.setBanner('Desktop notifications are not supported here. Run alerts remain off.'); return; }
    if (notifications && Notification.permission === 'granted') notifications = false;
    else {
      try { notifications = await Notification.requestPermission() === 'granted'; }
      catch (_) { notifications = false; }
      if (!notifications) UI.setBanner('Notification permission was not granted. No desktop alerts will be sent.');
    }
    store('mlbReplayNotifications', notifications); alertUI();
  });
  FeedLog.onChange(date => { if (date === selected) render(); });
  MLB.registry().then(rows => { Reviews.setRegistry(rows); render(); }).catch(error => console.warn('Review registry unavailable:', error.message));
  alertUI(); applyDate(selected);
})();
