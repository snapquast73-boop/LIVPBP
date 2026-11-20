/* Shared, escaped rendering and non-overlapping, visibility-aware polling. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const reported = value => (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.trim() !== '' && !['--', '-.--', '.---', 'NaN'].includes(value));
  const value = input => reported(input) ? escape(input) : '';
  const cell = input => reported(input) ? `<td>${value(input)}</td>` : '<td class="unverified" data-unverified="true" title="Not reported by MLB — unverified" aria-label="Not reported by MLB — unverified"></td>';
  function source(target, label = 'Official MLB source') {
    const checked = new URL(target);
    if (checked.protocol !== 'https:' || !['statsapi.mlb.com', 'www.mlb.com', 'www.mlbstatic.com', 'img.mlbstatic.com', 'docs.github.com', 'github.com', 'api.github.com'].includes(checked.hostname)) {
      throw new Error('An official source link is required.');
    }
    return `<a class="source-link" href="${escape(checked.href)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
  }
  function table(caption, headers, rows, target) {
    return `<div class="table-scroll"><table><caption>${escape(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}<th scope="col">${source(target, 'Source')}</th></tr></thead><tbody>${rows.map(row => `<tr>${row.join('')}<td>${source(target, 'MLB')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function logo(team) {
    if (!Number.isSafeInteger(team?.id) || team.id < 1) return '';
    return `<img class="team-logo" src="https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg" alt="" loading="lazy" width="40" height="40" onerror="this.hidden=true">`;
  }
  const teamName = team => escape(team?.name ?? 'Team name not reported');
  const shortName = team => escape(team?.abbreviation ?? team?.name ?? '');
  const record = input => reported(input?.wins) && reported(input?.losses) ? `${value(input.wins)}–${value(input.losses)}` : '';
  function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function selectedDate() {
    const input = new URLSearchParams(location.search).get('date');
    return MLB.validDate(input) ? input : localDate();
  }
  function shiftDate(input, days) {
    if (!MLB.validDate(input)) return localDate();
    const next = new Date(`${input}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }
  const dateLabel = input => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${input}T12:00:00Z`));
  function time(input) {
    const date = new Date(input);
    return Number.isFinite(date.getTime()) ? escape(new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)) : '';
  }
  function gameHref(gamePk, date) { return `game.html?gamePk=${MLB.id(gamePk)}${MLB.validDate(date) ? `&date=${date}` : ''}`; }
  function state(status) {
    if (status?.abstractGameState === 'Live') return 'live';
    if (status?.abstractGameState === 'Final') return 'final';
    if (status?.abstractGameState === 'Preview') return 'preview';
    return 'unknown';
  }
  function status(status, linescore) {
    let text = escape(status?.detailedState ?? 'Status not reported');
    if (state(status) === 'live' && reported(linescore?.currentInning)) {
      text += ` · ${escape(linescore.inningState ?? '')} ${value(linescore.currentInningOrdinal ?? linescore.currentInning)}`;
    }
    return `<span class="game-state state-${state(status)}">${state(status) === 'live' ? '<span class="live-dot"></span>' : ''}${text}</span>`;
  }
  function bases(linescore) {
    const offense = linescore?.offense;
    if (!offense) return '<span class="muted">Runners not reported — unverified</span>';
    return `<div class="base-state" aria-label="Official baserunners">${['first', 'second', 'third'].map((base, i) => `<span class="base${offense[base] ? ' occupied' : ''}" title="${i + 1}: ${escape(offense[base]?.fullName ?? 'No runner reported')}">${i + 1}</span>`).join('')}</div>`;
  }
  function error(target, error, retry = '') {
    target.innerHTML = `<div class="empty-state error-state" role="alert"><h2>Official data unavailable</h2><p>${escape(error.message)}</p>${retry}<p>No scores or statistics have been substituted. <a href="flagged-for-review.html#data">Verification policy</a></p></div>`;
  }
  function setBanner(message = '', kind = '') {
    const banner = document.getElementById('banner');
    if (!banner) return;
    banner.innerHTML = message;
    banner.className = `banner ${message ? `banner-visible ${kind}` : ''}`;
  }
  function setStatus(message) {
    const line = document.getElementById('status-line');
    if (line) line.textContent = message;
  }
  function dateControls(owner, getDate, setDate) {
    const picker = document.getElementById('date-picker');
    function apply(next) {
      if (!MLB.validDate(next)) { picker.value = getDate(); return; }
      picker.value = next;
      const label = document.getElementById('date-label');
      if (label) label.textContent = dateLabel(next);
      const target = new URL(location.href);
      target.searchParams.set('date', next);
      history.replaceState(null, '', target);
      document.querySelectorAll('[data-date-link]').forEach(link => { link.href = `${link.dataset.dateLink}?date=${next}`; });
      setDate(next);
    }
    owner.prevDay = () => apply(shiftDate(getDate(), -1));
    owner.nextDay = () => apply(shiftDate(getDate(), 1));
    owner.today = () => apply(localDate());
    owner.pickDate = () => apply(picker.value);
    return apply;
  }
  function poll(task, fallback = 10000) {
    let timer, busy = false, rerun = false, stopped = false, nextAt = 0;
    const countdown = document.getElementById('countdown');
    const tick = setInterval(() => {
      if (countdown) countdown.textContent = document.hidden ? 'Paused while hidden' : busy ? 'Updating…' : `Refresh in ${Math.max(0, Math.ceil((nextAt - Date.now()) / 1000))}s`;
    }, 1000);
    async function run() {
      clearTimeout(timer);
      if (stopped || document.hidden) return;
      if (busy) { rerun = true; return; }
      busy = true;
      let delay = fallback;
      try { delay = await task() || fallback; }
      catch (err) { console.warn('Update failed:', err); }
      finally {
        busy = false;
        if (!stopped) {
          nextAt = Date.now() + Math.max(MLB.cooldown(), rerun ? 0 : delay);
          rerun = false;
          timer = setTimeout(run, Math.max(0, nextAt - Date.now()));
        }
      }
    }
    const visibility = () => { if (document.hidden) clearTimeout(timer); else run(); };
    document.addEventListener('visibilitychange', visibility);
    return { refresh: run, stop() { stopped = true; clearTimeout(timer); clearInterval(tick); document.removeEventListener('visibilitychange', visibility); } };
  }
  window.UI = Object.freeze({ escape, reported, value, cell, source, table, logo, teamName, shortName, record, localDate, selectedDate, shiftDate, dateLabel, time, gameHref, state, status, bases, error, setBanner, setStatus, dateControls, poll });
})();
