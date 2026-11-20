/* MLB's own host is the sole authority for baseball data. No bundled scores. */
(() => {
  'use strict';
  const ROOT = 'https://statsapi.mlb.com';
  const pending = new Map();
  let quietUntil = 0;

  class APIError extends Error {
    constructor(message, status = 0) { super(message); this.name = 'APIError'; this.status = status; }
  }
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function id(value) {
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
      throw new APIError('A valid MLB identifier is required.');
    }
    return String(Number(value));
  }
  function url(path, params = {}) {
    const target = new URL(path, ROOT);
    if (target.origin !== ROOT) throw new APIError('Only official MLB endpoints are allowed.');
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) target.searchParams.set(key, String(value));
    });
    return target.href;
  }
  function retryAfter(value, now = Date.now()) {
    const seconds = value === null || value === '' ? NaN : Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
    return Math.max(1000, Math.min(300000, Number.isFinite(delay) ? delay : 60000));
  }
  async function request(target) {
    if (Date.now() < quietUntil) throw new APIError('MLB requested a pause. Retrying after its rate-limit cooldown.', 429);
    if (pending.has(target)) return pending.get(target);
    const job = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(target, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (response.status === 429) quietUntil = Date.now() + retryAfter(response.headers.get('Retry-After'));
        if (!response.ok) throw new APIError(`MLB data request failed (HTTP ${response.status}).`, response.status);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object') throw new APIError('MLB returned an invalid response.');
        return payload;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(error.name === 'AbortError'
          ? 'MLB took too long to respond. Please retry.'
          : 'Unable to load official MLB data. Check your connection or retry.');
      } finally { clearTimeout(timer); }
    })();
    pending.set(target, job);
    try { return await job; } finally { pending.delete(target); }
  }
  const scheduleURL = selectedDate => {
    if (!date(selectedDate)) throw new APIError('Choose a valid calendar date.');
    return url('/api/v1/schedule', { sportId: 1, date: selectedDate, hydrate: 'probablePitcher,linescore,decisions,review' });
  };
  const gameURL = gamePk => url(`/api/v1.1/game/${id(gamePk)}/feed/live`);
  async function live(gamePk, fields) {
    const params = fields ? { fields } : {};
    try { return await request(url(`/api/v1.1/game/${id(gamePk)}/feed/live`, params)); }
    catch (error) {
      if (error.status !== 404) throw error;
      return request(url(`/api/v1/game/${id(gamePk)}/feed/live`, params));
    }
  }
  // Include every property consumed by the replay parser; exclude player rosters and pitch telemetry.
  const REPLAY_FIELDS = [
    'gamePk,gameData,game,pk,season,datetime,officialDate,status,abstractGameState,detailedState,statusCode,reason',
    'teams,away,home,id,name,abbreviation,review,used,remaining,absChallenges,usedSuccessful,usedFailed',
    'liveData,linescore,runs,hits,errors,plays,allPlays,currentPlay,atBatIndex,about,inning,halfInning',
    'isComplete,startTime,endTime,hasReview,result,event,eventType,description,awayScore,homeScore,isOut,rbi',
    'matchup,batter,pitcher,fullName,playEvents,index,isPitch,details,reviewDetails,reviewType,challengeTeamId',
    'inProgress,isOverturned,count,balls,strikes,outs,runners,movement,runner,isScoringEvent,playIndex'
  ].join(',');
  function statsURL(playerId, group, season) {
    if (!['hitting', 'pitching'].includes(group) || !/^\d{4}$/.test(String(season))) throw new APIError('Invalid statistics request.');
    return url(`/api/v1/people/${id(playerId)}/stats`, { stats: 'season', group, season });
  }
  window.MLB = Object.freeze({
    ROOT, APIError, url, id, validDate: date, retryAfter, scheduleURL, gameURL, statsURL, REPLAY_FIELDS,
    get: (path, params) => request(url(path, params)),
    schedule: selectedDate => request(scheduleURL(selectedDate)),
    live, replay: gamePk => live(gamePk, REPLAY_FIELDS),
    registry: () => request(url('/api/v1/gameStatus')),
    stats: (playerId, group, season) => request(statsURL(playerId, group, season)),
    cooldown: () => Math.max(0, quietUntil - Date.now())
  });
})();
