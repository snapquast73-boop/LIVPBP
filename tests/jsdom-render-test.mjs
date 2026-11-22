#!/usr/bin/env node
/* tests/jsdom-render-test.mjs — end-to-end page render test for the static site.
 *
 * Loads the REAL shipped HTML pages, executes the REAL shipped scripts in a DOM
 * (jsdom), and answers the pages' MLB StatsAPI requests with the fixtures in
 * tests/fixtures/ (values copied verbatim from official api responses captured
 * 2026-11-20 — see docs/verification-report.md). It then asserts that the pages
 * actually render live data, switch tabs, and raise no uncaught errors.
 *
 * jsdom is a dev-only dependency; it is NOT shipped with the site:
 *     npm install --no-save jsdom      # in the repo root, or
 *     npm install --prefix /tmp/jsdom jsdom
 *     NODE_PATH=/tmp/jsdom/node_modules node tests/jsdom-render-test.mjs
 *
 * Add --live to answer the pages from the real https://statsapi.mlb.com instead
 * of the fixtures (needs network; this is the reproducible official-data check).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = (n) => JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', n), 'utf8'));
const LIVE = process.argv.includes('--live');

let JSDOM;
for (const candidate of [process.env.JSDOM_PATH, 'jsdom', '/tmp/jsdo/node_modules/jsdom/lib/api.js', path.join(ROOT, 'node_modules/jsdom/lib/api.js')]) {
  if (!candidate) continue;
  try {
    const mod = await import(candidate);
    JSDOM = mod.JSDOM || (mod.default && mod.default.JSDOM);
    if (JSDOM) break;
  } catch { /* try the next candidate */ }
}
if (!JSDOM) {
  console.error('jsdom-render-test: SKIPPED — jsdom is not installed (npm install --no-save jsdom)');
  process.exit(0);
}

const schedule = FIX('schedule-2026-08-28.json');
const feed = FIX('feed-824638-review.json');
const statuses = FIX('gamestatus.json');

const failures = [];
const passes = [];
function check(name, condition, detail) {
  if (condition) passes.push(name);
  else failures.push(`${name}${detail ? ' — ' + detail : ''}`);
}
function textOf(el) {
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}

/* ---------------------------------------------------------------- fetch stub */
function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

