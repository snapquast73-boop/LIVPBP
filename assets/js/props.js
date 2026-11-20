/* No recovered/official probability model exists: leave projections blank, show sourced facts. */
(() => {
  'use strict';
  function officialStats(feed) {
    const target = MLB.gameURL(feed.gamePk ?? feed.gameData?.game?.pk);
    const rows = [];
    for (const side of ['away', 'home']) {
      const club = feed.liveData?.boxscore?.teams?.[side];
      for (const playerId of club?.batters ?? []) {
        const player = club.players?.[`ID${playerId}`];
        if (!player) continue;
        const stats = player.seasonStats?.batting ?? {};
        rows.push([UI.cell(player.person?.fullName), UI.cell(feed.gameData?.teams?.[side]?.name),
          UI.cell(stats.avg), UI.cell(stats.obp), UI.cell(stats.slg), UI.cell(stats.ops), UI.cell(stats.hits), UI.cell(stats.atBats), UI.cell(stats.homeRuns)]);
      }
    }
    return rows.length ? UI.table('Season batting statistics supplied with this game (not a historical pregame projection)', ['Batter', 'Team', 'AVG', 'OBP', 'SLG', 'OPS', 'H', 'AB', 'HR'], rows, target) : '<p class="data-note">MLB has not supplied season batting statistics for this game. Values are blank/unverified.</p>';
  }
  function render(feed) {
    const target = MLB.gameURL(feed.gamePk ?? feed.gameData?.game?.pk);
    return `<h2>Props & Matchup</h2><div class="verification-notice">The uploaded project described a custom hit-probability model, but did not include its code or validation. MLB does not provide that model here. Forecast values are intentionally blank — unverified, never replaced with estimates. <a href="flagged-for-review.html#forecast">Review this limitation</a>.</div>
      ${UI.table('Hit forecast — unverified', ['Measure', 'Value'], [
        ['<td>Hit this plate appearance</td>', UI.cell(null)],
        ['<td>At least one hit in remaining plate appearances</td>', UI.cell(null)]
      ], target)}${officialStats(feed)}<p class="data-note">Numbers above are read as supplied by MLB; they are not betting advice, predicted outcomes, or claimed as-of-first-pitch statistics. ${UI.source(target)}</p>`;
  }
  window.Props = Object.freeze({ render });
})();
