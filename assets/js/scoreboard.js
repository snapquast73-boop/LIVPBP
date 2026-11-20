'use strict';
const Scoreboard = (() => {
  const {byId, node, link} = UI;
  const list = byId('game-list');
  let games = [], date, filter = 'All';
  function draw() {
    UI.tabs(byId('tabs'), ['All', 'Live', 'Upcoming', 'Final'], filter, choice => {filter = choice; draw();});
    const states = {Live: 'Live', Upcoming: 'Preview', Final: 'Final'};
    const visible = games.filter(game => filter === 'All' || game.status?.abstractGameState === states[filter]);
    const active = games.filter(game => Reviews.active(game.status));
    byId('banner').replaceChildren();
    if (active.length) byId('banner').append(`${active.length} under review · `, link('Replay Feed', `reviews.html?date=${encodeURIComponent(date)}`));
    list.replaceChildren();
    if (!visible.length) list.append(node('p', 'No games in this view.'));
    for (const game of visible) {
      const card = node('article', null, 'panel game-card');
      card.append(node('h2', game.status?.detailedState), node('p', game.venue?.name));
      const table = UI.table(['Team', 'Runs', 'Probable pitcher']);
      for (const side of ['away', 'home']) {
        const team = game.teams?.[side];
        UI.row(table, [team?.team?.name, team?.score, team?.probablePitcher?.fullName], MLB.scheduleURL(date));
      }
      card.append(table);
      if (UI.validId(game.gamePk)) card.append(link('Game details →', UI.gameLink(game.gamePk)));
      list.append(card);
    }
  }
  const poller = UI.poll(MLB.schedule, (data, key) => {games = data; date = key; draw();}, error => {
    byId('status-line').textContent = error ? `Could not load the scoreboard: ${error}` : 'Data from MLB StatsAPI';
  }, games => games.some(game => UI.live(game.status)) ? 5000 : 30000);
  return UI.dateNav(value => {games = []; byId('banner').replaceChildren(); list.replaceChildren(node('p', 'Loading MLB schedule…')); byId('status-line').textContent = ''; poller.set(value);});
})();
