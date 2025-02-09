import React, { useState, useEffect } from "react";
import { db, addTournament, getTournaments } from "../firebase"; // Firebase functions
import { collection, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTournament = () => {
  const [tournamentName, setTournamentName] = useState(""); // Input for tournament name
  const [maxBudget, setMaxBudget] = useState(100); // Default budget for fantasy teams
  const [tournaments, setTournaments] = useState([]); // List of tournaments
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
   * Handles form submission to create a new tournament.
   * @param {Event} e - Form submission event.
   */
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!tournamentName.trim()) {
      alert("Tournament name is required.");
      return;
    }

    try {
      await addTournament(tournamentName, maxBudget);
      setTournamentName("");
      setMaxBudget(100);
      
      // Refresh the tournament list after creation
      const updatedTournaments = await getTournaments();
      setTournaments(updatedTournaments);
    } catch (error) {
      console.error("Error creating tournament:", error);
    }
  };

  /**
   * Handles deleting a tournament from Firestore.
   * @param {string} id - The ID of the tournament to delete.
   */
  const handleDeleteTournament = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tournament?")) return;
    
    try {
      await deleteDoc(doc(db, "tournaments", id));
      
      // Refresh the tournament list after deletion
      const updatedTournaments = await getTournaments();
      setTournaments(updatedTournaments);
    } catch (error) {
      console.error("Error deleting tournament:", error);
    }
  };

  return (
    <div className="create-tournament-container">
      <h2>Create a New Tournament</h2>

      {/* Tournament Creation Form */}
      <form onSubmit={handleCreateTournament}>
        <label>Tournament Name:</label>
        <input 
          type="text" 
          value={tournamentName} 
          onChange={(e) => setTournamentName(e.target.value)} 
          required 
        />

        <label>Max Budget for Fantasy Teams:</label>
        <input 
          type="number" 
          value={maxBudget} 
          onChange={(e) => setMaxBudget(Number(e.target.value))} 
          min="50" 
          max="1000000000" 
        />

        <button type="submit">Create Tournament</button>
      </form>

      {/* List of Existing Tournaments */}
      <h3>Existing Tournaments</h3>
      <ul>
        {tournaments.map(tournament => (
          <li key={tournament.id}>
            {tournament.name} (Max Budget: {tournament.maxBudget})
            <button onClick={() => handleDeleteTournament(tournament.id)}>Delete</button>
          </li>
        ))}
      </ul>

      <button onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
};

export default CreateTournament;
