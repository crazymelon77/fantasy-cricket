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
      teams: [...(tournament.teams || []), { teamName: "", players: [] }],
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

  // ---------------- STAGES & MATCHES ----------------

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
      date: "",
      time: "",
      cutoff: "",
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

  return (
    <div className="edit-tournament-container" style={{ padding: "20px", overflowY: "auto", maxHeight: "100vh" }}>
      <h2>Edit Tournament</h2>
      <label>Tournament Name:</label>
      <input
        type="text"
        value={tournament.name}
        onChange={(e) => setTournament({ ...tournament, name: e.target.value })}
      />
      <label>Max Budget:</label>
      <input
        type="number"
        value={tournament.maxBudget}
        onChange={(e) => setTournament({ ...tournament, maxBudget: Number(e.target.value) })}
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

      {/* Teams Section */}
      <div style={{ marginTop: "20px" }}>
        <h3>Teams</h3>
        {tournament.teams?.map((team, index) => (
          <div key={index} style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ddd" }}>
            <input
              type="text"
              placeholder="Team Name"
              value={team.teamName}
              onChange={(e) => {
                const updatedTeams = [...tournament.teams];
                updatedTeams[index].teamName = e.target.value;
                setTournament({ ...tournament, teams: updatedTeams });
              }}
            />
            <button onClick={() => handleRemoveTeam(index)}>Remove Team</button>
            <h4>Players</h4>
            {team.players?.map((player, playerIndex) => (
              <div key={playerIndex}>
                <input
                  type="text"
                  placeholder="Player Name"
                  value={player.playerName}
                  onChange={(e) => handleMatchChange(index, playerIndex, "playerName", e.target.value)}
                />
                <select
                  value={player.role}
                  onChange={(e) => handleMatchChange(index, playerIndex, "role", e.target.value)}
                >
                  <option value="Batsman">Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All Rounder">All Rounder</option>
                  <option value="Wicket Keeper">Wicket Keeper</option>
                </select>
                <input
                  type="number"
                  placeholder="Value"
                  value={player.value}
                  onChange={(e) => handleMatchChange(index, playerIndex, "value", e.target.value)}
                />
                <button onClick={() => handleRemovePlayer(index, playerIndex)}>Remove Player</button>
              </div>
            ))}
            <button onClick={() => handleAddPlayer(index)}>Add Player</button>
          </div>
        ))}
        <button onClick={handleAddTeam}>Add Team</button>
      </div>

      {/* Stages & Matches */}
      <div style={{ marginTop: "20px" }}>
        <h3>Stages & Matches</h3>
  {tournament.stages?.map((stage, stageIndex) => (
    <div key={stageIndex} style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ddd" }}>
      <input
        type="text"
        placeholder="Stage Name"
        value={stage.stageName}
        onChange={(e) => handleMatchChange(stageIndex, -1, "stageName", e.target.value)}
      />
      <button onClick={() => handleRemoveStage(stageIndex)}>Remove Stage</button>

      <h4>Matches</h4>
      {stage.matches?.map((match, matchIndex) => (
        <div key={matchIndex} style={{ marginBottom: "10px", padding: "5px", border: "1px solid #ccc" }}>
          <label>Match {matchIndex + 1}</label>

          <div>
            <label>Team 1:</label>
				<select
				  value={match.team1}
				  onChange={(e) => handleMatchChange(stageIndex, matchIndex, "team1", e.target.value)}
				>
				  <option value="TBD">TBD</option>
				  {tournament.teams?.map((team, index) => (
					<option key={index} value={team.teamName}>
					  {team.teamName}
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
				  {tournament.teams?.map((team, index) => (
					<option key={index} value={team.teamName}>
					  {team.teamName}
					</option>
				  ))}
				</select>
          </div>

          <div>
            <label>Match Date:</label>
            <input
              type="date"
              value={match.date}
              onChange={(e) => handleMatchChange(stageIndex, matchIndex, "date", e.target.value)}
            />
          </div>

          <div>
            <label>Match Time:</label>
            <input
              type="time"
              value={match.time}
              onChange={(e) => handleMatchChange(stageIndex, matchIndex, "time", e.target.value)}
            />
          </div>

          <div>
            <label>Sub Cutoff:</label>
            <input
              type="datetime-local"
              value={match.cutoff}
              onChange={(e) => handleMatchChange(stageIndex, matchIndex, "cutoff", e.target.value)}
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
