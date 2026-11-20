'use strict';
const Reviews = (() => {
  const registry = 'https://statsapi.mlb.com/api/v1/gameStatus';
  const active = status => UI.live(status) && (['M', 'N'].includes(status.codedGameState) || status.statusCode === 'IH');
  function category(code) {
    if (['MJ','NJ'].includes(code)) return 'ABS';
    if (['MH','NH','MS','NS'].includes(code)) return 'Boundary Calls';
    if (typeof code === 'string' && /^M[A-Z]$/.test(code)) return 'Challenges';
    return 'Reviews';
  }
  function extract(plays) {
    return (plays ?? []).flatMap(play => [play, ...(play.playEvents ?? [])]
      .filter(event => event.reviewDetails && Object.keys(event.reviewDetails).length)
      .map(event => ({details: event.reviewDetails, inning: play.about?.inning,
        description: event === play ? play.result?.description : event.details?.description,
        index: play.about?.atBatIndex, eventIndex: event === play ? 'play' : event.index})));
  }
  function rows(table, reviews, source, teams) {
    for (const {details, inning, description} of reviews) {
      const id = details.challengeTeamId;
      const team = teams.find(t => t?.id === id);
      UI.row(table, [inning, details.reviewType, team?.name, description,
        typeof details.isOverturned === 'boolean' ? (details.isOverturned ? 'Yes' : 'No') : null], source);
    }
  }
  const table = () => UI.table(['Inning', 'MLB review code', 'Challenging team', 'MLB description', 'Overturned']);
  return {registry, active, category, extract, rows, table};
})();
