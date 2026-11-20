'use strict';
(() => {
  const {byId, node, link, table, row} = UI;
  const id = new URLSearchParams(location.search).get('gamePk');
  const buttons = [...document.querySelectorAll('[data-tab]')];
  const choose = key => buttons.forEach(button => {
    const selected = button.dataset.tab === key;
    button.classList.toggle('tab-on', selected);
    button.setAttribute('aria-pressed', selected);
    byId(`panel-${button.dataset.tab}`).style.display = selected ? '' : 'none';
  });
  buttons.forEach(button => button.onclick = () => choose(button.dataset.tab));
  choose('plays');
  if (!UI.validId(id)) {
    byId('loading').textContent = 'No valid game ID was supplied. Choose a game on the scoreboard.';
    byId('main').hidden = true;
    byId('refresh-btn').disabled = true;
    return;
  }
  const source = MLB.gameURL(id);
  byId('props-wrap').append(node('p', 'Forecast unverified; the original model was not included.'), link('Flagged for Review', 'flagged.html#forecast'));
  function render(feed) {
    if (!feed.gameData || !feed.liveData) throw new Error('Unrecognized MLB game response');
    const {gameData: game, liveData: data} = feed;
    const line = data.linescore;
    const state = game.status;
    byId('loading').hidden = true;
    for (const side of ['away', 'home']) {
      byId(`header-${side}`).replaceChildren(node('span', game.teams?.[side]?.name), node('strong', line?.teams?.[side]?.runs));
    }
    byId('header-center').textContent = state?.detailedState ?? '';
    byId('header-meta').replaceChildren(node('span', game.venue?.name), ' · ', link('MLB game feed', source));
    const decisions = [['W', 'winner'], ['L', 'loser'], ['SV', 'save']].flatMap(([label,key]) => data.decisions?.[key]?.fullName ? [`${label}: ${data.decisions[key].fullName}`] : []);
    byId('header-decisions').textContent = decisions.join(' · ');
    const live = byId('live-panel');
    live.replaceChildren();
    if (UI.live(state) && line) {
      const atBat = table(['Inning', 'Batter', 'Pitcher', 'Balls', 'Strikes', 'Outs', 'On deck', 'In the hole']);
      row(atBat, [line.currentInning, line.offense?.batter?.fullName, line.defense?.pitcher?.fullName,
        line.balls, line.strikes, line.outs, line.offense?.onDeck?.fullName, line.offense?.inHole?.fullName], source);
      live.append(node('h2', 'At bat'), atBat);
    }
    const banner = byId('live-review-banner-wrap');
    banner.className = 'banner';
    banner.replaceChildren();
    if (Reviews.active(state)) banner.append(state.detailedState ?? '', ' · ', link('MLB status registry', Reviews.registry));
    const lineWrap = byId('linescore-wrap');
    lineWrap.replaceChildren();
    if (line?.innings?.length) {
      const grid = table(['Team', ...line.innings.map(i => i.num), 'R', 'H', 'E']);
      for (const side of ['away','home']) {
        const total = line.teams?.[side];
        row(grid, [game.teams?.[side]?.name, ...line.innings.map(i => i[side]?.runs), total?.runs, total?.hits, total?.errors], source);
      }
      lineWrap.append(node('h2', 'Linescore'), grid);
    }
    const plays = data.plays?.allPlays ?? [];
    const playsWrap = byId('plays-wrap');
    const expanded = new Set([...playsWrap.querySelectorAll('details[open]')].map(el => el.dataset.index));
    playsWrap.replaceChildren();
    if (!plays.length) playsWrap.append(node('p', 'No play-by-play supplied by MLB.'));
    for (const [index, play] of [...plays.entries()].reverse()) {
      const detail = node('details');
      detail.dataset.index = index;
      detail.open = expanded.has(String(index));
      detail.append(node('summary', [play.about?.halfInning, play.about?.inning, play.result?.description].filter(v => v != null).join(' ')), link('MLB game feed', source));
      const pitches = (play.playEvents ?? []).filter(event => event.isPitch === true);
      if (pitches.length) {
        const pitchTable = table(['Pitch', 'Description', 'MPH']);
        for (const pitch of pitches) row(pitchTable, [pitch.pitchNumber, pitch.details?.description, pitch.pitchData?.startSpeed], source);
        detail.append(pitchTable);
      }
      playsWrap.append(detail);
    }
    const box = byId('boxscore-wrap');
    box.replaceChildren();
    for (const side of ['away','home']) {
      const team = data.boxscore?.teams?.[side];
      if (!team) continue;
      box.append(node('h2', game.teams?.[side]?.name));
      for (const [label, type, ids, cols] of [
        ['Batting', 'batting', team.batters, {AB:'atBats', R:'runs', H:'hits', RBI:'rbi', BB:'baseOnBalls', SO:'strikeOuts'}],
        ['Pitching', 'pitching', team.pitchers, {IP:'inningsPitched', H:'hits', R:'runs', ER:'earnedRuns', BB:'baseOnBalls', SO:'strikeOuts'}]
      ]) {
        if (!ids?.length) continue;
        const grid = table(['Player', ...Object.keys(cols)]);
        for (const playerId of ids) {
          const p = team.players?.[`ID${playerId}`];
          row(grid, [p?.person?.fullName, ...Object.values(cols).map(field => p?.stats?.[type]?.[field])], source);
        }
        box.append(node('h3', label), grid);
      }
    }
    if (!box.children.length) box.append(node('p', 'No box score supplied by MLB.'));
    const reviewWrap = byId('reviews-wrap');
    const entries = Reviews.extract(plays);
    const badge = byId('reviews-tab-count');
    badge.textContent = entries.length;
    badge.style.display = entries.length ? '' : 'none';
    reviewWrap.replaceChildren();
    if (entries.length) {
      const grid = Reviews.table();
      Reviews.rows(grid, entries, source, [game.teams?.away, game.teams?.home]);
      reviewWrap.append(grid);
    } else reviewWrap.append(node('p', 'No structured reviews in this MLB response.'));
  }
  const poller = UI.poll(MLB.game, render, error => {
    byId('loading').hidden = true;
    byId('status-line').textContent = error ? `Could not load this game: ${error}` : 'Data from MLB StatsAPI';
  }, feed => UI.live(feed.gameData?.status) ? 5000 : feed.gameData?.status?.abstractGameState === 'Final' ? null : 30000);
  byId('refresh-btn').onclick = poller.refresh;
  poller.set(id);
})();
