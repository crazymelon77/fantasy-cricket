import React from "react";

/**
 * Reusable component that shows per-metric points breakdown for a player.
 * Used in MatchDetails and JoinTournament.
 *
 * @param {object} p - Player stats object from Firestore
 * @param {object} scoring - Stage scoring rules
 */
const PlayerBreakdown = ({ p, scoring }) => {
  const breakdownOrder = {
    Batting: [
      ["runs", "Runs Scored"],
      ["ballsFaced", "Balls Faced"],
	  ["zeros", "Ducks"],
      ["fours", "4s"],
      ["sixes", "6s"],
      ["milestones", "Milestones Hit"],
      ["notOuts", "Not Outs"],
    ],
    Bowling: [
      ["ballsBowled", "Balls Bowled"],
      ["dotBalls", "Dots"],
      ["maidenOvers", "Maidens"],
	  ["runsGiven", "Runs Conceded"],
      ["wickets", "Wickets"],
      ["wides", "Wides"],
      ["noBalls", "No Balls"],
	  ["hauls", "Inning Hauls"],
    ],
    Fielding: [
      ["catches", "Catches"],
      ["runouts", "Run Outs"],
    ],
    General: [
      ["played", "Game Bonus"],
      ["awayTeam", "Away Bonus"],
      ["won", "Win Bonus"],
	  ["mom", "MOM Bonus"],
    ],
  };

  return (
    <table className="score-table text-sm w-auto">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Stat</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(breakdownOrder).map(([category, metrics]) => {
          const pts = p.points || {};
          let catPoints = 0;
          if (category === "Batting") catPoints = pts.batting ?? 0;
          else if (category === "Bowling") catPoints = pts.bowling ?? 0;
          else if (category === "Fielding") catPoints = pts.fielding ?? 0;
          else if (category === "General") catPoints = pts.general ?? 0;

          const rows = metrics.filter(([key]) => p[key] !== undefined);
          if (rows.length === 0) return null;

          return (
            <React.Fragment key={category}>
              <tr style={{ background: "#e5e7eb", fontWeight: 600 }}>
                <td colSpan="3">
                  {category} ({catPoints})
                </td>
              </tr>

              {rows.map(([key, label]) => {
                const val = Number(p[key]) || 0;
                let pointsEarned = 0;

                // Batting
                if (category === "Batting") {
                  const bat = scoring.batting || {};
                  if (key === "runs") pointsEarned = val * (bat.perRun ?? 0);
                  else if (key === "ballsFaced") pointsEarned = val * (bat.perBallFaced ?? 0);
				  else if (key === "zeros") pointsEarned = val * (bat.perDuck ?? 0);
                  else if (key === "fours") pointsEarned = val * (bat.perFour ?? 0);
                  else if (key === "sixes") pointsEarned = val * (bat.perSix ?? 0);
                  else if (key === "milestones") pointsEarned = val * (bat.bonusEveryXRuns?.points ?? 0);
                  else if (key === "notOuts") pointsEarned = val * (bat.notOutBonus ?? 0);
                }
                // Bowling
                else if (category === "Bowling") {
                  const bowl = scoring.bowling || {};
                  if (key === "ballsBowled") pointsEarned = val * (bowl.perBallBowled ?? 0);
                  else if (key === "dotBalls") pointsEarned = val * (bowl.perDotBall ?? 0);
                  else if (key === "maidenOvers") pointsEarned = val * (bowl.perMaidenOver ?? 0);
                  else if (key === "wickets") pointsEarned = val * (bowl.perWicket ?? 0);
                  else if (key === "hauls") pointsEarned = val * (bowl.bonusAfterMinWickets?.points ?? 0);
                  else if (key === "runsGiven") pointsEarned = val * (bowl.perRunConceded ?? 0);
                  else if (key === "wides") pointsEarned = val * (bowl.perWide ?? 0);
                  else if (key === "noBalls") pointsEarned = val * (bowl.perNoBall ?? 0);
                }
                // Fielding
                else if (category === "Fielding") {
                  const field = scoring.fielding || {};
                  if (key === "catches") pointsEarned = val * (field.perCatch ?? 0);
                  else if (key === "runouts") pointsEarned = val * (field.perRunout ?? 0);
                }
                // General
                else if (category === "General") {
                  const gen = scoring.general || {};
                  if (key === "played") pointsEarned = val * (gen.perSelection ?? 0);
                  else if (key === "won") pointsEarned = val * (gen.perWin ?? 0);
                  else if (key === "mom") pointsEarned = val * (gen.manOfTheMatch ?? 0);
                  else if (key === "awayTeam") pointsEarned = val * (gen.awayTeamBonus ?? 0);
                }

                const displayVal =
                  category === "General"
                    ? val === 1 || val === true
                      ? "Yes"
                      : "No"
                    : String(val);

                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{displayVal}</td>
                    <td>{pointsEarned}</td>
                  </tr>
                );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

export default PlayerBreakdown;
