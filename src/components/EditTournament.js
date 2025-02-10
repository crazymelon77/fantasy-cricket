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

  /**
   * Handles adding a new team.
   */
  const handleAddTeam = () => {
    setTournament({
      ...tournament,
      teams: [...(tournament.teams || []), { teamName: "", players: [] }],
    });
  };

  /**
   * Handles removing a team.
   */
  const handleRemoveTeam = (index) => {
    const updatedTeams = [...tournament.teams];
    updatedTeams.splice(index, 1);
    setTournament({ ...tournament, teams: updatedTeams });
  };

  /**
   * Handles adding a player to a team.
   */
  const handleAddPlayer = (teamIndex) => {
    const updatedTeams = [...tournament.teams];
    updatedTeams[teamIndex].players.push({ playerName: "", role: "", value: "" });
    setTournament({ ...tournament, teams: updatedTeams });
  };

  /**
   * Handles removing a player from a team.
   */
  const handleRemovePlayer = (teamIndex, playerIndex) => {
    const updatedTeams = [...tournament.teams];
    updatedTeams[teamIndex].players.splice(playerIndex, 1);
    setTournament({ ...tournament, teams: updatedTeams });
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
        {tournament.teams &&
          tournament.teams.map((team, index) => (
            <div key={index} style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ddd", borderRadius: "5px" }}>
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
              {team.players.map((player, playerIndex) => (
                <div key={playerIndex}>
                  <input
                    type="text"
                    placeholder="Player Name"
                    value={player.playerName}
                    onChange={(e) => {
                      const updatedTeams = [...tournament.teams];
                      updatedTeams[index].players[playerIndex].playerName = e.target.value;
                      setTournament({ ...tournament, teams: updatedTeams });
                    }}
                  />
                  <select
                    value={player.role}
                    onChange={(e) => {
                      const updatedTeams = [...tournament.teams];
                      updatedTeams[index].players[playerIndex].role = e.target.value;
                      setTournament({ ...tournament, teams: updatedTeams });
                    }}
                  >
                    <option value="">Select Role</option>
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All Rounder">All Rounder</option>
                    <option value="Wicket Keeper">Wicket Keeper</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Value"
                    value={player.value}
                    onChange={(e) => {
                      const updatedTeams = [...tournament.teams];
                      updatedTeams[index].players[playerIndex].value = e.target.value;
                      setTournament({ ...tournament, teams: updatedTeams });
                    }}
                  />
                  <button onClick={() => handleRemovePlayer(index, playerIndex)}>Remove Player</button>
                </div>
              ))}
              <button onClick={() => handleAddPlayer(index)}>Add Player</button>
            </div>
          ))}
        <button onClick={handleAddTeam}>Add Team</button>
      </div>
      <button onClick={handleSave}>Save</button>
      <button onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
};

export default EditTournament;
