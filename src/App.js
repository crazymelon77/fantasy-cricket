import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import HomePage from "./components/HomePage";
import CreateTournament from "./components/CreateTournament"; 
import EditTournament from "./components/EditTournament"; 
import JoinTournament from "./components/JoinTournament";
import Leaderboard from "./components/Leaderboard";
import "./styles.css";
import EnterMatchResults from "./components/EnterMatchResults";
import MatchDetails from "./components/MatchDetails";



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
		  <Route path="/tournament/:tId/stage/:sId/match/:mId/scorecard" element={<MatchDetails />} />
		  <Route path="/tournament/:id/leaderboard" element={<Leaderboard />} />
		  




        </Routes>
      </div>
    </Router>
  );
}

export default App;