const requested = [];
async function stubFetch(url) {
  const u = String(url);
  requested.push(u);

  if (LIVE) {
    const res = await fetch(u, { headers: { Accept: 'application/json' } });
    return { ok: res.ok, status: res.status, headers: res.headers, json: () => res.json(), text: () => res.text() };
  }

  if (/\/api\/v1\/gameStatus/.test(u)) return jsonResponse(statuses.statuses);
  if (/\/api\/v1\/teams/.test(u)) {
    return jsonResponse({
      teams: [
        { id: 113, name: 'Cincinnati Reds', teamName: 'Reds', abbreviation: 'CIN', teamCode: 'cin', fileCode: 'cin' },
        { id: 112, name: 'Chicago Cubs', teamName: 'Cubs', abbreviation: 'CHC', teamCode: 'chn', fileCode: 'chn' },
        { id: 119, name: 'Los Angeles Dodgers', teamName: 'Dodgers', abbreviation: 'LAD', teamCode: 'lan', fileCode: 'lan' },
        { id: 116, name: 'Detroit Tigers', teamName: 'Tigers', abbreviation: 'DET', teamCode: 'det', fileCode: 'det' },
      ],
    });
  }
  // Schedule (both the hydrated scoreboard call and the lean status sweep).
  if (/\/api\/v1\/schedule/.test(u)) {
    const lean = /fields=/.test(u);
    if (!lean) return jsonResponse(schedule);
    return jsonResponse({
      dates: [
        {
          games: schedule.dates[0].games.map((g) => ({
            gamePk: g.gamePk,
            season: g.season,
            status: g.status,
          })),
        },
      ],
    });
  }
  // Lean per-game status probe used by the game page watcher.
  if (/\/feed\/live\?fields=/.test(u) || /\/feed\/live\?[^]*fields=gameData,status/.test(u)) {
    return jsonResponse({ gameData: { status: feed.gameData.status } });
  }
  if (/\/feed\/live/.test(u)) return jsonResponse(feed);
  if (/\/playByPlay/.test(u)) {
    const lean = /fields=/.test(u);
    if (lean) return jsonResponse({ allPlays: feed.liveData.plays.allPlays, gamePk: feed.gameData.game.pk });
    return jsonResponse({ allPlays: feed.liveData.plays.allPlays, gamePk: feed.gameData.game.pk });
  }
  if (/\/boxscore/.test(u)) {
    return jsonResponse({
      teams: {
        away: { team: { id: 113, name: 'Cincinnati Reds' }, battingOrder: [], players: {}, teamStats: { batting: {}, pitching: {} } },
        home: { team: { id: 112, name: 'Chicago Cubs' }, battingOrder: [], players: {}, teamStats: { batting: {}, pitching: {} } },
      },
    });
  }
  if (/\/linescore/.test(u)) return jsonResponse(feed.liveData.linescore || {});
  if (/\/api\/v1\/people\/\d+\/stats/.test(u)) {
    return jsonResponse({
      stats: [
        {
          type: { displayName: 'season' },
          splits: [{ season: '2026', stat: { avg: '.263', atBats: 628, hits: 165, homeRuns: 8, baseOnBalls: 43, strikeOuts: 58, obp: '.316', slg: '.350', ops: '.666', plateAppearances: 689 } }],
        },
        {
          type: { displayName: 'statSplits' },
          splits: [
            { season: '2026', split: 'vl', stat: { avg: '.255', atBats: 161, hits: 41, homeRuns: 3, baseOnBalls: 9, strikeOuts: 17, obp: '.301', slg: '.373', ops: '.674', plateAppearances: 173 } },
            { season: '2026', split: 'vr', stat: { avg: '.266', atBats: 467, hits: 124, homeRuns: 5, baseOnBalls: 34, strikeOuts: 41, obp: '.322', slg: '.343', ops: '.665', plateAppearances: 516 } },
          ],
        },
      ],
    });
  }
  if (/\/api\/v1\/(?!schedule|gameStatus|teams|people)/.test(u)) return jsonResponse({});
  // Anything else (local persistence endpoints when no server is running).
  return jsonResponse({}, 404);
}

/* ------------------------------------------------------------------- harness */
async function render(pageFile, { query = '', wait = 900, before } = {}) {
  const file = path.join(ROOT, pageFile);
  let html = readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*src\s*=\s*"([^"]+)"[^>]*><\/script>/gi)].map((m) => m[1]);
  html = html.replace(/<script\b[^>]*src\s*=\s*"[^"]+"[^>]*><\/script>/gi, '');

  const errors = [];
  const url = `https://snapquast73-boop.github.io/LIVPBP/${pageFile}${query}`;
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    resources: undefined,
  });
  const { window } = dom;
  window.fetch = (u, init) => stubFetch(u, init);
  window.scrollTo = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.addEventListener('error', (e) => errors.push('window error: ' + (e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => errors.push('unhandled rejection: ' + (e.reason && e.reason.message || e.reason)));
  const origError = window.console.error;
  window.console.error = (...args) => { errors.push('console.error: ' + args.join(' ')); origError.apply(window.console, args); };
  if (before) before(window);

  for (const src of scripts) {
    const local = path.join(ROOT, src);
    try {
      window.eval(readFileSync(local, 'utf8') + `\n//# sourceURL=${pathToFileURL(local)}`);
    } catch (err) {
      errors.push(`script ${src} threw: ${err.message}`);
    }
  }
  if (window.document.readyState !== 'complete') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  }
  window.dispatchEvent(new window.Event('load'));
  await new Promise((r) => setTimeout(r, wait));

  return { dom, window, doc: window.document, errors, close: () => dom.window.close() };
}

