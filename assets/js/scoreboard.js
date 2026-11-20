(() => {
  'use strict';
  let selected = UI.selectedDate();
  let games = [], filter = 'all', generation = 0, loaded = false;
  const filters = [['all', 'All Games'], ['live', 'Live'], ['preview', 'Upcoming'], ['final', 'Final']];
  const root = document.getElementById('game-list');
  function render() {
    document.getElementById('tabs').innerHTML = filters.map(([key, label]) => `<button class="tab-btn${filter === key ? ' tab-on' : ''}" data-filter="${key}" aria-pressed="${filter === key}">${label} <span class="tab-badge">${key === 'all' ? games.length : games.filter(game => UI.state(game.status) === key).length}</span></button>`).join('');
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; render(); }));
    const visible = games.filter(game => filter === 'all' || UI.state(game.status) === filter);
    const log = FeedLog.read(selected);
    root.innerHTML = visible.length ? visible.map(game => {
      const target = MLB.scheduleURL(selected);
      const href = UI.gameHref(game.gamePk, selected);
      const changes = log.entries.filter(entry => entry.gamePk === game.gamePk && entry.review.typeKey === 'scoring').length;
      const review = Reviews.activeStatus(game.status);
      return `<article class="game-card" data-game-pk="${game.gamePk}">
        <div class="card-top">${UI.status(game.status, game.linescore)}<span class="muted">${UI.state(game.status) === 'preview' ? UI.time(game.gameDate) : ''}</span></div>
        <a class="card-teams" href="${href}" aria-label="${UI.escape(`${game.teams?.away?.team?.name ?? 'Away'} at ${game.teams?.home?.team?.name ?? 'Home'} — open play-by-play`)}">${['away', 'home'].map(side => {
          const club = game.teams?.[side];
          return `<div class="team-row">${UI.logo(club?.team)}<div class="team-info"><span class="team-name">${UI.teamName(club?.team)}</span><span class="team-record">${UI.record(club?.leagueRecord)}</span></div><span class="team-score${UI.reported(club?.score) ? '' : ' unverified'}" ${UI.reported(club?.score) ? '' : 'title="Score not reported — unverified"'}>${UI.value(club?.score)}</span></div>`;
        }).join('')}</a>
        <div class="card-detail">${review ? `<p><a class="chip chip-review" href="reviews.html?date=${selected}">🚨 ${UI.escape(game.status.detailedState)}${game.status.reason ? ` · ${UI.escape(game.status.reason)}` : ''}</a></p>` : ''}
        ${UI.state(game.status) === 'live' ? `<p>${UI.value(game.linescore?.balls)} balls · ${UI.value(game.linescore?.strikes)} strikes · ${UI.value(game.linescore?.outs)} outs</p>${UI.bases(game.linescore)}` : ''}
        ${['away', 'home'].map(side => game.teams?.[side]?.probablePitcher ? `<p>Probable — ${UI.teamName(game.teams[side].team)}: ${UI.escape(game.teams[side].probablePitcher.fullName)}</p>` : '').join('')}
        ${game.decisions ? `<p>${[['winner', 'W'], ['loser', 'L'], ['save', 'S']].filter(([key]) => game.decisions[key]).map(([key, label]) => `${label}: ${UI.escape(game.decisions[key].fullName)}`).join(' · ')}</p>` : ''}
        ${game.venue?.name ? `<p>${UI.escape(game.venue.name)}</p>` : ''}${changes ? `<p><a href="${href}#reviews">✏ ${changes} observed scoring change${changes === 1 ? '' : 's'}</a></p>` : ''}</div>
        <div class="card-footer"><a href="${href}">Game details →</a>${UI.source(target)}</div></article>`;
    }).join('') : `<div class="empty-state"><div aria-hidden="true" style="font-size:36px">⚾</div><h2>${games.length ? 'No games in this filter' : 'No MLB games scheduled'}</h2><p>${games.length ? 'Choose another filter to see the schedule.' : `MLB reports no games for ${UI.escape(UI.dateLabel(selected))}. Use the date controls to browse another day.`}</p><p>${UI.source(MLB.scheduleURL(selected), 'Check the official schedule')}</p><p><a href="index.html?date=2026-08-28">Browse the verified August 28 archive →</a></p></div>`;
    const active = games.filter(game => Reviews.activeStatus(game.status));
    UI.setBanner(active.length ? `<div class="review-ticker"><strong>🚨 Under review</strong>${active.map(game => `<a href="${UI.gameHref(game.gamePk, selected)}">${UI.teamName(game.teams?.away?.team)} @ ${UI.teamName(game.teams?.home?.team)}: ${UI.escape(game.status.detailedState)}</a>`).join(' · ')}<a href="reviews.html?date=${selected}">Replay Feed →</a></div>` : '');
  }
  async function update() {
    const version = generation, date = selected;
    try {
      const payload = await MLB.schedule(date);
      if (version !== generation) return 1000;
      if (!Array.isArray(payload.dates)) throw new Error('MLB returned no usable schedule. No results were inferred.');
      games = payload.dates.flatMap(day => day.games ?? []).filter(game => Number.isSafeInteger(game.gamePk));
      loaded = true;
      render();
      UI.setStatus(`Official MLB data · Updated ${new Date().toLocaleTimeString()} · Auto-refresh pauses when hidden · Blank values are unverified`);
      FeedLog.sync(date).then(() => { if (version === generation) render(); }).catch(error => console.warn(error.message));
      return games.some(game => UI.state(game.status) === 'live') ? 10000 : 60000;
    } catch (error) {
      if (version !== generation) return 1000;
      if (loaded) UI.setBanner(`Update failed: ${UI.escape(error.message)} Previous official response remains on screen; it may be stale. <button class="btn" onclick="Scoreboard.refresh()">Retry</button>`, 'banner-danger');
      else UI.error(root, error, '<button class="btn" onclick="Scoreboard.refresh()">Retry</button>');
      UI.setStatus('Official data could not be refreshed. No substitute data is displayed.');
      return Math.max(30000, MLB.cooldown());
    }
  }
  const poller = UI.poll(update);
  const owner = { refresh: poller.refresh };
  window.Scoreboard = owner;
  const applyDate = UI.dateControls(owner, () => selected, next => {
    selected = next; generation++; games = []; loaded = false;
    root.innerHTML = '<div class="empty-state" role="status">Loading official MLB schedule…</div>';
    UI.setBanner(); poller.refresh();
  });
  FeedLog.onChange(date => { if (date === selected && loaded) render(); });
  MLB.registry().then(Reviews.setRegistry).catch(error => console.warn('Review registry unavailable:', error.message));
  applyDate(selected);
})();
