'use strict';
const MLB = (() => {
  const host = 'https://statsapi.mlb.com';
  const scheduleURL = date => `${host}/api/v1/schedule?${new URLSearchParams({sportId: '1', date, hydrate: 'probablePitcher,linescore,decisions,review'})}`;
  const gameURL = id => `${host}/api/v1.1/game/${id}/feed/live`;
  const endpoint = (id, name) => `${host}/api/v1/game/${id}/${name}`;
  async function get(url) {
    const res = await fetch(url, {signal: AbortSignal.timeout(15000), credentials: 'omit'});
    if (!res.ok) throw new Error(`MLB StatsAPI returned HTTP ${res.status}`);
    return res.json();
  }
  async function schedule(date) {
    const data = await get(scheduleURL(date));
    if (!Array.isArray(data.dates)) throw new Error('Unrecognized MLB schedule response');
    return data.dates.flatMap(day => day.games ?? []);
  }
  return {scheduleURL, gameURL, endpoint, schedule, game: id => get(gameURL(id)), plays: id => get(endpoint(id, 'playByPlay'))};
})();
