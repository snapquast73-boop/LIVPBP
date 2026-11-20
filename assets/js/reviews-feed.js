'use strict';
const ReplayFeed = (() => {
  const {byId, node, link} = UI;
  const list = byId('feed-list');
  let selected = 'All', snapshot;
  const choices = ['All', 'ABS', 'Challenges', 'Reviews', 'Boundary Calls', 'Under Review'];
  function draw() {
    UI.tabs(byId('feed-tabs'), choices, selected, value => {selected = value; if (snapshot) draw();});
    if (!snapshot) return;
    const {games, scans, date} = snapshot;
    const active = games.filter(game => Reviews.active(game.status));
    byId('live-dot').classList.toggle('on', games.some(game => UI.live(game.status)));
    const strip = byId('active-strip');
    strip.replaceChildren();
    for (const game of active) {
      const card = node('p', null, 'banner');
      card.append(link(game.status.detailedState ?? 'Under review', UI.gameLink(game.gamePk)), ' · ', link('MLB schedule', MLB.scheduleURL(date)));
      strip.append(card);
    }
    byId('feed-stats').textContent = `${active.length} under review · ${scans.reduce((n, scan) => n + scan.reviews.length, 0)} structured review entries`;
    list.replaceChildren();
    for (const {game, reviews} of scans) {
      const shown = reviews.filter(item => selected === 'All' ? Reviews.category(item.details.reviewType) !== 'ABS' : Reviews.category(item.details.reviewType) === selected);
      if (!shown.length) continue;
      const section = node('section', null, 'feed-entry');
      const heading = node('h2');
      const title = [game.teams?.away?.team?.name, game.teams?.home?.team?.name].filter(Boolean).join(' @ ');
      heading.append(link(title || 'Game details', UI.gameLink(game.gamePk)));
      const grid = Reviews.table();
      Reviews.rows(grid, shown, MLB.endpoint(game.gamePk, 'playByPlay'), [game.teams?.away?.team, game.teams?.home?.team]);
      section.append(heading, grid);
      list.append(section);
    }
    if (selected !== 'Under Review' && !list.children.length) list.append(node('p', 'No structured review entries in this view.'));
    if (selected === 'Under Review' && !active.length) list.append(node('p', 'No active reviews reported in the MLB schedule.'));
  }
  async function load(date) {
    const games = (await MLB.schedule(date)).filter(game => UI.validId(game.gamePk));
    const pending = games.filter(game => UI.live(game.status) || game.status?.detailedState === 'Final');
    const scans = [];
    let failures = 0;
    // Cap concurrent requests on full slates.
    for (let i = 0; i < pending.length; i += 4) {
      const batch = pending.slice(i, i + 4);
      const results = await Promise.allSettled(batch.map(async game => {
        const payload = await MLB.plays(game.gamePk);
        if (!Array.isArray(payload.allPlays)) throw new Error('Unrecognized MLB play-by-play response');
        return {game, reviews: Reviews.extract(payload.allPlays).reverse()};
      }));
      results.forEach(result => result.status === 'fulfilled' ? scans.push(result.value) : failures++);
    }
    return {games, scans, failures, date};
  }
  const poller = UI.poll(load, data => {snapshot = data; draw();}, error => {
    byId('status-line').textContent = error ? `Could not load the replay feed: ${error}` : snapshot.failures
      ? `Incomplete: MLB play-by-play unavailable for ${snapshot.failures} game(s).` : 'Data from MLB StatsAPI';
  }, data => data.games.some(game => UI.live(game.status)) ? 10000 : data.date === UI.today() || data.failures ? 60000 : null);
  byId('refresh-btn').onclick = poller.refresh;
  return UI.dateNav(date => {
    snapshot = null;
    byId('active-strip').replaceChildren();
    byId('feed-stats').textContent = '';
    byId('status-line').textContent = '';
    list.replaceChildren(node('p', 'Loading MLB replay data…'));
    poller.set(date);
  });
})();
