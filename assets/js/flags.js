(() => {
  'use strict';
  const root = document.getElementById('observed-flags');
  const prefix = 'mlbReplayFeedLog.v2.';
  function render() {
    const dates = new Set([UI.selectedDate()]);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix) && MLB.validDate(key.slice(prefix.length))) dates.add(key.slice(prefix.length));
      }
    } catch (_) { /* Storage may be blocked; show only accessible observations. */ }
    const rows = [];
    [...dates].sort().reverse().forEach(date => {
      const log = FeedLog.read(date);
      log.entries.forEach(entry => (entry.review.flags ?? []).forEach(flag => rows.push(`<li>${UI.escape(date)} · ${UI.escape(entry.matchupLabel)} · ${UI.escape(flag)} <a href="${UI.gameHref(entry.gamePk, date)}#reviews">Game</a> · ${UI.source(MLB.gameURL(entry.gamePk))}</li>`)));
      Object.entries(log.irregularities).forEach(([pk, notes]) => {
        if (!Array.isArray(notes)) return;
        notes.filter(note => typeof note === 'string').forEach(note => rows.push(`<li>${UI.escape(date)} · ${UI.escape(note)} <a href="${UI.gameHref(pk, date)}">Game</a> · ${UI.source(MLB.gameURL(pk))}</li>`));
      });
    });
    root.innerHTML = rows.length ? `<ul>${rows.join('')}</ul>` : '<p>No flagged observations are stored in this browser. This does not certify unobserved games or missing history.</p>';
  }
  FeedLog.onChange(render); render();
  FeedLog.sync(UI.selectedDate()).catch(error => console.warn('Shared observation log unavailable:', error.message));
})();
