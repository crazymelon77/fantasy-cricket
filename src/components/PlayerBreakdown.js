import React from "react";

/**
 * Reusable component that shows per-metric points breakdown for a player.
 * Used in MatchDetails and JoinTournament.
 *
 * @param {object} p - Player stats object from Firestore
 * @param {object} scoring - Stage scoring rules
 */
const PlayerBreakdown = ({ p, scoring }) => {
	const [openSections, setOpenSections] = React.useState({}); // { Batting: true/false, Bowling: true/false, ... }

    const toggleSection = (cat) => {
      setOpenSections((prev) => ({ ...prev, [cat]: !prev[cat] }));
    };

	
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
	Boosters: [],
  };

  return (
	<table className="score-table text-sm w-auto">
	  <thead>
		<tr>
		  <th>Metric</th>
		  <th>Stat</th>
		  <th>Points Earned</th>
		</tr>
	  </thead>

	  <tbody>
		{Object.entries(breakdownOrder).map(([category, metrics]) => {
		  const pts = p.points || {};
          const boosterDelta =
            p?.boosterEnabled === true &&
            p?.boosterEffect &&
            p.boosterEffect.delta != null
              ? Number(p.boosterEffect.delta) || 0
              : 0;

          // Boosters section only appears when boosters are enabled AND there is a non-zero effect
          if (category === "Boosters") {
            if (boosterDelta === 0) return null;
          }
		  
		  const catPoints =
			category === "Batting"
			  ? pts.batting ?? 0
			  : category === "Bowling"
			  ? pts.bowling ?? 0
			  : category === "Fielding"
			  ? pts.fielding ?? 0
			  : category === "General"
              ? pts.general ?? 0
              : boosterDelta;

		  const rows = metrics.filter(([key]) => p[key] !== undefined);
		  if (category !== "Boosters" && rows.length === 0) return null;

		  const isOpen = !!openSections[category];

		  return (
			<React.Fragment key={category}>
			  {/* Accordion Header */}
			  <tr
				onClick={() => toggleSection(category)}
				style={{
				  background: "#dbeafe",
				  fontWeight: 600,
				  cursor: "pointer",
				}}
			  >
				<td colSpan="3">
				  {category} ({catPoints})
				  <span style={{ float: "right" }}>
					{isOpen ? "▲" : "▼"}
				  </span>
				</td>
			  </tr>

			  {/* Collapsible content */}
			  {isOpen &&
			    category !== "Boosters" &&
				rows.map(([key, label]) => {
				  const val = Number(p[key]) || 0;
				  let pointsEarned = 0;

				  // Batting
				  if (category === "Batting") {
					const bat = scoring.batting || {};
					if (key === "runs") {
					  const perRun = bat.perRun ?? 0;
					  const runs = Number(p.runs ?? 0);
					  const balls = Number(p.ballsFaced ?? 0);

					  if (bat.useStrikeRateWeighting && balls > 0) {
						const srFactor = runs / balls;          // strike rate proportion
						pointsEarned = Math.ceil(perRun * runs * srFactor);   // SR-scaled + rounded up
					  } else {
						pointsEarned = perRun * runs;
					  }
					}
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
					
					else if (key === "runsGiven") {
					  const runsGiven = Number(p.runsGiven ?? 0);
					  const ballsBowled = Number(p.ballsBowled ?? 0);
					  const perRunConceded = bowl.perRunConceded ?? 0;
					  const targetEcon = bowl.targetEcon ?? 6; //target econ from edit tournament

					  if (bowl.useEconWeighting && ballsBowled > 0) {
						const factor = (1 - targetEcon / 6) + (runsGiven / ballsBowled); //formula to determine final points
						pointsEarned = Math.ceil(perRunConceded * runsGiven * factor); //econ-scaled + rounded up
					  } else {
						pointsEarned = runsGiven * perRunConceded;
					  }
					}
					
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
				
              {/* Boosters section content */}
              {isOpen &&
                category === "Boosters" &&
                boosterDelta !== 0 && (
                  <tr key="boosterEffect">
                    <td>Booster</td>
                    <td>{p.boosterEffect.boosterName || p.boosterEffect.boosterId || ""}</td>
                    <td>
                      {(boosterDelta > 0 ? "+" : "") + boosterDelta}
                    </td>
                  </tr>
                )}
			</React.Fragment>
		  );
		})}
	  </tbody>
	</table>
  );
};

export default PlayerBreakdown;
