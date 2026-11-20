'use strict';
const Reviews = {
  extract(feed) {
    const rows = [];
    for (const play of feed.liveData.plays?.allPlays ?? []) {
      let found = false;
      for (const event of play.playEvents ?? []) {
        const details = event.details;
        if (event.reviewDetails || details?.reviewDetails || /review|challeng/i.test(details?.eventType ?? '')) {
          found = true;
          const review = event.reviewDetails ?? details?.reviewDetails;
          rows.push([play.about?.inning, details?.description, review?.reviewType ?? details?.event]);
        }
      }
      if (play.reviewDetails && !found) {
        rows.push([play.about?.inning, play.result?.description, play.reviewDetails.reviewType]);
      }
    }
    return rows.reverse();
  }
};
