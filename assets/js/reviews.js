/* Parse only explicit official review objects, statuses and scoring observations. */
(() => {
  'use strict';
  const registry = new Map();
  // These exact codes were read from MLB's gameStatus registry on 2026-11-20.
  const known = {
    MJ: ['abs', 'ABS pitch challenge', 'Pitch Result'], NJ: ['abs', 'ABS pitch review', 'Pitch Result'],
    MA: ['challenge', 'Manager challenge', 'Tag play'], MF: ['challenge', 'Manager challenge', 'Close play at 1st'],
    MH: ['challenge', 'Manager challenge', 'Home run'], NH: ['boundary', 'Boundary-call review', 'Home run'],
    IH: ['review', 'Instant replay', 'Review']
  };
  const number = input => typeof input === 'number' && Number.isFinite(input);
  const score = input => number(input?.away) && number(input?.home) ? { away: input.away, home: input.home } : null;
  function setRegistry(rows) {
    if (!Array.isArray(rows)) return;
    rows.forEach(row => { if (typeof row.statusCode === 'string') registry.set(row.statusCode, row); });
  }
  function category(code) {
    const row = registry.get(code);
    if (row) {
      if (['MJ', 'NJ'].includes(code)) return { typeKey: 'abs', typeLabel: row.detailedState, reason: row.reason };
      if (row.detailedState?.startsWith('Manager challenge')) return { typeKey: 'challenge', typeLabel: 'Manager challenge', reason: row.reason };
      if (row.detailedState?.startsWith('Umpire review')) return { typeKey: code === 'NH' ? 'boundary' : 'review', typeLabel: row.detailedState, reason: row.reason };
      if (code === 'IH') return { typeKey: 'review', typeLabel: row.detailedState, reason: row.reason };
    }
    const fallback = known[code];
    return fallback ? { typeKey: fallback[0], typeLabel: fallback[1], reason: fallback[2] } : { typeKey: 'unknown', typeLabel: 'Review — type unverified', reason: null };
  }
  function activeStatus(status) {
    const code = status?.statusCode;
    const type = category(code);
    return type.typeKey !== 'unknown' ? { ...type, code, description: status?.detailedState, reason: status?.reason ?? type.reason } : null;
  }
  function plays(feed) {
    const result = new Map();
    for (const play of feed?.liveData?.plays?.allPlays ?? []) {
      const index = play?.atBatIndex ?? play?.about?.atBatIndex;
      if (Number.isInteger(index) && index >= 0) result.set(index, play);
    }
    const current = feed?.liveData?.plays?.currentPlay;
    const currentIndex = current?.atBatIndex ?? current?.about?.atBatIndex;
    if (Number.isInteger(currentIndex) && currentIndex >= 0) result.set(currentIndex, current);
    return [...result.values()];
  }
  function counters(feed, details, typeKey) {
    if (!number(details?.challengeTeamId)) return null;
    const teams = feed?.gameData?.teams;
    const side = teams?.away?.id === details.challengeTeamId ? 'away' : teams?.home?.id === details.challengeTeamId ? 'home' : null;
    if (!side) return null;
    const counter = (typeKey === 'abs' ? feed.gameData.absChallenges : typeKey === 'challenge' ? feed.gameData.review : null)?.[side];
    if (!counter) return null;
    const result = { team: teams[side].abbreviation ?? teams[side].name, kind: typeKey === 'abs' ? 'ABS' : 'manager' };
    ['remaining', 'used', 'usedSuccessful', 'usedFailed'].forEach(key => { if (number(counter[key])) result[key] = counter[key]; });
    return result;
  }
  function extract(feed, gamePk) {
    const rows = [];
    for (const play of plays(feed)) {
      const atBatIndex = play.atBatIndex ?? play.about?.atBatIndex;
      const events = Array.isArray(play.playEvents) ? play.playEvents : [];
      const reviewedEvents = events.filter(event => event?.reviewDetails && typeof event.reviewDetails === 'object');
      const candidates = reviewedEvents.map(event => ({ event, details: event.reviewDetails }));
      if (play.reviewDetails && !reviewedEvents.some(event => event.reviewDetails.reviewType === play.reviewDetails.reviewType && event.reviewDetails.challengeTeamId === play.reviewDetails.challengeTeamId)) {
        candidates.push({ event: null, details: play.reviewDetails });
      }
      candidates.forEach(({ event, details }, sequence) => {
        const code = details.reviewType;
        const type = category(code);
        const inProgress = typeof details.inProgress === 'boolean' ? details.inProgress : null;
        const flags = [];
        if (type.typeKey === 'unknown') flags.push('Official review code has no verified classification.');
        if (inProgress === null) flags.push('Review progress is not reported — unverified.');
        let outcome = null;
        if (inProgress === false && typeof details.isOverturned === 'boolean') outcome = details.isOverturned ? 'Overturned' : 'Not overturned';
        if (inProgress !== true && !outcome) flags.push('Official outcome is not reported — unverified.');
        // Event-level reviews cannot inherit the later, completed-PA score.
        const scoreAfter = inProgress === false
          ? score(event ? { away: event.details?.awayScore, home: event.details?.homeScore } : { away: play.result?.awayScore, home: play.result?.homeScore }) : null;
        const eventIndex = Number.isInteger(event?.index) ? event.index : null;
        const linked = eventIndex === null ? [] : (play.runners ?? []).filter(runner => runner?.details?.isScoringEvent === true && runner.details.playIndex === eventIndex);
        const risks = new Set(linked.map((runner, index) => runner.details?.runner?.id ?? `movement-${index}`)).size;
        const counter = counters(feed, details, type.typeKey);
        if (['abs', 'challenge'].includes(type.typeKey) && !number(counter?.remaining)) flags.push('Official challenges-remaining counter is missing — unverified.');
        rows.push({
          id: `${atBatIndex}:${eventIndex === null ? `play-${sequence}` : `event-${eventIndex}`}`,
          ...type, code: typeof code === 'string' ? code : null, atBatIndex,
          inning: play.about?.inning, halfInning: play.about?.halfInning,
          timestamp: event?.endTime ?? event?.startTime ?? play.about?.endTime ?? play.about?.startTime,
          description: event?.details?.description ?? play.result?.description ?? '',
          playDescription: play.result?.description ?? '', batter: play.matchup?.batter, pitcher: play.matchup?.pitcher,
          inProgress, outcome, challengeTeamId: details.challengeTeamId,
          scoreAfter, beforeScore: null, runsAtRisk: inProgress === true && risks > 0 ? risks : null,
          countAfter: inProgress === false && event?.count ? event.count : null,
          counter, teams: feed.gameData?.teams, flags
        });
      });
      const pending = play.result?.eventType === 'os_ruling_pending_primary' || play.result?.eventType === 'os_ruling_pending_prior';
      if (pending) rows.push({
        id: `${atBatIndex}:scoring-pending`, typeKey: 'pending', typeLabel: 'Official Scorer Ruling Pending',
        atBatIndex, inning: play.about?.inning, halfInning: play.about?.halfInning,
        timestamp: play.about?.endTime, description: play.result.description,
        batter: play.matchup?.batter, pitcher: play.matchup?.pitcher,
        inProgress: true, teams: feed.gameData?.teams, flags: [],
        scoreAfter: score({ away: play.result.awayScore, home: play.result.homeScore })
      });
      events.forEach((event, index) => {
        if (!['os_ruling_pending_primary', 'os_ruling_pending_prior'].includes(event.details?.eventType) || pending) return;
        rows.push({ id: `${atBatIndex}:pending-${event.index ?? index}`, typeKey: 'pending', typeLabel: 'Official Scorer Ruling Pending', atBatIndex,
          inning: play.about?.inning, halfInning: play.about?.halfInning, timestamp: event.endTime ?? event.startTime,
          description: event.details.description, batter: play.matchup?.batter, pitcher: play.matchup?.pitcher,
          inProgress: true, teams: feed.gameData?.teams, flags: [], scoreAfter: score({ away: event.details.awayScore, home: event.details.homeScore }) });
      });
    }
    return rows;
  }
  function observe(log, feed, gamePk) {
    const now = Date.now();
    const found = extract(feed, gamePk);
    const currentScore = score({ away: feed.liveData?.linescore?.teams?.away?.runs, home: feed.liveData?.linescore?.teams?.home?.runs });
    const byId = new Map(log.entries.map(entry => [`${entry.gamePk}:${entry.review.id}`, entry]));
    const newRows = [];
    const label = `${feed.gameData?.teams?.away?.name ?? ''} @ ${feed.gameData?.teams?.home?.name ?? ''}`;
    function add(review) {
      const key = `${gamePk}:${review.id}`;
      const previous = byId.get(key);
      review.beforeScore = previous?.review?.beforeScore ?? (review.inProgress === true ? currentScore : null);
      if (previous?.review?.counter && review.counter) {
        for (const field of ['used', 'usedSuccessful', 'usedFailed']) {
          if (number(previous.review.counter[field]) && number(review.counter[field]) && review.counter[field] < previous.review.counter[field]) {
            review.flags.push(`Official ${field} counter moved backwards between observations; not corrected.`);
          }
        }
      }
      review.flags = [...new Set([...(previous?.review?.flags ?? []), ...review.flags])];
      const entry = { gamePk, review, firstSeen: previous?.firstSeen ?? now, lastSeen: now, matchupLabel: label };
      if (!previous) newRows.push(entry);
      byId.set(key, entry);
    }
    found.forEach(add);
    const gameKey = String(gamePk);
    const previousSnapshots = log.snapshots[gameKey] ?? {};
    const nextSnapshots = { ...previousSnapshots };
    const present = new Set();
    for (const play of plays(feed)) {
      if (play.about?.isComplete !== true) continue;
      const index = play.atBatIndex ?? play.about?.atBatIndex;
      present.add(String(index));
      const snapshot = { eventType: play.result?.eventType ?? null, event: play.result?.event ?? null,
        isOut: typeof play.result?.isOut === 'boolean' ? play.result.isOut : null,
        description: play.result?.description ?? null, rbi: play.result?.rbi ?? null,
        awayScore: play.result?.awayScore ?? null, homeScore: play.result?.homeScore ?? null };
      const old = previousSnapshots[index];
      const knownOutChange = typeof old?.isOut === 'boolean' && typeof snapshot.isOut === 'boolean' && old.isOut !== snapshot.isOut;
      if (old && old.eventType && snapshot.eventType && (old.eventType !== snapshot.eventType || knownOutChange)) {
        const id = `${index}:scoring-change`;
        const priorChange = byId.get(`${gamePk}:${id}`)?.review;
        add({ id, typeKey: 'scoring', typeLabel: 'Observed scoring change', atBatIndex: index,
          inning: play.about?.inning, halfInning: play.about?.halfInning, timestamp: new Date(now).toISOString(),
          description: snapshot.description, initialCall: priorChange?.initialCall ?? old.event,
          finalCall: snapshot.event, history: [...(priorChange?.history ?? []), { before: old, after: snapshot, observedAt: now }].slice(-20),
          batter: play.matchup?.batter, pitcher: play.matchup?.pitcher, inProgress: false,
          scoreAfter: score({ away: snapshot.awayScore, home: snapshot.homeScore }), teams: feed.gameData?.teams,
          flags: ['Reclassification observed between official responses; responsible actor and any replay attribution are unverified.'] });
      } else if (old && JSON.stringify(old) !== JSON.stringify(snapshot)) {
        const note = `Play ${index}: official description/RBI/score changed without a reclassification; attribution unverified.`;
        log.irregularities[gameKey] = [...new Set([...(log.irregularities[gameKey] ?? []), note])].slice(-30);
      }
      nextSnapshots[index] = snapshot;
    }
    // Only a complete allPlays array can support a disappearance observation.
    if (Array.isArray(feed.liveData?.plays?.allPlays)) {
      Object.keys(previousSnapshots).forEach(index => {
        if (!present.has(index)) {
          const note = `Previously observed completed play ${index} is absent/incomplete in the current response; retained, not corrected.`;
          log.irregularities[gameKey] = [...new Set([...(log.irregularities[gameKey] ?? []), note])].slice(-30);
        }
      });
    }
    log.snapshots[gameKey] = nextSnapshots;
    const foundIds = new Set(found.map(row => row.id));
    for (const entry of byId.values()) {
      if (entry.gamePk !== gamePk || !entry.review.inProgress || foundIds.has(entry.review.id)) continue;
      entry.review.inProgress = null;
      entry.review.flags = [...new Set([...(entry.review.flags ?? []), 'No longer reported as active; resolution/outcome unverified.'])];
    }
    log.entries = [...byId.values()].sort((a, b) => b.firstSeen - a.firstSeen || b.review.atBatIndex - a.review.atBatIndex).slice(0, 500);
    log.savedAt = now;
    return newRows;
  }
  function scoreText(input, teams) {
    return score(input) ? `${teams?.away?.abbreviation ?? teams?.away?.name ?? 'Away'} ${input.away} – ${teams?.home?.abbreviation ?? teams?.home?.name ?? 'Home'} ${input.home}` : null;
  }
  function counterHTML(counter, target) {
    if (!counter) return '';
    const fields = [['remaining', 'remaining'], ['used', 'used'], ['usedSuccessful', 'successful'], ['usedFailed', 'failed']];
    return `<p class="feed-meta">${UI.escape(counter.team)} — ${UI.escape(counter.kind)} challenges: ${fields.filter(([key]) => number(counter[key])).map(([key, label]) => `${UI.value(counter[key])} ${label}`).join(' · ')} (current official counters) · ${UI.source(target, 'Counters')}</p>`;
  }
  function render(entry, date) {
    const review = entry.review;
    const target = MLB.gameURL(entry.gamePk);
    const meta = [review.halfInning, review.inning].filter(UI.reported).map(UI.escape).join(' ');
    const scores = UI.table('Review score tracker', ['Observation', 'Official score'], [
      ['<td>Before review (observed only)</td>', UI.cell(scoreText(review.beforeScore, review.teams))],
      ['<td>Possible after — unverified; not inferred</td>', UI.cell(null)],
      ['<td>Actual after (only when attributable)</td>', UI.cell(scoreText(review.scoreAfter, review.teams))]
    ], target);
    const isReview = !['scoring', 'pending'].includes(review.typeKey);
    return `<article class="feed-row${review.inProgress === true ? ' in-progress' : ''}${review.runsAtRisk ? ' runs-at-risk' : ''}" data-review-id="${UI.escape(review.id)}">
      <div class="feed-row-top"><h3><a href="${UI.gameHref(entry.gamePk, date)}">${UI.escape(entry.matchupLabel)}</a></h3><span class="feed-meta">${meta}</span></div>
      <div class="feed-chips"><span class="chip chip-review">${UI.escape(review.typeLabel)}</span>${review.inProgress === true ? '<span class="chip">Under review / pending</span>' : ''}${review.outcome ? `<span class="chip">${UI.escape(review.outcome)}</span>` : ''}${review.runsAtRisk ? '<span class="chip chip-risk">⚠ Runs at risk — scoring movement on reviewed event</span>' : ''}</div>
      <p>${UI.escape(review.description)}</p>${review.playDescription && review.playDescription !== review.description ? `<p class="feed-meta">Play context: ${UI.escape(review.playDescription)}</p>` : ''}
      ${review.initialCall ? `<p><strong>${UI.escape(review.initialCall)}</strong> → <strong>${UI.escape(review.finalCall)}</strong></p><p class="data-note">Observed change, not a reconstructed history. ${UI.source('https://www.mlb.com/official-information/scoring-changes', 'MLB scoring-change log')}</p>` : ''}
      ${isReview ? scores : ''}${counterHTML(review.counter, target)}
      ${review.countAfter ? `<p class="feed-meta">Official event count after review: ${UI.value(review.countAfter.balls)} balls · ${UI.value(review.countAfter.strikes)} strikes · ${UI.value(review.countAfter.outs)} outs. ${UI.source(target, 'Event')}</p>` : ''}
      <div class="feed-meta">${UI.escape(review.batter?.fullName ?? '')}${review.pitcher?.fullName ? ` · Pitcher: ${UI.escape(review.pitcher.fullName)}` : ''} · ${UI.source(target)}</div>
      ${review.flags?.length ? `<div class="irregularity">${review.flags.map(UI.escape).join('<br>')} <a href="flagged-for-review.html#data">Flagged for Review</a></div>` : ''}
    </article>`;
  }
  const visibleInAll = review => review?.typeKey !== 'abs';
  const shouldAlert = review => Boolean(review) && (review.runsAtRisk || ['challenge', 'review', 'boundary', 'pending', 'scoring', 'unknown'].includes(review.typeKey));
  window.Reviews = Object.freeze({ setRegistry, category, activeStatus, plays, extract, observe, scoreText, counterHTML, render, visibleInAll, shouldAlert });
})();
