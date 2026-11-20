'use strict';
(() => {
  const params = new URLSearchParams(location.search);
  const id = params.get('gamePk');
  const date = params.get('date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) document.querySelector('a[href="index.html"]').href = `index.html?date=${date}`;
  const put = (id, ...children) => UI.byId(id).replaceChildren(...children);
  const loading = UI.byId('loading');
  const refresh = UI.poll(async signal => {
    try {
      const {gameData, liveData} = await MLB.game(id, signal);
      if (signal.aborted) return;
      const path = MLB.gamePath(id);
      const {linescore, boxscore, plays} = liveData;
      for (const side of ['away', 'home']) put(`header-${side}`, UI.node('h2', gameData.teams?.[side]?.name));
      put('header-center', UI.node('h2', [linescore?.teams?.away?.runs, linescore?.teams?.home?.runs].join(' – ')));
      put('header-meta', UI.node('p', gameData.status?.detailedState), UI.official(path));
      const decisions = liveData.decisions;
      if (decisions) put('header-decisions', UI.table(['Winner', 'Loser', 'Save'], [[decisions.winner?.fullName, decisions.loser?.fullName, decisions.save?.fullName]], path));
      const current = plays?.currentPlay;
      put('live-panel', UI.node('h2', 'Latest at-bat'), UI.table(['Batter','Pitcher','Balls','Strikes','Outs','On first','On second','On third','On deck','In the hole'], [[current?.matchup?.batter?.fullName, current?.matchup?.pitcher?.fullName, linescore?.balls, linescore?.strikes, linescore?.outs, linescore?.offense?.first?.fullName, linescore?.offense?.second?.fullName, linescore?.offense?.third?.fullName, linescore?.offense?.onDeck?.fullName, linescore?.offense?.inHole?.fullName]], path), UI.node('p', current?.result?.description));
      put('linescore-wrap', UI.node('h2', 'Linescore'), UI.table(['Inning','Away runs','Home runs'], (linescore?.innings ?? []).map(inning => [inning.num, inning.away?.runs, inning.home?.runs]), path));
      put('plays-wrap', ...(plays?.allPlays ?? []).slice().reverse().map(play => {
        const detail = UI.node('details');
        detail.append(UI.node('summary', [play.about?.halfInning, play.about?.inning, play.result?.description].filter(value => value != null).join(' · ')), UI.table(['Pitch','Description','Balls','Strikes','Speed (mph)'], (play.playEvents ?? []).filter(event => event.isPitch).map(event => [event.pitchNumber,event.details?.description,event.count?.balls,event.count?.strikes,event.pitchData?.startSpeed]), path), UI.official(path));
        return detail;
      }));
      put('boxscore-wrap', ...['away','home'].flatMap(side => {
        const team = boxscore?.teams?.[side];
        const players = Object.values(team?.players ?? {});
        return [UI.node('h2', team?.team?.name), UI.table(['Batter','AB','H','R','RBI','BB','SO'], players.filter(p => p.stats?.batting?.atBats != null).map(p => [p.person?.fullName,p.stats.batting.atBats,p.stats.batting.hits,p.stats.batting.runs,p.stats.batting.rbi,p.stats.batting.baseOnBalls,p.stats.batting.strikeOuts]), path), UI.table(['Pitcher','IP','H','ER','BB','SO','Pitches'], players.filter(p => p.stats?.pitching?.inningsPitched != null).map(p => [p.person?.fullName,p.stats.pitching.inningsPitched,p.stats.pitching.hits,p.stats.pitching.earnedRuns,p.stats.pitching.baseOnBalls,p.stats.pitching.strikeOuts,p.stats.pitching.numberOfPitches]), path)];
      }));
      const reviews = Reviews.extract({liveData});
      put('reviews-wrap', reviews.length ? UI.table(['Inning','Description','Type'], reviews, path) : UI.node('p', 'No review entries found in this MLB payload.'));
      UI.byId('reviews-tab-count').textContent = reviews.length;
      UI.byId('reviews-tab-count').style.display = reviews.length ? '' : 'none';
      UI.byId('status-line').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } finally {
      if (!signal.aborted) loading.hidden = true;
    }
  });
  put('props-wrap', UI.node('p', 'Forecast unavailable. No verified forecast is supplied by MLB.'), UI.link('Flagged for Review', 'flagged.html'));
  const tabs = Array.from(document.querySelectorAll('[data-tab]'));
  function select(active) {
    for (const tab of tabs) {
      UI.byId(`panel-${tab.dataset.tab}`).style.display = tab === active ? '' : 'none';
      tab.setAttribute('aria-pressed', String(tab === active));
    }
  }
  for (const tab of tabs) tab.onclick = () => select(tab);
  if (tabs.length) select(tabs[0]);
  if (!/^\d+$/.test(id ?? '')) {
    loading.hidden = true;
    put('status-line', UI.node('p', 'Choose a game from the scoreboard.'));
  } else {
    UI.byId('refresh-btn').onclick = refresh;
    refresh();
  }
})();
