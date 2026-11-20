import fs from 'node:fs';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname, '..');
export const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures/independent-official-824638.json'), 'utf8'));
// Synthetic state transitions exercise edge cases. These are NOT official baseball observations.
export function synthetic() {
  const feed = structuredClone(fixture.feed);
  feed.gameData.status = { abstractGameState: 'Live', detailedState: 'Manager challenge: Tag play', statusCode: 'MA', reason: 'Tag play' };
  feed.liveData.plays.currentPlay = undefined;
  feed.liveData.plays.allPlays = [{ atBatIndex: 0, about: { atBatIndex: 0, inning: 1, halfInning: 'top', isComplete: true },
    result: { event: 'Single', eventType: 'single', isOut: false, awayScore: 1, homeScore: 0, description: 'Synthetic test play' },
    playEvents: [{ index: 0, details: { description: 'Synthetic review event', awayScore: 1, homeScore: 0 },
      reviewDetails: { reviewType: 'MA', challengeTeamId: 113, inProgress: true } }],
    runners: [{ details: { isScoringEvent: true, playIndex: 0, runner: { id: 1 } } }] }];
  feed.liveData.linescore.teams.away.runs = 1;
  feed.liveData.linescore.teams.home.runs = 0;
  return feed;
}
