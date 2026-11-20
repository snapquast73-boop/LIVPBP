'use strict';
const UI = (() => {
  const byId = id => document.getElementById(id);
  function node(tag, text, cls) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function link(label, href) {
    const el = node('a', label);
    el.href = href;
    return el;
  }
  const validId = id => /^\d+$/.test(String(id));
  const gameLink = id => `game.html?gamePk=${encodeURIComponent(id)}`;
  const live = status => status?.abstractGameState === 'Live';
  function row(table, values, source) {
    const tr = node('tr');
    let missing = false;
    for (const value of values) {
      const cell = node('td', value);
      if (value == null || value === '') {
        missing = true;
        cell.className = 'unverified';
        cell.title = 'Unverified: not supplied by MLB';
        cell.setAttribute('aria-label', cell.title);
      }
      tr.append(cell);
    }
    const refs = node('td');
    refs.append(link('MLB source', source));
    if (missing) refs.append(' · blank fields unverified');
    tr.append(refs);
    table.tBodies[0].append(tr);
  }
  function table(headers) {
    const el = node('table');
    const head = el.createTHead().insertRow();
    for (const label of [...headers, 'Source']) {
      const th = node('th', label);
      th.scope = 'col';
      head.append(th);
    }
    el.createTBody();
    return el;
  }
  function tabs(wrap, choices, selected, pick) {
    wrap.replaceChildren(...choices.map(label => {
      const button = node('button', label, `tab-btn${selected === label ? ' tab-on' : ''}`);
      button.setAttribute('aria-pressed', label === selected);
      button.onclick = () => pick(label);
      return button;
    }));
  }
  const eastern = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'});
  const today = () => {
    const parts = Object.fromEntries(eastern.formatToParts().map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  function dateNav(onChange) {
    const input = byId('date-picker');
    const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    const set = value => {
      if (!valid(value)) return;
      input.value = value;
      byId('date-label').textContent = new Intl.DateTimeFormat('en-US', {dateStyle:'full', timeZone:'UTC'}).format(new Date(value));
      const url = new URL(location.href);
      url.searchParams.set('date', value);
      history.replaceState(null, '', url);
      onChange(value);
    };
    const move = offset => {
      const date = new Date(valid(input.value) ? input.value : today());
      date.setUTCDate(date.getUTCDate() + offset);
      set(date.toISOString().slice(0, 10));
    };
    const initial = new URLSearchParams(location.search).get('date');
    set(valid(initial) ? initial : today());
    return {today: () => set(today()), pickDate: () => set(input.value), prevDay: () => move(-1), nextDay: () => move(1)};
  }
  // No overlapping requests for a page. A changed date invalidates pending renders.
  function poll(load, render, report, interval) {
    let key, revision = 0, timer, busy = false;
    async function tick() {
      clearTimeout(timer);
      if (key == null || busy) return;
      busy = true;
      const active = revision;
      let wait;
      try {
        const data = await load(key);
        if (active === revision) {
          render(data, key);
          report('');
          wait = interval(data, key);
        }
      } catch (err) {
        if (active === revision) report(err.message);
        wait = 15000;
      } finally {
        busy = false;
        if (active !== revision) void tick();
        else if (wait != null) timer = setTimeout(tick, wait);
      }
    }
    return {set(value) { key = value; revision++; void tick(); }, refresh: tick};
  }
  return {byId, node, link, validId, gameLink, live, table, row, tabs, dateNav, today, poll};
})();
