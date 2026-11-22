#!/usr/bin/env node
/* tests/props-provenance-test.mjs — standalone regression check for props.js
 * driver-table per-row official StatsAPI links, historical/final provenance
 * disclosure (U-6), and zero fabricated stat values when inputs are absent.
 *
 * Run: node tests/props-provenance-test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.log('props-provenance-test: SKIPPED (jsdom not installed)');
  process.exit(0);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
  url: 'https://snapquast73-boop.github.io/LIVPBP/game.html?gamePk=824638',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

/* Stub fetch with verbatim shapes verified against statsapi.mlb.com on 2026-11-22 */
window.fetch = async (input) => {
  const url = String(input);
  let body = {};
  if (url.includes('opposingPlayerId=656849')) {
    body = {
      stats: [{
        type: { displayName: 'vsPlayerTotal' },
        splits: [{ stat: { atBats: 8, hits: 3, avg: '.375' } }],
      }],
    };
  } else if (url.includes('/people/682829/stats')) {
    body = {
      stats: [
        { type: { displayName: 'season' }, splits: [{ stat: { avg: '.277', obp: '.351', slg: '.489', atBats: 520 } }] },
        { type: { displayName: 'expectedStatistics' }, splits: [{ stat: { avg: '.281', slg: '.502', woba: '.364' } }] },
        { type: { displayName: 'statSplits' }, splits: [{ split: { code: 'vl' }, stat: { avg: '.260', atBats: 150 } }] },
        {
          type: { displayName: 'gameLog' },
          splits: [
            { date: '2026-08-26', stat: { atBats: 4, hits: 2 } },
            { date: '2026-08-27', stat: { atBats: 4, hits: 1 } },
            { date: '2026-08-28', stat: { atBats: 5, hits: 4 } }, // same-day row must be excluded by beforeDate
          ],
        },
      ],
    };
  } else if (url.includes('/people/656849/stats')) {
    body = {
      stats: [
        { type: { displayName: 'season' }, splits: [{ stat: { avg: '.241', atBats: 410 } }] },
        { type: { displayName: 'expectedStatistics' }, splits: [{ stat: { avg: '.248' } }] },
        { type: { displayName: 'statSplits' }, splits: [{ split: { code: 'vl' }, stat: { avg: '.225', atBats: 110 } }] },
      ],
    };
  }
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
};

for (const script of ['assets/js/api.js', 'assets/js/ui.js', 'assets/js/props.js']) {
  const full = path.join(ROOT, script);
  window.eval(fs.readFileSync(full, 'utf8') + `\n//# sourceURL=${pathToFileURL(full)}`);
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

console.log('[props-provenance-test]');

const liveForecast = await window.Props.getForecast({
  gamePk: 824638,
  batterId: 682829,
  batterName: 'Elly De La Cruz',
  batterHand: 'L',
  pitcherId: 656849,
  pitcherName: 'David Peterson',
  pitcherHand: 'L',
  season: 2026,
  gameDate: '2026-08-28',
  count: { balls: 2, strikes: 1 },
  countKnown: true,
  timesFaced: 1,
  inning: 4,
  half: 'top',
  gameLive: true,
  gameFinal: false,
});

check('all 6 drivers carry official https://statsapi.mlb.com source URLs', () => {
  assert.equal(liveForecast.drivers.length, 6);
  for (const d of liveForecast.drivers) {
    assert.match(d.sourceUrl, /^https:\/\/statsapi\.mlb\.com\/api\/v1(?:\.1)?\//, `driver ${d.key} missing official sourceUrl`);
  }
});

check('rendered <table class="driver-table"> gives every <tr> a clickable official source link', () => {
  const mount = window.document.getElementById('mount');
  mount.innerHTML = window.Props.renderPropsTab(liveForecast);
  const rows = [...mount.querySelectorAll('table.driver-table tbody tr')];
  assert.equal(rows.length, 6, `expected 6 driver rows, got ${rows.length}`);
  for (const tr of rows) {
    const links = [...tr.querySelectorAll('td.src-cell a[href]')];
    assert.ok(links.length >= 1, 'driver row missing td.src-cell link');
    for (const a of links) {
      assert.match(a.getAttribute('href'), /^https:\/\/statsapi\.mlb\.com\/api\/v1(?:\.1)?\//);
    }
  }
  const inlineLinks = [...mount.querySelectorAll('a.driver-src-inline')];
  assert.equal(inlineLinks.length, 2, 'batter and pitcher cards should each link to their official StatsAPI stats endpoint');
});

check('historical/completed game renders explicit U-6 full-season provenance disclosure', () => {
  const mount = window.document.getElementById('mount');
  mount.innerHTML = window.Props.renderPropsTab({ ...liveForecast, gameFinal: true });
  const note = mount.querySelector('.box-note');
  assert.ok(note && /flagged U-6/i.test(note.textContent), 'historical provenance note missing');
  assert.ok(/2026-08-28/.test(note.textContent), 'historical gameDate missing in provenance note');
});

check('same-day gameLog entries are excluded so Form strictly precedes gameDate', () => {
  const formDriver = liveForecast.drivers.find((d) => d.key === 'form');
  assert.ok(formDriver && /3-8/.test(formDriver.detail), `expected 3-8 across 2 prior games, got: ${formDriver && formDriver.detail}`);
});

check('baseline fallback when player IDs are absent leaves unconfirmed stats blank (—) and still links every row', async () => {
  const fallback = await window.Props.getForecast({ gamePk: 824638 });
  const mount = window.document.getElementById('mount');
  mount.innerHTML = window.Props.renderPropsTab(fallback);
  const rows = [...mount.querySelectorAll('table.driver-table tbody tr')];
  assert.equal(rows.length, 1);
  const link = rows[0].querySelector('td.src-cell a[href]');
  assert.ok(link && link.getAttribute('href').startsWith('https://statsapi.mlb.com/api/'));
  const dds = [...mount.querySelectorAll('.props-grid .props-card:nth-child(1) dd')].map((el) => el.textContent.trim());
  assert.deepEqual(dds, ['—', '—', '—', '—', '—'], 'absent batter stats must render as —, never fabricated');
});

dom.window.close();
console.log(`props-provenance-test: ${passed} passed, 0 failed`);