/* --------------------------------------------------------------- page tests */
console.log(`jsdom-render-test: ${LIVE ? 'LIVE official API' : 'fixtures'} mode`);

/* 1. Scoreboard */
{
  const { doc, errors, close, window } = await render('index.html');
  const list = doc.querySelector('#game-list');
  const body = textOf(list);
  check('index: #game-list rendered', !!list && list.children.length > 0, `children=${list ? list.children.length : 'missing'}`);
  check('index: game cards shown', (list ? list.querySelectorAll('a,article,div').length : 0) > 1);
  check('index: Reds/Cubs game present', /Reds|CIN/i.test(body) && /Cubs|CHC/i.test(body), body.slice(0, 200));
  check('index: final score 10–8 shown', body.includes('10') && body.includes('8'), body.slice(0, 200));
  check('index: Dodgers/Tigers game present', /Dodgers|LAD/i.test(body) && /Tigers|DET/i.test(body));
  check('index: date label filled', textOf(doc.querySelector('#date-label')).length > 0, textOf(doc.querySelector('#date-label')));
  check('index: filter tabs rendered', doc.querySelectorAll('#tabs button, #tabs .tab-btn, #tabs a').length > 0);
  check('index: date input present', !!doc.querySelector('#date-picker'));
  check('index: stylesheet link resolves', !!doc.querySelector('link[rel="stylesheet"][href="assets/css/style.css"]'));
  check('index: no uncaught errors', errors.length === 0, errors.join(' | '));
  // Tabs are interactive: click each and confirm the page survives + still lists games.
  const tabs = [...doc.querySelectorAll('#tabs button, #tabs .tab-btn')];
  for (const t of tabs.slice(0, 6)) {
    t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 120));
  check('index: tab clicks keep the scoreboard alive', doc.querySelector('#game-list').children.length > 0 && errors.length === 0, errors.join(' | '));
  close();
}

/* 2. Game page */
{
  const { doc, errors, close, window } = await render('game.html', { query: '?gamePk=824638', wait: 1400 });
  const header = textOf(doc.querySelector('.game-header'));
  check('game: header shows both teams', /Reds|CIN/i.test(header) && /Cubs|CHC/i.test(header), header.slice(0, 200));
  check('game: header shows the score', header.includes('10') && header.includes('8'), header.slice(0, 200));
  check('game: team logos requested', /mlbstatic\.com\/team-logos/.test(doc.documentElement.innerHTML));
  const plays = textOf(doc.querySelector('#plays-wrap'));
  check('game: play-by-play rendered', plays.length > 20, plays.slice(0, 160));
  check('game: real play description present', /JJ Bleday singles/.test(plays), plays.slice(0, 200));
  check('game: review chip/entry for the reviewed play', /challenge|review/i.test(textOf(doc.querySelector('#panel-plays, #plays-wrap'))));
  check('game: linescore rendered', textOf(doc.querySelector('#linescore-wrap')).length > 0);
  const tabs = [...doc.querySelectorAll('.tabs-game .tab-btn')];
  check('game: four game tabs present', tabs.length === 4, `found ${tabs.length}`);
  for (const t of tabs) t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  check('game: box score tab renders', textOf(doc.querySelector('#boxscore-wrap')).length > 0);
  check('game: props tab renders', textOf(doc.querySelector('#props-wrap')).length > 0);
  check('game: reviews tab renders', textOf(doc.querySelector('#reviews-wrap')).length > 0);
  const loading = doc.querySelector('#loading');
  check('game: loading overlay cleared', !loading || !/(^|\s)show(\s|$)/.test(loading.className) || loading.hidden === true || loading.style.display === 'none', loading ? `class=${loading.className} display=${loading.style.display}` : 'element removed');
  check('game: no uncaught errors', errors.length === 0, errors.join(' | '));
  close();
}

