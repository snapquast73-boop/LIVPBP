const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, ResourceLoader, VirtualConsole} = require('jsdom');
const origin = 'https://example.test/LIVPBP/';
const date = '2025-10-25';
const id = 813026;
const away = {id:119, name:'Los Angeles Dodgers'};
const home = {id:141, name:'Toronto Blue Jays'};
const status = {abstractGameState:'Final', detailedState:'Final'};
const plays = [{about:{inning:8, halfInning:'top'}, result:{description:'Test play'}, reviewDetails:{reviewType:'MA', isOverturned:false, challengeTeamId:141},
  playEvents:[{isPitch:true, pitchNumber:1, details:{description:'Ball'}}]}];
const schedule = {dates:[{games:[{gamePk:id, status, teams:{away:{team:away,score:5},home:{team:home,score:1}}}]}]};
const feed = {gameData:{teams:{away,home},status}, liveData:{linescore:{innings:[{num:1,away:{runs:1},home:{runs:0}}],teams:{away:{runs:5,hits:6,errors:0},home:{runs:1,hits:4,errors:0}}}, plays:{allPlays:plays}, boxscore:{teams:{away:{batters:[1],players:{ID1:{person:{fullName:'Fixture player'},stats:{batting:{hits:0}}}}}}}}};
function localPath(url) {
  assert.ok(url.startsWith(origin), url);
  return decodeURIComponent(new URL(url).pathname.slice('/LIVPBP/'.length)) || 'index.html';
}
class Files extends ResourceLoader {
  fetch(url) { return Promise.resolve(fs.readFileSync(localPath(url))); }
}
function open(t, file, query = '', respond = url => {
  if (url.pathname.endsWith('/schedule')) return url.searchParams.get('date') === date ? schedule : {dates:[]};
  if (url.pathname.endsWith('/feed/live')) return feed;
  if (url.pathname.endsWith('/playByPlay')) return {allPlays:plays};
  throw new Error(`Unexpected URL: ${url}`);
}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: origin + file + query, resources: new Files(), runScripts:'dangerously', virtualConsole:console,
    beforeParse(window) { window.fetch = async url => {
      const target = new URL(url);
      assert.equal(target.origin, 'https://statsapi.mlb.com');
      const result = respond(target);
      return {ok:result !== null, status:503, json:async () => result};
    }; }
  });
  t.after(() => {dom.window.close(); assert.deepEqual(errors, []);});
  return dom.window.document;
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Expected UI was not rendered');
}
function sourced(document) {
  const rows = [...document.querySelectorAll('tbody tr')];
  assert.ok(rows.length);
  for (const row of rows) assert.equal(new URL(row.lastElementChild.querySelector('a').href).hostname, 'statsapi.mlb.com');
}
test('all local links, scripts and styles resolve under the Pages project path', () => {
  for (const file of ['index.html','game.html','reviews.html','flagged.html','404.html']) {
    const dom = new JSDOM(fs.readFileSync(file,'utf8'), {url:origin + (file === '404.html' ? 'nested/missing' : file)});
    for (const el of dom.window.document.querySelectorAll('[href],[src]')) {
      const url = new URL(el.href || el.src);
      if (url.origin !== new URL(origin).origin) continue;
      const path = localPath(url.href);
      assert.ok(fs.statSync(path).isFile(), `${file} → ${path}`);
      if (url.hash && path.endsWith('.html')) {
        const target = new JSDOM(fs.readFileSync(path,'utf8'));
        assert.ok(target.window.document.getElementById(url.hash.slice(1)));
        target.window.close();
      }
    }
    dom.window.close();
  }
});
test('scoreboard renders sourced scores, leaves missing values blank, navigates dates', async t => {
  const doc = open(t,'index.html',`?date=${date}`);
  await until(() => doc.querySelector('.game-card'));
  assert.match(doc.getElementById('game-list').textContent, /Los Angeles Dodgers.*5/);
  assert.equal(doc.querySelector('td.unverified').textContent, '');
  assert.ok(doc.querySelector(`a[href="game.html?gamePk=${id}"]`));
  sourced(doc);
  doc.querySelector('[title="Next day"]').click();
  await until(() => doc.getElementById('game-list').textContent.includes('No games'));
  assert.equal(doc.getElementById('date-picker').value,'2025-10-26');
});
test('game renders sourced linescore, pitch details, box stats and structured review', async t => {
  const doc = open(t,'game.html',`?gamePk=${id}`);
  await until(() => doc.querySelector('#linescore-wrap tbody'));
  assert.equal(doc.querySelector('#linescore-wrap tbody tr + tr td:nth-child(2)').textContent, '0');
  assert.match(doc.querySelector('#plays-wrap tbody').textContent, /Ball/);
  doc.querySelector('[data-tab="boxscore"]').click();
  assert.equal(doc.getElementById('panel-boxscore').style.display, '');
  assert.match(doc.getElementById('boxscore-wrap').textContent, /Fixture player/);
  assert.match(doc.getElementById('reviews-wrap').textContent, /Toronto Blue Jays.*No/);
  sourced(doc);
});
test('replay feed loads and filters official review rows', async t => {
  const doc = open(t,'reviews.html',`?date=${date}`);
  await until(() => doc.querySelector('#feed-list tbody'));
  sourced(doc);
  [...doc.querySelectorAll('#feed-tabs button')].find(el => el.textContent === 'ABS').click();
  assert.match(doc.getElementById('feed-list').textContent, /No structured review/);
});
test('API failure produces an error instead of a fabricated list', async t => {
  const doc = open(t,'index.html',`?date=${date}`, () => null);
  await until(() => doc.getElementById('status-line').textContent.includes('HTTP 503'));
  assert.equal(doc.querySelectorAll('tbody tr').length, 0);
});
