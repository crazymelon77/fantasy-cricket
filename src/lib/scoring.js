// src/lib/scoring.js

export function scoreBatting(bat, s) {
  if (!bat) return 0;
  let pts = 0;
  pts += (bat.perRun ?? 0) * (s.runs ?? 0);
  pts += (bat.perBallFaced ?? 0) * (s.ballsFaced ?? 0);
  pts += (bat.perFour ?? 0) * (s.fours ?? 0);
  pts += (bat.perSix ?? 0) * (s.sixes ?? 0);
  if (s.notOut) pts += (bat.notOutBonus ?? 0);
  if (bat.bonusEveryXRuns?.x && bat.bonusEveryXRuns?.points) {
    const times = s.milestones ?? 0;
    pts += times * bat.bonusEveryXRuns.points;
  }
  return pts;
}

export function scoreBowling(bowl, s) {
  if (!bowl) return 0;
  let pts = 0;
  pts += (bowl.perBallBowled ?? 0) * (s.ballsBowled ?? 0);
  pts += (bowl.perDotBall ?? 0) * (s.dotBalls ?? 0);
  pts += (bowl.perRunConceded ?? 0) * (s.runsConceded ?? 0);
  pts += (bowl.perWide ?? 0) * (s.wides ?? 0);
  pts += (bowl.perNoBall ?? 0) * (s.noBalls ?? 0);
  pts += (bowl.perWicket ?? 0) * (s.wickets ?? 0);
  if (bowl.bonusAfterMinWickets?.min && bowl.bonusAfterMinWickets?.points) {
    if ((s.wickets ?? 0) > bowl.bonusAfterMinWickets.min) {
      const overMin = s.hauls ?? 0;
      pts += overMin * bowl.bonusAfterMinWickets.points;
    }
  }
  return pts;
}

export function scoreFielding(field, s) {
  if (!field) return 0;
  return (
    (field.perCatch ?? 0) * (s.catches ?? 0) +
    (field.perRunout ?? 0) * (s.runouts ?? 0)
  );
}

export function scoreGeneral(gen, played, won) {
  if (!gen) return 0;
  return (played ? (gen.perSelection ?? 0) : 0) + (won ? (gen.perWin ?? 0) : 0);
}

export function scorePlayer(stageScoring, s, meta = { played: false, won: false }) {
  const { batting, bowling, fielding, general } = stageScoring || {};

  const battingPts = scoreBatting(batting, s);
  const bowlingPts = scoreBowling(bowling, s);
  const fieldingPts = scoreFielding(fielding, s);
  const generalPts = scoreGeneral(general, meta.played, meta.won);

  const total = battingPts + bowlingPts + fieldingPts + generalPts;

  return {
    total,
    batting: battingPts,
    bowling: bowlingPts,
    fielding: fieldingPts,
    general: generalPts,
  };
}

