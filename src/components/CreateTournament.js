import React, { useState, useEffect } from "react";
import { db, getTournaments } from "../firebase"; // Firebase functions
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTournament = () => {
  const [tournamentName, setTournamentName] = useState(""); // Input for tournament name
  const [maxBudget, setMaxBudget] = useState(1000000000); // Default budget
  const [teams, setTeams] = useState([]); // List of teams
  const [tournaments, setTournaments] = useState([]); // List of existing tournaments
  const navigate = useNavigate();

  /**
   * Fetches all tournaments from Firestore and updates state.
   */
  useEffect(() => {
    const fetchTournaments = async () => {
      const tournamentList = await getTournaments();
      setTournaments(tournamentList);
    };
    fetchTournaments();
  }, []);

  /**
   * Handles adding a new team dynamically.
   */
  const handleAddTeam = () => {
    setTeams([...teams, { teamName: "", players: [] }]);
  };

  /**
   * Handles removing a team.
   * @param {number} index - The index of the team to remove.
   */
  const handleRemoveTeam = (index) => {
    setTeams(teams.filter((_, i) => i !== index));
  };

  /**
   * Handles updating a team's name.
   * @param {number} index - The index of the team to update.
   * @param {string} value - The new name of the team.
   */
  const handleTeamNameChange = (index, value) => {
    const updatedTeams = [...teams];
    updatedTeams[index].teamName = value;
    setTeams(updatedTeams);
  };

  /**
   * Handles adding a new player to a team.
   * @param {number} teamIndex - The index of the team.
   */
  const handleAddPlayer = (teamIndex) => {
    const updatedTeams = [...teams];
    updatedTeams[teamIndex].players.push({ playerName: "", role: "", value: "" });
    setTeams(updatedTeams);
  };

  /**
   * Handles removing a player from a team.
   * @param {number} teamIndex - The index of the team.
   * @param {number} playerIndex - The index of the player to remove.
   */
  const handleRemovePlayer = (teamIndex, playerIndex) => {
    const updatedTeams = [...teams];
    updatedTeams[teamIndex].players = updatedTeams[teamIndex].players.filter((_, i) => i !== playerIndex);
    setTeams(updatedTeams);
  };

  /**
   * Handles updating a player's details.
   * @param {number} teamIndex - The index of the team.
   * @param {number} playerIndex - The index of the player.
   * @param {string} field - The field to update (playerName, role, value).
   * @param {string} value - The new value for the field.
   */
  const handlePlayerChange = (teamIndex, playerIndex, field, value) => {
    const updatedTeams = [...teams];
    updatedTeams[teamIndex].players[playerIndex][field] = value;
    setTeams(updatedTeams);
  };

  /**
   * Handles form submission and saves the tournament to Firestore.
   * @param {Event} e - Form submission event.
   */
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!tournamentName.trim()) {
      alert("Tournament name is required.");
      return;
    }
    try {
      await addDoc(collection(db, "tournaments"), {
        name: tournamentName,
        type: "classic", // Default tournament type
        maxBudget,
        active: false, // Default state
        teams, // Store teams with players inside Firestore
      });
      setTournamentName("");
      setMaxBudget(1000000000);
      setTeams([]);
      alert("Tournament created successfully!");
      const updatedTournaments = await getTournaments();
      setTournaments(updatedTournaments);
    } catch (error) {
      console.error("Error creating tournament:", error);
    }
  };

  /**
   * Handles deleting a tournament.
   * @param {string} id - The ID of the tournament to delete.
   */
  const handleDeleteTournament = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tournament?")) return;
    try {
      await deleteDoc(doc(db, "tournaments", id));
      const updatedTournaments = await getTournaments();
      setTournaments(updatedTournaments);
    } catch (error) {
      console.error("Error deleting tournament:", error);
    }
  };

  return (
    <div className="create-tournament-container">
      <h2>Create a New Tournament</h2>
      <form onSubmit={handleCreateTournament}>
        <label>Tournament Name:</label>
        <input type="text" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} required />

        <label>Max Budget for Fantasy Teams:</label>
        <input type="number" value={maxBudget} onChange={(e) => setMaxBudget(Number(e.target.value))} min="50" />

        <h3>Teams</h3>
        {teams.map((team, teamIndex) => (
          <div key={teamIndex} className="team-container">
            <input type="text" placeholder="Team Name" value={team.teamName} onChange={(e) => handleTeamNameChange(teamIndex, e.target.value)} />
            <button type="button" onClick={() => handleRemoveTeam(teamIndex)}>Remove Team</button>
            <h4>Players</h4>
            {team.players.map((player, playerIndex) => (
              <div key={playerIndex} className="player-container">
                <input type="text" placeholder="Player Name" value={player.playerName} onChange={(e) => handlePlayerChange(teamIndex, playerIndex, "playerName", e.target.value)} />
                <select value={player.role} onChange={(e) => handlePlayerChange(teamIndex, playerIndex, "role", e.target.value)}>
                  <option value="">Select Role</option>
                  <option value="Batsman">Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All Rounder">All Rounder</option>
                  <option value="Wicket Keeper">Wicket Keeper</option>
                </select>
                <input type="number" placeholder="Value" value={player.value} onChange={(e) => handlePlayerChange(teamIndex, playerIndex, "value", e.target.value)} />
                <button type="button" onClick={() => handleRemovePlayer(teamIndex, playerIndex)}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => handleAddPlayer(teamIndex)}>Add Player</button>
          </div>
        ))}
        <button type="button" onClick={handleAddTeam}>Add Team</button>
        <button type="submit">Create Tournament</button>
      </form>

      <h3>Existing Tournaments</h3>
      {tournaments.map(tournament => (
        <div key={tournament.id}>
          {tournament.name} 
          <button onClick={() => navigate(`/edit-tournament/${tournament.id}`)}>Edit</button>
          <button onClick={() => handleDeleteTournament(tournament.id)}>Delete</button>
        </div>
      ))}
      
      <button onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
};

export default CreateTournament;
