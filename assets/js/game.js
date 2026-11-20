(() => {
  'use strict';
  const rawId = new URLSearchParams(location.search).get('gamePk');
  const loading = document.getElementById('loading');
  let gamePk;
  try { gamePk = Number(MLB.id(rawId)); }
  catch (_) {
    loading.hidden = true;
    document.getElementById('main').innerHTML = '<div class="empty-state"><h1>Choose a game from the scoreboard</h1><p>This link has no valid MLB game identifier. No game has been guessed.</p><a class="btn" href="index.html">Open scoreboard</a></div>';
    document.getElementById('refresh-btn').disabled = true;
    return;
  }
  let feed = null, selected = UI.selectedDate(), activeTab = 'plays', signature = '', logReady = false;
  let viewLog = FeedLog.empty(selected), unsubscribe = () => {};
  const target = MLB.gameURL(gamePk);
  function header() {
    for (const side of ['away', 'home']) {
      const team = feed.gameData?.teams?.[side];
      const runs = feed.liveData?.linescore?.teams?.[side]?.runs;
      document.getElementById(`header-${side}`).innerHTML = `${UI.logo(team)}<div>${UI.teamName(team)}<div class="team-record">${UI.escape(side === 'away' ? 'Away' : 'Home')}</div></div><span class="team-score${UI.reported(runs) ? '' : ' unverified'}" title="${UI.reported(runs) ? 'Official runs' : 'Score not reported — unverified'}">${UI.value(runs)}</span>`;
    }
    document.getElementById('header-center').innerHTML = `${UI.status(feed.gameData?.status, feed.liveData?.linescore)}<p>${UI.source(target, 'MLB game feed')}</p>`;
    const data = feed.gameData;
    document.title = `${data.teams?.away?.name ?? 'Away'} @ ${data.teams?.home?.name ?? 'Home'} — MLB Live PBP`;
    const meta = [data.venue?.name, data.datetime?.officialDate, data.weather?.condition,
      UI.reported(data.weather?.temp) ? `${data.weather.temp}°F` : null, data.weather?.wind].filter(UI.reported);
    document.getElementById('header-meta').innerHTML = meta.map(UI.escape).join(' · ');
    const decisions = feed.liveData?.decisions;
    document.getElementById('header-decisions').innerHTML = decisions ? [['winner', 'Win'], ['loser', 'Loss'], ['save', 'Save']].filter(([key]) => decisions[key]).map(([key, label]) => `<span>${label}: ${UI.escape(decisions[key].fullName)}</span>`).join('') : '';
  }
  function linescore() {
    const line = feed.liveData?.linescore;
    if (!Array.isArray(line?.innings) || !line.innings.length) {
      document.getElementById('linescore-wrap').innerHTML = `<h2>Linescore</h2><p class="data-note">Inning scores are not reported yet; values are blank/unverified. ${UI.source(target)}</p>`;
      return;
    }
    document.getElementById('linescore-wrap').innerHTML = UI.table('Inning-by-inning linescore', ['Team', ...line.innings.map(inning => inning.num), 'R', 'H', 'E'], ['away', 'home'].map(side => [
      UI.cell(feed.gameData?.teams?.[side]?.name), ...line.innings.map(inning => UI.cell(inning[side]?.runs)),
      ...['runs', 'hits', 'errors'].map(key => UI.cell(line.teams?.[side]?.[key]))
    ]), target) + '<p class="data-note">Blank cells mean MLB did not report a value (including an unplayed half-inning). They are not filled with zero.</p>';
  }
  function livePanel() {
    const live = UI.state(feed.gameData?.status) === 'live';
    const current = feed.liveData?.plays?.currentPlay;
    const line = feed.liveData?.linescore;
    const pitcher = current?.matchup?.pitcher ?? line?.defense?.pitcher;
    const batter = current?.matchup?.batter ?? line?.offense?.batter;
    if (!live) {
      document.getElementById('live-panel').innerHTML = current?.result?.description ? `<div class="panel"><div class="eyebrow">${UI.state(feed.gameData?.status) === 'final' ? 'Last official play' : 'Latest official play'}</div><p>${UI.escape(current.result.description)}</p>${UI.source(target)}</div>` : '';
      return;
    }
    let pitcherStats;
    for (const side of ['away', 'home']) {
      const player = feed.liveData?.boxscore?.teams?.[side]?.players?.[`ID${pitcher?.id}`];
      if (player?.stats?.pitching) pitcherStats = player.stats.pitching;
    }
    document.getElementById('live-panel').innerHTML = `<div class="live-grid"><div class="live-card"><div class="eyebrow">At bat · official current play</div><h2>${UI.escape(batter?.fullName ?? '')}</h2>${!batter ? '<p class="data-note">Current batter is unverified; MLB has not reported one.</p>' : ''}<div class="count-line"><span>${UI.value(line?.balls)} balls · ${UI.value(line?.strikes)} strikes · ${UI.value(line?.outs)} outs</span>${UI.bases(line)}</div>${UI.source(target)}</div><div class="live-card"><div class="eyebrow">Pitching</div><h2>${UI.escape(pitcher?.fullName ?? '')}</h2>${UI.table('Official pitcher game line', ['Pitches', 'IP', 'K', 'BB'], [[UI.cell(pitcherStats?.numberOfPitches), UI.cell(pitcherStats?.inningsPitched), UI.cell(pitcherStats?.strikeOuts), UI.cell(pitcherStats?.baseOnBalls)]], target)}</div></div>`;
  }
  function playByPlay() {
    const open = new Set([...document.querySelectorAll('details[data-play-key][open]')].map(item => item.dataset.playKey));
    const plays = Reviews.plays(feed).reverse();
    document.getElementById('plays-wrap').innerHTML = plays.length ? plays.map(play => {
      const index = play.atBatIndex ?? play.about?.atBatIndex;
      const events = (play.playEvents ?? []).filter(event => event.isPitch || event.details?.eventType);
      const reviewRows = Reviews.extract({ gameData: feed.gameData, liveData: { plays: { allPlays: [play] } } }, gamePk);
      return `<article class="play-row"><div class="play-heading"><h3>${UI.escape(play.about?.halfInning ?? '')} ${UI.value(play.about?.inning)} · ${UI.escape(play.result?.event ?? 'Play in progress')}</h3><span class="play-meta">${UI.reported(play.result?.awayScore) && UI.reported(play.result?.homeScore) ? UI.escape(Reviews.scoreText({ away: play.result.awayScore, home: play.result.homeScore }, feed.gameData.teams)) : ''}</span></div><p>${UI.escape(play.result?.description ?? '')}</p><div class="play-meta">${UI.escape(play.matchup?.batter?.fullName ?? '')}${play.matchup?.pitcher?.fullName ? ` vs. ${UI.escape(play.matchup.pitcher.fullName)}` : ''} · ${UI.source(target, 'Play source')}</div>${reviewRows.map(review => `<span class="chip chip-review">${UI.escape(review.typeLabel)}${review.outcome ? ` · ${UI.escape(review.outcome)}` : ''}</span>`).join(' ')}${events.length ? `<details data-play-key="${index}"${open.has(String(index)) ? ' open' : ''}><summary>Pitch-by-pitch & play events (${events.length})</summary>${UI.table('Official pitch and action events', ['Pitch', 'Description', 'Type', 'mph', 'Balls', 'Strikes', 'Outs'], events.map(event => [UI.cell(event.pitchNumber), UI.cell(event.details?.description), UI.cell(event.details?.type?.description), UI.cell(event.pitchData?.startSpeed), UI.cell(event.count?.balls), UI.cell(event.count?.strikes), UI.cell(event.count?.outs)]), target)}</details>` : ''}</article>`;
    }).join('') : `<p class="data-note">MLB has not reported play-by-play yet. ${UI.source(target)}</p>`;
  }
  function boxscore() {
    let html = '<h2>Box Score</h2>';
    for (const side of ['away', 'home']) {
      const club = feed.liveData?.boxscore?.teams?.[side];
      html += `<h3>${UI.teamName(feed.gameData?.teams?.[side])}</h3>`;
      if (!club) { html += `<p class="data-note">Box score not reported — unverified. ${UI.source(target)}</p>`; continue; }
      const playerRows = (ids, group, keys) => (ids ?? []).map(playerId => {
        const player = club.players?.[`ID${playerId}`];
        const name = player?.person?.fullName ?? feed.gameData?.players?.[`ID${playerId}`]?.fullName;
        return [UI.cell(name), ...keys.map(key => UI.cell(player?.stats?.[group]?.[key]))];
      });
      html += UI.table(`${club.team?.name ?? 'Team'} batting`, ['Batter', 'AB', 'R', 'H', 'RBI', 'BB', 'K', 'HR'], playerRows(club.batters, 'batting', ['atBats', 'runs', 'hits', 'rbi', 'baseOnBalls', 'strikeOuts', 'homeRuns']), target);
      html += UI.table(`${club.team?.name ?? 'Team'} pitching`, ['Pitcher', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'Pitches'], playerRows(club.pitchers, 'pitching', ['inningsPitched', 'hits', 'runs', 'earnedRuns', 'baseOnBalls', 'strikeOuts', 'numberOfPitches']), target);
    }
    document.getElementById('boxscore-wrap').innerHTML = html + '<p class="data-note">Only official per-game fields are shown. Blank cells are unreported/unverified, not zero. MLB season ERA is not substituted for game ERA.</p>';
  }
  function reviewsPanel() {
    const entries = viewLog.entries.filter(entry => entry.gamePk === gamePk);
    document.getElementById('reviews-tab-count').textContent = String(entries.length);
    document.getElementById('reviews-tab-count').style.display = entries.length ? '' : 'none';
    if (activeTab === 'reviews') document.getElementById('reviews-wrap').innerHTML = `<h2>Challenges & Reviews</h2><p class="data-note">Official review records and changes actually observed by this browser/shared server. Missing history is never reconstructed. ${UI.source(target)}</p>${entries.length ? entries.map(entry => Reviews.render(entry, selected)).join('') : '<p>No official review records or observed scoring changes are available for this game.</p>'}`;
    const active = Reviews.activeStatus(feed.gameData?.status);
    document.getElementById('live-review-banner-wrap').innerHTML = active ? `<div class="active-strip-wrap"><h2>🚨 ${UI.escape(feed.gameData.status.detailedState)}</h2><p>${UI.escape(feed.gameData.status.reason ?? '')} · ${UI.source(target, 'Official game status')}</p><p>Only the status is confirmed until MLB supplies review details; no outcome is predicted.</p></div>` : '';
  }
  function renderTab() {
    if (!feed) return;
    if (activeTab === 'plays') playByPlay();
    if (activeTab === 'boxscore') boxscore();
    if (activeTab === 'props') document.getElementById('props-wrap').innerHTML = Props.render(feed);
    reviewsPanel();
  }
  function selectTab(tab) {
    if (!['plays', 'boxscore', 'props', 'reviews'].includes(tab)) return;
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('tab-on', active);
      button.setAttribute('aria-selected', String(active));
      const panel = document.getElementById(`panel-${button.dataset.tab}`);
      panel.style.display = active ? '' : 'none';
      panel.hidden = !active;
    });
    history.replaceState(null, '', `${location.pathname}${location.search}#${tab}`);
    renderTab();
  }
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
  async function update() {
    const refresh = document.getElementById('refresh-btn');
    refresh.disabled = true;
    try {
      const next = await MLB.live(gamePk);
      if (!next.gameData || !next.gameData.teams || !next.gameData.status) throw new Error('MLB returned no usable game metadata.');
      if (next.gamePk !== undefined && next.gamePk !== gamePk) throw new Error('Official response game ID does not match this link.');
      next.gamePk = gamePk;
      const officialDate = next.gameData.datetime?.officialDate;
      if (MLB.validDate(officialDate) && officialDate !== selected) { selected = officialDate; logReady = false; }
      document.querySelectorAll('[data-date-link]').forEach(link => { link.href = `${link.dataset.dateLink}?date=${selected}`; });
      if (!logReady) {
        viewLog = FeedLog.clean(FeedLog.read(selected), selected);
        logReady = true;
        const date = selected;
        FeedLog.sync(date).then(shared => {
          if (date !== selected) return;
          viewLog = FeedLog.merge(viewLog, shared); reviewsPanel();
        }).catch(error => console.warn(error.message));
        unsubscribe();
        FeedLog.subscribe(date, () => { if (date === selected) { viewLog = FeedLog.merge(viewLog, FeedLog.read(date)); reviewsPanel(); } }).then(close => { if (date === selected) unsubscribe = close; else close(); });
      }
      feed = next;
      Reviews.observe(viewLog, feed, gamePk); // In-memory only; Replay Feed remains the persistent observer.
      const nextSignature = JSON.stringify([feed.gameData, feed.liveData]);
      if (signature !== nextSignature) { signature = nextSignature; header(); linescore(); livePanel(); renderTab(); }
      else reviewsPanel();
      loading.hidden = true;
      const existingError = document.getElementById('game-error');
      if (existingError) existingError.remove();
      UI.setStatus(`Official MLB data · Updated ${new Date().toLocaleTimeString()} · Blank fields are unverified · Refresh pauses when hidden`);
      return UI.state(feed.gameData.status) === 'live' ? (Reviews.activeStatus(feed.gameData.status) ? 2000 : 5000) : UI.state(feed.gameData.status) === 'preview' ? 30000 : 60000;
    } catch (error) {
      loading.hidden = true;
      let wrapper = document.getElementById('game-error');
      if (!wrapper) { wrapper = document.createElement('div'); wrapper.id = 'game-error'; document.getElementById('main').prepend(wrapper); }
      UI.error(wrapper, error, '<button class="btn" onclick="Game.refresh()">Retry</button>');
      UI.setStatus(feed ? 'Update failed. The previous official response may be stale.' : 'No official game data loaded.');
      return Math.max(30000, MLB.cooldown());
    } finally { refresh.disabled = false; }
  }
  const poller = UI.poll(update);
  window.Game = { refresh: poller.refresh };
  document.getElementById('refresh-btn').addEventListener('click', poller.refresh);
  FeedLog.onChange(date => { if (date === selected && feed) { viewLog = FeedLog.merge(viewLog, FeedLog.read(date)); reviewsPanel(); } });
  MLB.registry().then(rows => { Reviews.setRegistry(rows); if (feed) reviewsPanel(); }).catch(error => console.warn(error.message));
  const hashTab = location.hash.slice(1);
  if (['plays', 'boxscore', 'props', 'reviews'].includes(hashTab)) selectTab(hashTab);
  poller.refresh();
})();
