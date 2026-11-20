'use strict';
const MLB = (() => {
  const origin = 'https://statsapi.mlb.com';
  let retryAt = 0;
  async function read(path, signal) {
    if (Date.now() < retryAt) throw new Error('MLB is rate limiting requests. Please wait before refreshing.');
    const response = await fetch(origin + path, {signal});
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      const delay = header && /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now();
      retryAt = Date.now() + (Number.isFinite(delay) ? Math.max(1000, delay) : 60000);
    }
    if (!response.ok) throw new Error(`MLB returned HTTP ${response.status}.`);
    return response.json();
  }
  const schedulePath = date => `/api/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=team,probablePitcher,linescore,decisions`;
  const gamePath = id => `/api/v1.1/game/${id}/feed/live`;
  return {
    schedulePath, gamePath, source: path => origin + path,
    async schedule(date, signal) {
      const data = await read(schedulePath(date), signal);
      if (!Array.isArray(data.dates) || data.dates.some(day => !Array.isArray(day.games))) throw new Error('MLB schedule data is unavailable.');
      return data.dates.flatMap(day => day.games);
    },
    async game(id, signal) {
      if (!/^\d+$/.test(String(id))) throw new Error('A valid MLB game is required.');
      const data = await read(gamePath(id), signal);
      if (!data.gameData || !data.liveData) throw new Error('MLB game data is unavailable.');
      return data;
    }
  };
})();
