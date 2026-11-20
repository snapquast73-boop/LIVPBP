'use strict';
const UI = (() => {
  const byId = id => document.getElementById(id);
  function node(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value ?? '';
    if (className) element.className = className;
    return element;
  }
  function link(label, href) {
    const element = node('a', label);
    element.href = href;
    return element;
  }
  const official = path => link('MLB source', MLB.source(path));
  function table(headers, rows, path) {
    const result = node('table');
    const head = result.createTHead().insertRow();
    [...headers, 'Source'].forEach(label => {
      const th = node('th', label);
      th.scope = 'col';
      head.append(th);
    });
    const body = result.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      row.forEach(value => {
        const td = tr.insertCell();
        td.textContent = value ?? '';
        if (value == null || value === '') {
          td.title = 'Unverified: not supplied by MLB';
          td.className = 'unverified';
          td.setAttribute('aria-label', td.title);
        }
      });
      tr.insertCell().append(official(path));
    }
    const wrapper = node('div', '', 'table-scroll');
    wrapper.append(result);
    return wrapper;
  }
  function dates(onChange) {
    const picker = byId('date-picker');
    const todayDate = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'})
      .formatToParts(new Date()).filter(part => part.type !== 'literal').reduce((parts, part) => ({...parts, [part.type]: part.value}), {});
    function pickDate() {
      if (!picker.value) return;
      byId('date-label').textContent = picker.value;
      history.replaceState(null, '', `?date=${picker.value}`);
      onChange(picker.value);
    }
    function today() {
      const {year, month, day} = todayDate();
      picker.value = `${year}-${month}-${day}`;
      pickDate();
    }
    function move(amount) {
      if (!picker.value) return today();
      const date = new Date(`${picker.value}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + amount);
      picker.value = date.toISOString().slice(0, 10);
      pickDate();
    }
    function start() {
      picker.value = new URLSearchParams(location.search).get('date') ?? '';
      if (picker.value) pickDate(); else today();
    }
    return {pickDate, today, prevDay: () => move(-1), nextDay: () => move(1), start};
  }
  function poll(load, interval = 15000) {
    let current, timeout;
    return async function refresh() {
      current?.abort();
      clearTimeout(timeout);
      const controller = current = new AbortController();
      try {
        await load(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) byId('status-line').textContent = `${error.message} Data may be unavailable or stale.`;
      } finally {
        if (controller === current) timeout = setTimeout(refresh, interval);
      }
    };
  }
  const gameLink = (id, date) => `game.html?gamePk=${encodeURIComponent(id)}${date ? `&date=${encodeURIComponent(date)}` : ''}`;
  return {byId, node, link, official, table, dates, poll, gameLink};
})();
