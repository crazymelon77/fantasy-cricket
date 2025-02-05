import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Auth />} />
      </Routes>
    </Router>
  );
}

export default App;
