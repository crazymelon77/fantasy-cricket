import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTournament = () => {
  const [tournamentName, setTournamentName] = useState("");
  const [maxBudget, setMaxBudget] = useState(100);
  const [tournaments, setTournaments] = useState([]);
  const navigate = useNavigate();
  const auth = getAuth();

  
  // Fetch tournaments from Firebase
  const fetchTournaments = async () => {
    try {
      console.log("Fetching tournaments from Firestore...");
      const querySnapshot = await getDocs(collection(db, "tournaments"));
      const tournamentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("Fetched Tournaments:", tournamentList);
      setTournaments(tournamentList);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    }
  };

  // Ensure tournaments are fetched when the component mounts
  useEffect(() => {
    fetchTournaments();
  }, []);

  // Handle form submission (Create Tournament)
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
      console.error('No user signed in');
      return;
    }

    console.log('Attempting tournament creation with user:', {
      email: auth.currentUser.email,
      uid: auth.currentUser.uid
    });

    if (!tournamentName.trim()) {
      alert("Tournament name is required.");
      return;
    }

    try {
      const result = await addDoc(collection(db, "tournaments"), {
        name: tournamentName,
        maxBudget,
        stages: [],
        active: false,
        createdBy: auth.currentUser.email,
        createdAt: new Date().toISOString(),
      });
      console.log("Tournament created with ID:", result.id);
      setTournamentName("");
      setMaxBudget(100);
      fetchTournaments();
    } catch (error) {
      console.error("Full error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      alert(`Error creating tournament: ${error.message}`);
    }
  };

  // Handle deleting a tournament
  const handleDeleteTournament = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tournament?")) return;
    try {
      console.log("Deleting tournament ID:", id);
      await deleteDoc(doc(db, "tournaments", id));
      fetchTournaments();
    } catch (error) {
      console.error("Error deleting tournament:", error);
    }
  };

  return (
    <div className="create-tournament-container">
      <h2>Create a New Tournament</h2>
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
          max="500" 
        />
        <button type="submit">Create Tournament</button>
      </form>
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