/* 3. Replay feed */
{
  const { doc, errors, close, window } = await render('reviews.html', { wait: 1600 });
  const feedText = textOf(doc.querySelector('#feed-list'));
  check('reviews: feed rendered', feedText.length > 0, feedText.slice(0, 160));
  check('reviews: reviewed play surfaced', /Hit by pitch|challenge|review/i.test(feedText), feedText.slice(0, 200));
  check('reviews: tabs rendered', doc.querySelectorAll('#feed-tabs button, #feed-tabs .tab-btn, #feed-tabs a').length > 0);
  check('reviews: summary stats rendered', textOf(doc.querySelector('#feed-stats')).length > 0);
  check('reviews: sound toggle present', !!doc.querySelector('#sound-toggle-btn'));
  check('reviews: notification toggle present', !!doc.querySelector('#notify-toggle-btn'));
  check('reviews: countdown element present', !!doc.querySelector('#countdown'));
  check('reviews: live indicator present', !!doc.querySelector('#live-dot'));
  for (const t of [...doc.querySelectorAll('#feed-tabs button, #feed-tabs .tab-btn')].slice(0, 8)) {
    t.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 150));
  check('reviews: no uncaught errors', errors.length === 0, errors.join(' | '));
  check('reviews: sound toggle does not throw', (() => {
    const btn = doc.querySelector('#sound-toggle-btn');
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    return errors.length === 0;
  })(), errors.join(' | '));
  close();
}

/* 3b. ?date= deep links — regression coverage (the param used to be ignored,
 *     so a shared link always opened today, which is empty in the offseason) */
{
  const before = requested.length;
  const { doc, errors, close } = await render('index.html', { query: '?date=2026-08-28', wait: 900 });
  const label = textOf(doc.querySelector('#date-label'));
  check('index?date=: label shows the requested date', /Aug 28, 2026/.test(label), label);
  check('index?date=: picker holds the requested date', (doc.querySelector('#date-picker') || {}).value === '2026-08-28', String((doc.querySelector('#date-picker') || {}).value));
  check('index?date=: schedule fetched with date=2026-08-28', requested.slice(before).some((u) => /[?&]date=2026-08-28(&|$)/.test(u)), requested.slice(before).join(' '));
  check('index?date=: no uncaught errors', errors.length === 0, errors.join(' | '));
  close();
}
{
  const before = requested.length;
  const { doc, errors, close } = await render('reviews.html', { query: '?date=2026-08-28', wait: 1600 });
  const picker = (doc.querySelector('#date-picker') || {}).value;
  const status = textOf(doc.querySelector('#status-line'));
  check('reviews?date=: picker holds the requested date', picker === '2026-08-28', String(picker));
  check('reviews?date=: schedule fetched with date=2026-08-28', requested.slice(before).some((u) => /[?&]date=2026-08-28(&|$)/.test(u)), requested.slice(before).join(' '));
  check('reviews?date=: status line names the requested date', /Aug 28, 2026/.test(status), status);
  check('reviews?date=: no uncaught errors', errors.length === 0, errors.join(' | '));
  close();
}
{
  const { doc, errors, close } = await render('reviews.html', { query: '?date=not-a-date', wait: 400 });
  const picker = (doc.querySelector('#date-picker') || {}).value;
  check('reviews?date=garbage: falls back to a valid ISO date', /^\d{4}-\d{2}-\d{2}$/.test(picker || ''), String(picker));
  check('reviews?date=garbage: no uncaught errors', errors.length === 0, errors.join(' | '));
  close();
}

/* 4. 404 */
{
  const { doc, errors, close } = await render('404.html', { wait: 100 });
  check('404: message rendered', /404/.test(textOf(doc.body)));
  check('404: back link present', !!doc.querySelector('a[href="index.html"]'));
  check('404: no uncaught errors', errors.length === 0, errors.join(' | '));
  close();
}

console.log(`jsdom-render-test: ${passes.length} checks passed`);
if (failures.length) {
  console.error(`jsdom-render-test: ${failures.length} check(s) FAILED`);
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('jsdom-render-test: OK');
