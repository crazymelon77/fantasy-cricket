import React, { useState, useEffect } from "react";
import { db, getTournaments } from "../firebase"; // Firebase functions
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTournament = () => {
  const [tournamentName, setTournamentName] = useState(""); // Input for tournament name
  const [maxBudget, setMaxBudget] = useState(1000000000); // Default budget
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
   * Handles form submission and saves the tournament to Firestore.
   * @param {Event} e - Form submission event.
   */
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!tournamentName.trim()) {
      console.log("Tournament name is required.");
      return;
    }
    try {
      await addDoc(collection(db, "tournaments"), {
        name: tournamentName,
        type: "classic", // Default tournament type
        active: false, // Default state
        stages: [], // Initialize with an empty stages array
      });
      setTournamentName("");
      setMaxBudget(1100);
      console.log("Tournament created successfully.");
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
      console.log("Tournament deleted successfully.");
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
        <button type="submit">Create Tournament</button>
      </form>

      <h3>Existing Tournaments</h3>
      {tournaments.map(tournament => (
        <div key={tournament.id}>
          {tournament.name} 
          <button onClick={() => navigate(`/edit-tournament/${tournament.id}`)}>Edit</button> {/* Edit Button */}
          <button onClick={() => handleDeleteTournament(tournament.id)}>Delete</button>
        </div>
      ))}

      <button onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
};

export default CreateTournament;
