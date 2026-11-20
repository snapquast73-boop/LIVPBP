'use strict';
const Scoreboard = (() => {
  let date, games = [], filter = 'All';
  const list = UI.byId('game-list');
  function render() {
    const visible = games.filter(game => filter === 'All' || game.status?.abstractGameState === filter);
    list.replaceChildren();
    for (const game of visible) {
      const card = UI.node('article', '', 'panel');
      const heading = UI.node('h2');
      heading.append(UI.link([game.teams?.away?.team?.name, game.teams?.home?.team?.name].filter(Boolean).join(' @ ') || 'Game details', UI.gameLink(game.gamePk, date)));
      const status = [game.status?.detailedState, game.linescore?.inningState, game.linescore?.currentInningOrdinal].filter(Boolean).join(' · ');
      card.append(heading, UI.node('p', status), UI.table(['Team', 'Runs', 'Probable pitcher'], ['away', 'home'].map(side => {
        const team = game.teams?.[side];
        return [team?.team?.name, team?.score, team?.probablePitcher?.fullName];
      }), MLB.schedulePath(date)));
      if (game.decisions) card.append(UI.table(['Winning pitcher', 'Losing pitcher', 'Save'], [[game.decisions.winner?.fullName, game.decisions.loser?.fullName, game.decisions.save?.fullName]], MLB.schedulePath(date)));
      list.append(card);
    }
    if (!visible.length) list.append(UI.node('p', 'No games match this date and filter.'));
  }
  const refresh = UI.poll(async signal => {
    const result = await MLB.schedule(date, signal);
    if (signal.aborted) return;
    games = result;
    render();
    UI.byId('status-line').textContent = `Updated ${new Date().toLocaleTimeString()}`;
  });
  for (const label of ['All', 'Live', 'Preview', 'Final']) {
    const button = UI.node('button', label, 'btn');
    button.setAttribute('aria-pressed', String(label === filter));
    button.onclick = () => {
      filter = label;
      for (const tab of UI.byId('tabs').children) tab.setAttribute('aria-pressed', String(tab === button));
      if (!list.querySelector('[role=status]')) render();
    };
    UI.byId('tabs').append(button);
  }
  return UI.dates(value => {
    date = value;
    games = [];
    const loading = UI.node('p', 'Loading MLB schedule…');
    loading.setAttribute('role', 'status');
    list.replaceChildren(loading);
    refresh().then(() => { if (date === value && loading.isConnected) loading.remove(); });
  });
})();
Scoreboard.start();
