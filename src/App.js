import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import HomePage from "./components/HomePage";
import CreateTournament from "./components/CreateTournament"; 
import EditTournament from "./components/EditTournament"; // Import the new page
import "./styles.css";

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/create-tournament" element={<CreateTournament />} />
          <Route path="/edit-tournament/:tournamentId" element={<EditTournament />} /> {/* New Route */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
