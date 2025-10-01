import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

const EditTournament = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Fetches tournament details from Firestore and updates state.
     */
    const fetchTournament = async () => {
      try {
        const docRef = doc(db, "tournaments", tournamentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTournament({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.error("Tournament not found");
          navigate("/");
        }
      } catch (error) {
        console.error("Error fetching tournament:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTournament();
  }, [tournamentId, navigate]);

  /**
   * Handles updating tournament details in Firestore.
   */
  const handleSave = async () => {
    try {
      const docRef = doc(db, "tournaments", tournamentId);
      await updateDoc(docRef, tournament);
      console.log("Tournament updated successfully!");
    } catch (error) {
      console.error("Error updating tournament:", error);
    }
  };

  // ---------------- TEAMS & PLAYERS ----------------

  const handleAddTeam = () => {
    setTournament({
      ...tournament,
      teams: [...(tournament.teams || []), { name: "", players: [] }],
    });
  };

  const handleRemoveTeam = (index) => {
    const updatedTeams = [...tournament.teams];
    updatedTeams.splice(index, 1);
    setTournament({ ...tournament, teams: updatedTeams });
  };

  const handleAddPlayer = (teamIndex) => {
    const updatedTeams = [...tournament.teams];
    updatedTeams[teamIndex].players.push({ playerName: "", role: "", value: "" });
    setTournament({ ...tournament, teams: updatedTeams });
  };

  const handleRemovePlayer = (teamIndex, playerIndex) => {
    const updatedTeams = [...tournament.teams];
    updatedTeams[teamIndex].players.splice(playerIndex, 1);
    setTournament({ ...tournament, teams: updatedTeams });
  };
  
  const handlePlayerChange = (teamIndex, playerIndex, field, value) => {
	const updatedTeams = [...tournament.teams];
	updatedTeams[teamIndex].players[playerIndex][field] = value;
	setTournament({ ...tournament, teams: updatedTeams });
  };

  const handleImportCSV = (e, teamIndex) => {
	  const file = e.target.files[0];
	  if (!file) return;

	  const reader = new FileReader();
	  reader.onload = (event) => {
		const lines = event.target.result
		  .split("\n")
		  .map((line) => line.trim())
		  .filter(Boolean);

		const parsedPlayers = lines.map((line) => {
		  const [playerName, role, value] = line.split(",").map((x) => x.trim());
		  return {
			playerName,
			role,
			value: value ? Number(value) : 100,
		  };
		});

		const updatedTeams = [...tournament.teams];
		updatedTeams[teamIndex].players.push(...parsedPlayers);
		setTournament({ ...tournament, teams: updatedTeams });
	  };
	  reader.readAsText(file);
  };
  
  const handleImportCSVForStageTeam = (e, stageIndex, teamIndex) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const lines = event.target.result
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsedPlayers = lines.map((line) => {
      const [playerName, role, value] = line.split(",").map((x) => x.trim());
      return {
        playerName,
        role,
        value: value ? Number(value) : 100,
      };
    });

    const updatedStages = [...tournament.stages];
    updatedStages[stageIndex].teams[teamIndex].players.push(...parsedPlayers);
    setTournament({ ...tournament, stages: updatedStages });
  };
  reader.readAsText(file);
};


  // ---------------- STAGES & MATCHES ----------------
  const handleStageChange = (stageIndex, field, value) => {
	console.log("Updating stage", stageIndex, field, value);
	const updatedStages = [...tournament.stages];
	updatedStages[stageIndex][field] = value;
	setTournament({ ...tournament, stages: updatedStages });
  };
  
  const handleAddStage = () => {
    setTournament({
      ...tournament,
      stages: [...(tournament.stages || []), { name: "", matches: [], subsAllowed: 0 }],
    });
  };

  const handleRemoveStage = (stageIndex) => {
    const updatedStages = [...tournament.stages];
    updatedStages.splice(stageIndex, 1);
    setTournament({ ...tournament, stages: updatedStages });
  };

  const handleAddMatch = (stageIndex) => {
    const updatedStages = [...tournament.stages];
    updatedStages[stageIndex].matches.push({
      team1: "TBD",
      team2: "TBD",
      matchDate: null,
      cutoff: null,
    });
    setTournament({ ...tournament, stages: updatedStages });
  };

  const handleRemoveMatch = (stageIndex, matchIndex) => {
    const updatedStages = [...tournament.stages];
    updatedStages[stageIndex].matches.splice(matchIndex, 1);
    setTournament({ ...tournament, stages: updatedStages });
  };

  const handleMatchChange = (stageIndex, matchIndex, field, value) => {
    const updatedStages = [...tournament.stages];
    updatedStages[stageIndex].matches[matchIndex][field] = value;
    setTournament({ ...tournament, stages: updatedStages });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

	const formatForInput = (date) => {
	  if (!date) return "";
	  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
	  const tzOffset = d.getTimezoneOffset() * 60000; // offset in ms
	  return new Date(d - tzOffset).toISOString().slice(0, 16);
	};


  return (
    <div className="edit-tournament-container" style={{ padding: "20px", overflowY: "auto", maxHeight: "100vh" }}>
      <h2>Edit Tournament</h2>
      <label>Tournament Name:</label>
      <input
        type="text"
        value={tournament.name}
        onChange={(e) => setTournament({ ...tournament, name: e.target.value })}
      />

      <label>Type:</label>
      <select
        value={tournament.type}
        onChange={(e) => setTournament({ ...tournament, type: e.target.value })}
      >
        <option value="classic">Classic</option>
      </select>
      <label>Active:</label>
      <input
        type="checkbox"
        checked={tournament.active}
        onChange={(e) => setTournament({ ...tournament, active: e.target.checked })}
      />


		{/* Stages & Matches */}
		<div style={{ marginTop: "20px" }}>
		  <h3>Stages & Matches</h3>
		  {tournament.stages?.map((stage, stageIndex) => (
			<div
			  key={stageIndex}
			  style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ddd" }}
			>
			  <input
				type="text"
				placeholder="Stage Name"
				value={stage.name}
				onChange={(e) => handleStageChange(stageIndex, "name", e.target.value)}
			  />
			  <button onClick={() => handleRemoveStage(stageIndex)}>Remove Stage</button>

			  <label>Max Subs:</label>
			  <input
				type="number"
				value={stage.subsAllowed}
				onChange={(e) =>
				  handleStageChange(stageIndex, "subsAllowed", Number(e.target.value))
				}
			  />
			  <label>Budget:</label>
				<input
				  type="number"
				  value={stage.budget || 0}
				  onChange={(e) => {
					const updatedStages = [...tournament.stages];
					updatedStages[stageIndex].budget = Number(e.target.value);
					setTournament({ ...tournament, stages: updatedStages });
				  }}
				/>


			  {/* Role Composition */}
			  <h4>Role Composition</h4>
			  <div>
				<label>Batsmen:</label>
				<input
				  type="number"
				  value={stage.roleComposition?.batsman || 0}
				  onChange={(e) => {
					const updatedStages = [...tournament.stages];
					updatedStages[stageIndex].roleComposition = {
					  ...updatedStages[stageIndex].roleComposition,
					  batsman: Number(e.target.value),
					};
					setTournament({ ...tournament, stages: updatedStages });
				  }}
				/>
			  </div>
			  <div>
				<label>Bowlers:</label>
				<input
				  type="number"
				  value={stage.roleComposition?.bowler || 0}
				  onChange={(e) => {
					const updatedStages = [...tournament.stages];
					updatedStages[stageIndex].roleComposition = {
					  ...updatedStages[stageIndex].roleComposition,
					  bowler: Number(e.target.value),
					};
					setTournament({ ...tournament, stages: updatedStages });
				  }}
				/>
			  </div>
			  <div>
				<label>All Rounders:</label>
				<input
				  type="number"
				  value={stage.roleComposition?.allRounder || 0}
				  onChange={(e) => {
					const updatedStages = [...tournament.stages];
					updatedStages[stageIndex].roleComposition = {
					  ...updatedStages[stageIndex].roleComposition,
					  allRounder: Number(e.target.value),
					};
					setTournament({ ...tournament, stages: updatedStages });
				  }}
				/>
			  </div>
			{/* Scoring Rules */}
			
			<h4>Scoring Rules – General</h4>
			<div>
			  <label>Points for Win:</label>
			  <input
				type="number"
				value={stage.scoring?.general?.perWin ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					general: {
					  ...updatedStages[stageIndex].scoring?.general,
					  perWin: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points for Selection (played match):</label>
			  <input
				type="number"
				value={stage.scoring?.general?.perSelection ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					general: {
					  ...updatedStages[stageIndex].scoring?.general,
					  perSelection: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			
			
			
			<h4>Scoring Rules – Batting</h4>
			<div>
			  <label>Points per Run:</label>
			  <input
				type="number"
				value={stage.scoring?.batting?.perRun ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  perRun: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per Ball Faced:</label>
			  <input
				type="number"
				value={stage.scoring?.batting?.perBallFaced ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  perBallFaced: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per 4:</label>
			  <input
				type="number"
				value={stage.scoring?.batting?.perFour ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  perFour: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per 6:</label>
			  <input
				type="number"
				value={stage.scoring?.batting?.perSix ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  perSix: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Bonus points every </label>
			  <input
				type="number"
				style={{ width: "60px" }}
				value={stage.scoring?.batting?.bonusEveryXRuns?.x ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  bonusEveryXRuns: {
						...(updatedStages[stageIndex].scoring?.batting?.bonusEveryXRuns || {}),
						x: Number(e.target.value),
						points: stage.scoring?.batting?.bonusEveryXRuns?.points ?? 0,
					  },
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			  <label> runs: </label>
			  <input
				type="number"
				style={{ width: "60px" }}
				value={stage.scoring?.batting?.bonusEveryXRuns?.points ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  bonusEveryXRuns: {
						...(updatedStages[stageIndex].scoring?.batting?.bonusEveryXRuns || {}),
						x: stage.scoring?.batting?.bonusEveryXRuns?.x ?? 0,
						points: Number(e.target.value),
					  },
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Bonus for Not Out:</label>
			  <input
				type="number"
				value={stage.scoring?.batting?.notOutBonus ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					batting: {
					  ...updatedStages[stageIndex].scoring?.batting,
					  notOutBonus: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>

			<h4>Scoring Rules – Bowling</h4>
			<div>
			  <label>Points per Ball Bowled:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perBallBowled ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  perBallBowled: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per Dot Ball:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perDotBall ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  perDotBall: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per Run Conceded:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perRunConceded ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  perRunConceded: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per Wide:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perWide ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  perWide: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per No Ball:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perNoBall ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  perNoBall: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per Wicket:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perWicket ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  perWicket: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Bonus points for every wicket after </label>
			  <input
				type="number"
				style={{ width: "60px" }}
				value={stage.scoring?.bowling?.bonusAfterMinWickets?.min ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  bonusAfterMinWickets: {
						...(updatedStages[stageIndex].scoring?.bowling?.bonusAfterMinWickets || {}),
						min: Number(e.target.value),
						points: stage.scoring?.bowling?.bonusAfterMinWickets?.points ?? 0,
					  },
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			  <label> wickets: </label>
			  <input
				type="number"
				style={{ width: "60px" }}
				value={stage.scoring?.bowling?.bonusAfterMinWickets?.points ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					bowling: {
					  ...updatedStages[stageIndex].scoring?.bowling,
					  bonusAfterMinWickets: {
						...(updatedStages[stageIndex].scoring?.bowling?.bonusAfterMinWickets || {}),
						min: stage.scoring?.bowling?.bonusAfterMinWickets?.min ?? 0,
						points: Number(e.target.value),
					  },
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>

			<h4>Scoring Rules – Fielding</h4>
			<div>
			  <label>Points per Catch:</label>
			  <input
				type="number"
				value={stage.scoring?.fielding?.perCatch ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					fielding: {
					  ...updatedStages[stageIndex].scoring?.fielding,
					  perCatch: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>
			<div>
			  <label>Points per Run Out:</label>
			  <input
				type="number"
				value={stage.scoring?.fielding?.perRunout ?? 0}
				onChange={(e) => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].scoring = {
					...updatedStages[stageIndex].scoring,
					fielding: {
					  ...updatedStages[stageIndex].scoring?.fielding,
					  perRunout: Number(e.target.value),
					},
				  };
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  />
			</div>

			  {/* Stage Teams & Squads */}
			  <h4>Stage Teams</h4>
			  {stage.teams?.map((team, teamIndex) => (
				<div
				  key={teamIndex}
				  style={{ marginBottom: "10px", padding: "5px", border: "1px solid #aaa" }}
				>
				  <input
					type="text"
					placeholder="Team Name"
					value={team.name}
					onChange={(e) => {
					  const updatedStages = [...tournament.stages];
					  updatedStages[stageIndex].teams[teamIndex].name = e.target.value;
					  setTournament({ ...tournament, stages: updatedStages });
					}}
				  />
				  <button
					onClick={() => {
					  const updatedStages = [...tournament.stages];
					  updatedStages[stageIndex].teams.splice(teamIndex, 1);
					  setTournament({ ...tournament, stages: updatedStages });
					}}
				  >
					Remove Team
				  </button>

				  <h5>Players</h5>
				  {team.players?.map((player, playerIndex) => (
					<div key={playerIndex}>
					  <input
						type="text"
						placeholder="Player Name"
						value={player.playerName}
						onChange={(e) => {
						  const updatedStages = [...tournament.stages];
						  updatedStages[stageIndex].teams[teamIndex].players[playerIndex].playerName =
							e.target.value;
						  setTournament({ ...tournament, stages: updatedStages });
						}}
					  />
					  <select
						value={player.role}
						onChange={(e) => {
						  const updatedStages = [...tournament.stages];
						  updatedStages[stageIndex].teams[teamIndex].players[playerIndex].role =
							e.target.value;
						  setTournament({ ...tournament, stages: updatedStages });
						}}
					  >
						<option value="Batsman">Batsman</option>
						<option value="Bowler">Bowler</option>
						<option value="All Rounder">All Rounder</option>
					  </select>
					  <input
						type="number"
						placeholder="Value"
						value={player.value}
						onChange={(e) => {
						  const updatedStages = [...tournament.stages];
						  updatedStages[stageIndex].teams[teamIndex].players[playerIndex].value =
							Number(e.target.value);
						  setTournament({ ...tournament, stages: updatedStages });
						}}
					  />
					  <button
						onClick={() => {
						  const updatedStages = [...tournament.stages];
						  updatedStages[stageIndex].teams[teamIndex].players.splice(playerIndex, 1);
						  setTournament({ ...tournament, stages: updatedStages });
						}}
					  >
						Remove Player
					  </button>
					</div>
				  ))}
				  <button
					onClick={() => {
					  const updatedStages = [...tournament.stages];
					  updatedStages[stageIndex].teams[teamIndex].players.push({
						playerName: "",
						role: "",
						value: 100,
					  });
					  setTournament({ ...tournament, stages: updatedStages });
					}}
				  >
					Add Player
				  </button>
				  <button onClick={() => document.getElementById(`csv-stage-${stageIndex}-${teamIndex}`).click()}>
					  Import CSV
					</button>
					<input
					  id={`csv-stage-${stageIndex}-${teamIndex}`}
					  type="file"
					  accept=".csv"
					  style={{ display: "none" }}
					  onChange={(e) => handleImportCSVForStageTeam(e, stageIndex, teamIndex)}
					/>

				  
				</div>
			  ))}
			  <button
				onClick={() => {
				  const updatedStages = [...tournament.stages];
				  updatedStages[stageIndex].teams = [
					...(updatedStages[stageIndex].teams || []),
					{ name: "", players: [] },
				  ];
				  setTournament({ ...tournament, stages: updatedStages });
				}}
			  >
				Add Team
			  </button>

				{/* Matches */}
				<h4>Matches</h4>
				{stage.matches?.map((match, matchIndex) => (
				  <div
					key={matchIndex}
					style={{ marginBottom: "10px", padding: "5px", border: "1px solid #ccc" }}
				  >
					<label>Match {matchIndex + 1}</label>

					<div>
					  <label>Team 1:</label>
					  <select
						value={match.team1}
						onChange={(e) => handleMatchChange(stageIndex, matchIndex, "team1", e.target.value)}
					  >
						<option value="TBD">TBD</option>
						{stage.teams?.map((team, index) => (
						  <option key={index} value={team.name}>
							{team.name}
						  </option>
						))}
					  </select>
					</div>

					<div>
					  <label>Team 2:</label>
					  <select
						value={match.team2}
						onChange={(e) => handleMatchChange(stageIndex, matchIndex, "team2", e.target.value)}
					  >
						<option value="TBD">TBD</option>
						{stage.teams?.map((team, index) => (
						  <option key={index} value={team.name}>
							{team.name}
						  </option>
						))}
					  </select>
					</div>

					<div>
					  <label>Match Date & Time:</label>
					  <input
						type="datetime-local"
						value={formatForInput(match.matchDate)}
						onChange={(e) =>
						  handleMatchChange(stageIndex, matchIndex, "matchDate", new Date(e.target.value))
						}
					  />
					</div>

					<div>
					  <label>Sub Cutoff:</label>
					  <input
						type="datetime-local"
						value={formatForInput(match.cutoffDate)}
						onChange={(e) =>
						  handleMatchChange(stageIndex, matchIndex, "cutoffDate", new Date(e.target.value))
						}
					  />
					</div>

					<button onClick={() => handleRemoveMatch(stageIndex, matchIndex)}>Remove Match</button>
				  </div>
				))}
				<button onClick={() => handleAddMatch(stageIndex)}>Add Match</button>
			</div>
		  ))}
		  <button onClick={handleAddStage}>Add Stage</button>
		</div>

      <button onClick={handleSave}>Save</button>
      <button onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
};

export default EditTournament;
