/* Test-only fixtures are intercepted in the browser. They are not in the Pages artifact. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { harness, sourceRows, noOverflow } from './independent-browser-harness.mjs';
import { fixture, synthetic, root } from './independent-fixtures.mjs';
const app = await harness();
let assertions = 0;
try {
  for (const width of [1440, 390]) {
    let scenario = 'official', feed = structuredClone(fixture.feed), fail = false;
    const errors = [], missing = [], external = [];
    const ctx = await app.browser.newContext({ viewport: { width, height: 920 } });
    await ctx.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'statsapi.mlb.com') {
        if (fail && url.pathname.endsWith('/schedule')) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); return; }
        let payload;
        if (url.pathname.endsWith('/gameStatus')) payload = fixture.registry;
        else if (url.pathname.endsWith('/schedule')) {
          const schedule = structuredClone(fixture.schedule);
          if (scenario === 'synthetic') { schedule.dates[0].games[0].status = feed.gameData.status; schedule.dates[0].games[0].teams.away.score = feed.liveData.linescore.teams.away.runs; schedule.dates[0].games[0].teams.home.score = feed.liveData.linescore.teams.home.runs; }
          payload = url.searchParams.get('date') === '2026-08-28' ? schedule : { dates: [], totalGames: 0 };
        } else if (url.pathname.includes('/game/824638/feed/live')) payload = feed;
        else throw new Error(`Unexpected official request: ${url.href}`);
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload), headers: { 'Access-Control-Allow-Origin': '*' } }); return;
      }
      if (url.hostname.endsWith('mlbstatic.com')) { await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#9bb9df"/></svg>' }); return; }
      if (url.origin === new URL(app.base).origin) { await route.continue(); return; }
      external.push(url.href); await route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(app.base) && response.status() >= 400 && !response.url().includes('not-a-page')) missing.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${app.base}index.html?date=2026-08-28`);
    await page.waitForSelector('.game-card');
    assert.equal(await page.locator('.team-score').allTextContents().then(values => values.join(',')), '10,8'); assertions++;
    assert.match(await page.locator('.game-card').innerText(), /Rhett Lowder/); assertions++;
    await page.getByRole('button', { name: /^Live/ }).click();
    await page.waitForSelector('.empty-state'); assert.match(await page.locator('.empty-state').innerText(), /No games in this filter/); assertions++;
    await page.getByRole('button', { name: /^All Games/ }).click();
    await noOverflow(page); await sourceRows(page);
    const link = await page.locator('.card-teams').getAttribute('href');
    assert.match(link, /gamePk=824638&date=2026-08-28/); assertions++;
    await page.locator('.card-teams').click();
    await page.waitForSelector('#header-away .team-score');
    assert.equal(await page.locator('#header-away .team-score').innerText(), '10'); assertions++;
    assert.equal(await page.locator('#header-home .team-score').innerText(), '8'); assertions++;
    await page.getByRole('tab', { name: 'Box Score' }).click();
    assert.match(await page.locator('#boxscore-wrap').innerText(), /Elly De La Cruz/); assertions++;
    assert.match(await page.locator('#boxscore-wrap').innerText(), /96/); assertions++;
    await sourceRows(page); await noOverflow(page);
    await page.getByRole('tab', { name: 'Props & Matchup' }).click();
    assert.match(await page.locator('#props-wrap').innerText(), /\.268/); assertions++;
    const forecastCells = page.locator('#props-wrap table').first().locator('tbody tr td:nth-child(2)');
    assert.deepEqual(await forecastCells.allTextContents(), ['', '']); assertions++;
    await sourceRows(page); await noOverflow(page);
    await page.getByRole('tab', { name: /Challenges & Reviews/ }).click();
    await page.waitForSelector('#reviews-wrap .feed-row');
    assert.match(await page.locator('#reviews-wrap').innerText(), /Overturned/); assertions++;
    await sourceRows(page); await noOverflow(page);
    await page.goto(`${app.base}reviews.html?date=2026-08-28`);
    await page.waitForFunction(() => document.getElementById('status-line').textContent.includes('feeds checked'));
    assert.equal(await page.locator('.feed-row').count(), 0); assertions++;
    await page.getByRole('button', { name: /^ABS / }).click();
    await page.waitForSelector('.feed-row');
    assert.match(await page.locator('.feed-row').innerText(), /2 remaining/); assertions++;
    assert.match(await page.locator('.feed-row').innerText(), /3 successful/); assertions++;
    await sourceRows(page); await noOverflow(page);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('status-line').textContent.includes('feeds checked'));
    await page.getByRole('button', { name: /^ABS / }).click();
    assert.equal(await page.locator('.feed-row').count(), 1); assertions++;
    // Isolated, explicitly synthetic transitions: active review -> counter irregularity -> scoring edit.
    await page.evaluate(() => localStorage.clear()); scenario = 'synthetic'; feed = synthetic();
    await page.reload();
    await page.waitForSelector('.runs-at-risk');
    assert.match(await page.locator('#banner').innerText(), /Runs at risk/); assertions++;
    assert.equal(await page.locator('.score-tracker').count(), 0); // generic official table class, not a fabricated score widget
    await sourceRows(page); await noOverflow(page);
    feed.gameData.review.away.used = 2;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.feed-row')?.textContent.includes('2 used'));
    feed.gameData.review.away.used = 1;
    feed.liveData.plays.allPlays[0].playEvents[0].reviewDetails.inProgress = false;
    feed.liveData.plays.allPlays[0].playEvents[0].reviewDetails.isOverturned = true;
    feed.liveData.plays.allPlays[0].result.eventType = 'field_error'; feed.liveData.plays.allPlays[0].result.event = 'Field Error';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('feed-list').textContent.includes('Observed scoring change'));
    assert.match(await page.locator('#feed-list').innerText(), /moved backwards/); assertions++;
    assert.equal(await page.locator('.runs-at-risk').count(), 0); assertions++;
    await page.getByRole('button', { name: /Scoring Changes/ }).click();
    assert.equal(await page.locator('.feed-row').count(), 1); assertions++;
    await page.goto(`${app.base}flagged-for-review.html`);
    await page.waitForFunction(() => document.getElementById('observed-flags').textContent.includes('attribution'));
    await sourceRows(page); await noOverflow(page);
    // New schedule failure and recovery are explicit, never a fake empty slate.
    scenario = 'official'; feed = structuredClone(fixture.feed); fail = true;
    await page.goto(`${app.base}index.html?date=2026-08-28`);
    await page.waitForSelector('.error-state');
    assert.match(await page.locator('.error-state').innerText(), /HTTP 500/); assertions++;
    fail = false; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.waitForSelector('.game-card');
    await page.getByTitle('Next day').click();
    await page.waitForFunction(() => location.search.includes('2026-08-29') && document.getElementById('game-list').textContent.includes('No MLB games scheduled'));
    await page.getByTitle('Previous day').click(); await page.waitForSelector('.game-card');
    await page.goto(`${app.base}game.html?gamePk=bad`); await page.waitForSelector('.empty-state');
    assert.match(await page.locator('.empty-state').innerText(), /No game has been guessed/); assertions++;
    await page.goto(`${app.base}game.html`); await page.waitForSelector('.empty-state');
    await page.goto(`${app.base}nested/not-a-page`); await page.getByRole('link', { name: /Back to scoreboard/ }).click();
    await page.waitForURL(`${app.base}index.html`); await page.waitForSelector('.empty-state');
    await noOverflow(page);
    assert.deepEqual(errors, []); assert.deepEqual(missing, []); assert.deepEqual(external, []); assertions += 3;
    if (width === 1440) { fs.mkdirSync(path.join(root, 'test-results'), { recursive: true }); await page.goto(`${app.base}index.html?date=2026-08-28`); await page.waitForSelector('.game-card'); await page.screenshot({ path: path.join(root, 'test-results/scoreboard.png'), fullPage: true }); }
    await ctx.close(); console.log(`Browser checks passed at ${width}px (static /LIVPBP/ hosting; no backend).`);
  }
  const deployed = fs.readdirSync(path.join(root, '_site'));
  for (const excluded of ['server.mjs', 'node_modules', 'tools', '.git', 'data', 'docs']) assert.ok(!deployed.includes(excluded));
  console.log(`${assertions} browser assertions passed, including every rendered table-row source, persistence, mobile overflow, errors, navigation and review/scoring transitions.`);
} finally { await app.close(); }
