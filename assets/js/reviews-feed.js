'use strict';
const ReplayFeed = (() => {
  let date;
  const list = UI.byId('feed-list');
  const stats = UI.byId('feed-stats');
  const refresh = UI.poll(async signal => {
    const selected = date;
    const games = await MLB.schedule(selected, signal);
    const cards = [];
    let failed = 0, count = 0;
    // Limit concurrent requests during full slates.
    for (let start = 0; start < games.length && !signal.aborted; start += 3) {
      const results = await Promise.allSettled(games.slice(start, start + 3).map(async game => ({game, feed: await MLB.game(game.gamePk, signal)})));
      for (const result of results) {
        if (result.status === 'rejected') { failed++; continue; }
        const {game, feed} = result.value;
        const rows = Reviews.extract(feed);
        if (!rows.length) continue;
        count += rows.length;
        const card = UI.node('article', '', 'panel');
        const title = UI.node('h2');
        title.append(UI.link([game.teams?.away?.team?.name, game.teams?.home?.team?.name].filter(Boolean).join(' @ ') || 'Game details', UI.gameLink(game.gamePk, selected)));
        card.append(title, UI.table(['Inning','Description','Type'], rows, MLB.gamePath(game.gamePk)));
        cards.push(card);
      }
    }
    if (signal.aborted) return;
    list.replaceChildren(...cards);
    if (!cards.length) list.append(UI.node('p', failed ? 'No reviews displayed; some MLB feeds could not be checked.' : 'No review entries found in the available MLB feeds.'));
    stats.textContent = `${count} review entries found`;
    UI.byId('status-line').textContent = failed ? `${failed} game feed(s) unavailable. Results are incomplete.` : `Updated ${new Date().toLocaleTimeString()}`;
  }, 30000);
  UI.byId('refresh-btn').onclick = refresh;
  return UI.dates(value => {
    date = value;
    stats.textContent = '';
    list.replaceChildren();
    UI.byId('status-line').textContent = 'Loading MLB feeds…';
    refresh();
  });
})();
ReplayFeed.start();
