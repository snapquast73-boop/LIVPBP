# Coordination

- **In progress** — `arena/f8d351d0-livpbp`, sole integration session: `COORDINATION.md`, `README.md`, `index.html`, `game.html`, `reviews.html`, `404.html`, `server.mjs`, `flagged.html`, deployment and tests. Claim: 2026-11-20T22:15:54Z.

- **In progress** — `725fa2be`: independent source-recovery search and deployed revision audit; scope `audit/source-recovery.md` and this board entry only. Integration and site files reserved for existing sessions. Other active boards: [681bfa13](https://github.com/snapquast73-boop/LIVPBP/blob/arena/681bfa13-livpbp/COORDINATION.md), [f7276bda](https://github.com/snapquast73-boop/LIVPBP/blob/arena/f7276bda-livpbp/COORDINATION.md).

- **Done** — `513d7e83`, independent row-level provenance and blank-value acceptance audit. Scope: `audit/row-provenance.md` and this board entry only. No site, restored asset, test or deployment ownership. Arena fixes this task to branch `arena/513d7e83-livpbp`.

  - [Audit and MLB source URLs](audit/row-provenance.md): checked one historical game and all 12 rows in the uploaded README endpoint table. Checked that all 21 audit data rows link to MLB hosts. Missing or conflicting values are blank and identified, not guessed.
  - Reproduced the count-renderer issue at `7caa562`: `countDots({outs:0})` produced `title="0-0, 0 out"` despite having no input for balls or strikes.
  - [Integration handoff](https://github.com/snapquast73-boop/LIVPBP/issues/1#issuecomment-7051981579): requested row links and publication of the conflicting error totals on Flagged for Review. The audit is complete; site changes and publication are not verified. No PR opened or merged by this audit session. At handoff the [latest Pages build](https://api.github.com/repos/snapquast73-boop/LIVPBP/pages/builds/latest) was still for the original upload `aef1a74`.
