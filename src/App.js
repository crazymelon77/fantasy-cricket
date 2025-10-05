import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import HomePage from "./components/HomePage";
import CreateTournament from "./components/CreateTournament"; 
import EditTournament from "./components/EditTournament"; 
import JoinTournament from "./components/JoinTournament";// Import the new page
import "./styles.css";
import EnterMatchResults from "./components/EnterMatchResults";


function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/create-tournament" element={<CreateTournament />} />
          <Route path="/edit-tournament/:tournamentId" element={<EditTournament />} />
		  <Route path="/tournament/:id" element={<JoinTournament />} />
		  <Route path="/tournament/:tId/stage/:sId/match/:mId/results" element={<EnterMatchResults />} />


        </Routes>
      </div>
    </Router>
  );
}

export default App;


