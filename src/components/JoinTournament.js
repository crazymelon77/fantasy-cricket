import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { query, orderBy } from "firebase/firestore";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const JoinTournament = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);
  const [teamsByStage, setTeamsByStage] = useState({});
  const [playersByTeam, setPlayersByTeam] = useState({});
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState(null);
  const [joined, setJoined] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState({});
  const [budgetLeftByStage, setBudgetLeftByStage] = useState({});
  const [expandedStage, setExpandedStage] = useState(null);
  const [sortConfig, setSortConfig] = useState({ field: null, dir: "asc" });
  
  const [stageResults, setStageResults] = useState({});
  const [expandedMatches, setExpandedMatches] = useState({});

  const toggleMatchDetails = (matchId) => {
    setExpandedMatches((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      const newDir = prev.field === field && prev.dir === "asc" ? "desc" : "asc";
      return { field, dir: newDir };
    });
  };

  // track auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // fetch tournament + subcollections
  useEffect(() => {
    const fetchData = async () => {
      try {
        const tourRef = doc(db, "tournaments", id);
        const tourSnap = await getDoc(tourRef);
        if (!tourSnap.exists()) {
          alert("Tournament not found");
          navigate("/");
          return;
        }
        setTournament({ id: tourSnap.id, ...tourSnap.data() });

		// fetch stages
		const stageSnap = await getDocs(
		  query(collection(tourRef, "stages"), orderBy("order", "asc"))
		);
		const stageList = stageSnap.docs.map((s) => ({ id: s.id, ...s.data() }));
		setStages(stageList);

        const teamsData = {};
        const playersData = {};

        for (const stage of stageList) {
          const teamSnap = await getDocs(collection(tourRef, "stages", stage.id, "teams"));
          const teamList = teamSnap.docs.map((t) => ({ id: t.id, ...t.data() }));
          teamsData[stage.id] = teamList;

          for (const team of teamList) {
            const playerSnap = await getDocs(
              collection(tourRef, "stages", stage.id, "teams", team.id, "players")
            );
            playersData[team.id] = playerSnap.docs.map((p) => ({
              id: p.id,
              ...p.data(),
              team: team.name
            }));
          }
        }
        setTeamsByStage(teamsData);
        setPlayersByTeam(playersData);
      } catch (err) {
        console.error("Error fetching tournament:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  // check join status
  useEffect(() => {
    if (!user) return;
    const checkJoined = async () => {
      const userRef = doc(db, "user_teams", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data[id]?.joined) setJoined(true);
        if (data[id]?.stages) setSelectedPlayers(data[id].stages);
        if (data[id]?.budgets) setBudgetLeftByStage(data[id].budgets);
      }
    };
    checkJoined();
  }, [user, id]);

  // join tournament
  const handleJoin = async () => {
    if (!user) {
      alert("You must be signed in to join");
      return;
    }
    try {
      const userRef = doc(db, "user_teams", user.uid);
      await setDoc(userRef, { [id]: { joined: true, stages: {}, budgets: {} } }, { merge: true });
      setJoined(true);
    } catch (err) {
      console.error("Error joining tournament:", err);
    }
  };

  // leave tournament
  const handleLeave = async () => {
    if (!user) return;
    if (!window.confirm("Leaving will remove your team. Are you sure?")) return;

    try {
      const userRef = doc(db, "user_teams", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        delete data[id];
        await setDoc(userRef, data);
      }
      setJoined(false);
      setSelectedPlayers({});
      setBudgetLeftByStage({});
    } catch (err) {
      console.error("Error leaving tournament:", err);
    }
  };

  // toggle player
  const togglePlayer = (stageId, player) => {
    if (!joined) return;
    const stagePlayers = selectedPlayers[stageId] || [];
    const exists = stagePlayers.some((p) => p.playerId === player.id);

    if (exists) {
      setSelectedPlayers({
        ...selectedPlayers,
        [stageId]: stagePlayers.filter((p) => p.playerId !== player.id)
      });
    } else {
      setSelectedPlayers({
        ...selectedPlayers,
        [stageId]: [...stagePlayers, { playerId: player.id, teamId: player.team }]
      });
    }
  };

  // recompute budgets
  useEffect(() => {
    if (!stages.length) return;
    setBudgetLeftByStage((prev) => {
      const next = { ...prev };
      stages.forEach((stage) => {
        const total = Number(stage.budget || 0);
        const picked = selectedPlayers[stage.id] || [];
        let spent = 0;

        picked.forEach((sel) => {
          const match = Object.values(playersByTeam)
            .flat()
            .find((p) => p.id === sel.playerId);
          if (match) spent += Number(match.value || 0);
        });

        next[stage.id] = Math.max(0, total - spent);
      });
      return next;
    });
  }, [stages, selectedPlayers, playersByTeam]);

  // save team
  const handleSaveTeam = async (stageId) => {
    if (!user) return;
  
    const stage = stages.find((s) => s.id === stageId);
    const stageSelections = selectedPlayers[stageId] || [];
    const total = Number(stage.budget || 0);
    const remaining = Number(budgetLeftByStage[stageId] ?? total);
  
    // --- validations ---
    const batsmen = stageSelections
      .map((sel) => resolvePlayer(sel.playerId))
      .filter((p) => p?.role === "Batsman").length;
    const bowlers = stageSelections
      .map((sel) => resolvePlayer(sel.playerId))
      .filter((p) => p?.role === "Bowler").length;
    const allRounders = stageSelections
      .map((sel) => resolvePlayer(sel.playerId))
      .filter((p) => p?.role === "All Rounder").length;
  
    const teamCounts = {};
    stageSelections.forEach((sel) => {
      const player = resolvePlayer(sel.playerId);
      if (player) teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
    });
    const maxFromSameTeam = Math.max(0, ...Object.values(teamCounts));
  
    const roleComp = stage.roleComposition || {};
    const violations = [];
  
    if (stageSelections.length !== 11) {
      violations.push(`Team must have exactly 11 players (currently ${stageSelections.length})`);
    }
    if (batsmen > (roleComp.batsman || 0)) violations.push("Too many batsmen");
    if (bowlers > (roleComp.bowler || 0)) violations.push("Too many bowlers");
    if (allRounders > (roleComp.allRounder || 0)) violations.push("Too many all rounders");
    if (maxFromSameTeam > (roleComp.sameTeamMax || 11)) violations.push("Too many from one team");
    if (remaining < 0) violations.push("Over budget");
  
    if (violations.length > 0) {
      alert(`Cannot save stage "${stage.name}". Fix violations: ${violations.join(", ")}`);
      return;
    }
  
    // --- save to Firestore ---
    try {
      const userRef = doc(db, "user_teams", user.uid);
      await setDoc(
        userRef,
        {
          [id]: {
            joined: true,
            stages: {
              ...(selectedPlayers || {}),
              [stageId]: stageSelections,
            },
            budgets: {
              ...(budgetLeftByStage || {}),
              [stageId]: remaining,
            },
          },
        },
        { merge: true }
      );
      alert(`Team for stage "${stage.name}" saved!`);
    } catch (err) {
      console.error("Error saving team:", err);
    }
  };
  
  const resolvePlayer = (playerId) => {
    return Object.values(playersByTeam).flat().find((p) => p.id === playerId);
  };
  
  const fetchMatchResults = async (stageId) => {
    const results = [];
    const matchesRef = collection(db, "tournaments", id, "stages", stageId, "matches");
    const matchesSnap = await getDocs(matchesRef);
  
    for (const m of matchesSnap.docs) {
      const matchData = { id: m.id, ...m.data(), players: [] };
  
      const statsSnap = await getDocs(collection(matchesRef, m.id, "stats"));
      statsSnap.forEach((s) => {
        matchData.players.push({ id: s.id, ...s.data() });
      });
  
      results.push(matchData);
    }
  
    return results;
  };

  const formatScoringSummary = (scoring = {}) => {
    const parts = [];
  
    // --- Batting ---
    const bat = scoring.batting || {};
    const batting = [];
    if (bat.perRun != null) batting.push(`${bat.perRun}/run`);
    if (bat.perBallFaced != null) batting.push(`${bat.perBallFaced}/ball faced`);
    if (bat.perFour != null) batting.push(`${bat.perFour}/four`);
    if (bat.perSix != null) batting.push(`${bat.perSix}/six`);
    if (bat.notOutBonus != null) batting.push(`${bat.notOutBonus} not out`);
  
    if (bat.bonusEveryXRuns?.points != null && bat.bonusEveryXRuns?.x != null) {
      const pts = bat.bonusEveryXRuns.points;
      const prefix = pts > 0 ? "+" : "";
      batting.push(`${prefix}${pts} every ${bat.bonusEveryXRuns.x} runs`);
    }
  
    if (batting.length) parts.push(`Batting: ${batting.join(", ")}`);
  
    // --- Bowling ---
    const bowl = scoring.bowling || {};
    const bowling = [];
    if (bowl.perBallBowled != null) bowling.push(`${bowl.perBallBowled}/ball`);
    if (bowl.perDotBall != null) bowling.push(`${bowl.perDotBall}/dot`);
    if (bowl.perRunConceded != null) bowling.push(`${bowl.perRunConceded}/run conceded`);
    if (bowl.perWide != null) bowling.push(`${bowl.perWide}/wide`);
    if (bowl.perNoBall != null) bowling.push(`${bowl.perNoBall}/no ball`);
    if (bowl.perWicket != null) bowling.push(`${bowl.perWicket}/wicket`);
  
    if (bowl.bonusAfterMinWickets?.points != null && bowl.bonusAfterMinWickets?.min != null) {
      const pts = bowl.bonusAfterMinWickets.points;
      const prefix = pts > 0 ? "+" : "";
      bowling.push(`${prefix}${pts} after ${bowl.bonusAfterMinWickets.min} wickets`);
    }
  
    if (bowling.length) parts.push(`Bowling: ${bowling.join(", ")}`);
  
    // --- Fielding ---
    const field = scoring.fielding || {};
    const fielding = [];
    if (field.perCatch != null) fielding.push(`${field.perCatch}/catch`);
    if (field.perRunout != null) fielding.push(`${field.perRunout}/run out`);
    if (fielding.length) parts.push(`Fielding: ${fielding.join(", ")}`);
  
    // --- General ---
    const gen = scoring.general || {};
    const general = [];
    if (gen.perWin != null) general.push(`${gen.perWin}/win`);
    if (gen.perSelection != null) general.push(`${gen.perSelection}/selection`);
    if (general.length) parts.push(`Other: ${general.join(", ")}`);
  
    return parts;
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!tournament) return null;

  return (
    <div className="p-6 overflow-y-auto" style={{ maxHeight: "100vh" }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <div className="flex gap-2">
          {joined ? (
            <button onClick={handleLeave} className="bg-red-500 text-white px-4 py-2 rounded">Leave</button>
          ) : (
            <button onClick={handleJoin} className="bg-green-500 text-white px-4 py-2 rounded">Join</button>
          )}
          <button onClick={() => navigate("/")} className="bg-gray-500 text-white px-4 py-2 rounded">Back to Home</button>
        </div>
      </div>

      {stages.map((stage) => {
		const totalStagePoints = stageResults[stage.id]?.reduce((sum, match) => {
		  return sum + (match.players?.reduce((s, p) => s + (p.points?.total ?? 0), 0) || 0);
		}, 0) || 0;
		
        const total = Number(stage.budget || 0);
        const remaining = Number(budgetLeftByStage[stage.id] ?? total);
        const stageSelections = selectedPlayers[stage.id] || [];
        const isExpanded = expandedStage === stage.id;

        // role counts
        const batsmen = stageSelections
          .map((sel) => resolvePlayer(sel.playerId))
          .filter((p) => p?.role === "Batsman").length;
        const bowlers = stageSelections
          .map((sel) => resolvePlayer(sel.playerId))
          .filter((p) => p?.role === "Bowler").length;
        const allRounders = stageSelections
          .map((sel) => resolvePlayer(sel.playerId))
          .filter((p) => p?.role === "All Rounder").length;
        const teamCounts = {};
        stageSelections.forEach((sel) => {
          const player = resolvePlayer(sel.playerId);
          if (player) {
            teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
          }
        });
        const maxFromSameTeam = Math.max(0, ...Object.values(teamCounts));

        const roleComp = stage.roleComposition || {};
        const errors = [];
        if (batsmen > (roleComp.batsman || 0)) errors.push("Too many batsmen");
        if (bowlers > (roleComp.bowler || 0)) errors.push("Too many bowlers");
        if (allRounders > (roleComp.allRounder || 0)) errors.push("Too many all rounders");
        if (maxFromSameTeam > (roleComp.sameTeamMax || 11)) errors.push("Too many from one team");
        if (remaining < 0) errors.push("Over budget");
        if (stageSelections.length > 11) errors.push("Too many players");

        return (
          <div key={stage.id} className="mb-4 border rounded">
            <div className="p-3 bg-gray-100">
              <h2 className="text-xl font-bold">{stage.name}</h2>
		  
              <div className="mt-1 text-sm">

				{/* Scoring summary */}
				{console.log("Scoring for", stage.name, stage.scoring)}

				<div className="text-sm text-gray-700 mt-1">
				  {formatScoringSummary(stage.scoring).map((line, idx) => (
					<div key={idx}>{line}</div>
				  ))}
				</div>

				<p className={`${errors.length ? "text-red-600" : "text-gray-600"}`}>
				  Role Composition: {batsmen}/{roleComp.batsman ?? 0} Batsmen,{" "}
				  {bowlers}/{roleComp.bowler ?? 0} Bowlers,{" "}
				  {allRounders}/{roleComp.allRounder ?? 0} All Rounders,{" "}
				  Max {roleComp.sameTeamMax ?? 0} from same team
				  <br />
				  {stageSelections.length}/11 Total Players
				</p> 
				
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-600">
                  {stageSelections.length} picked | Budget left: {remaining}
                </span>
                <button
                   onClick={async () => {
					if (isExpanded) {
						setExpandedStage(null);
					} else {
						const matches = await fetchMatchResults(stage.id);
						setStageResults((prev) => ({ ...prev, [stage.id]: matches }));
						setExpandedStage(stage.id);
					  }
				   }}
                  className="text-blue-600 underline text-sm"
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="p-3">
			  {/* Match Results */}
				{(stageResults[stage.id] || []).length > 0 && (
				  <div className="mb-4">
					<h3 className="font-semibold mb-2">Match Results</h3>
					
					<p className="text-lg font-semibold text-gray-800 mt-3 mb-2">
					  Stage Points: <b>{totalStagePoints ? `${totalStagePoints}` : "Pending"}</b>
					</p>
					
					{stageResults[stage.id].map((match, idx) => {
					  const userTeam = selectedPlayers[stage.id] || [];
					  let totalPoints = 0;

					  const playerRows = userTeam.map((sel) => {
						const p = match.players.find((mp) => mp.id === sel.playerId);
						if (!p) return null;
						const pts = p.points || {};
						totalPoints += pts.total || 0;
						return (
						  <tr key={sel.playerId}>
							<td className="border px-2 py-1">{resolvePlayer(sel.playerId)?.playerName}</td>
							<td className="border px-2 py-1 text-right">{pts.batting ?? 0}</td>
							<td className="border px-2 py-1 text-right">{pts.bowling ?? 0}</td>
							<td className="border px-2 py-1 text-right">{pts.fielding ?? 0}</td>
							<td className="border px-2 py-1 text-right">{pts.general ?? 0}</td>
							<td className="border px-2 py-1 text-right font-semibold">{pts.total ?? 0}</td>
						  </tr>
						);
					  });

					  const team1Name =
						teamsByStage[stage.id]?.find((t) => t.id === match.team1)?.name ||
						match.team1 ||
						"TBD";
					  const team2Name =
						teamsByStage[stage.id]?.find((t) => t.id === match.team2)?.name ||
						match.team2 ||
						"TBD";

					  const matchTotal = match.players.some((p) => p.points)
						? userTeam.reduce((sum, sel) => {
							const p = match.players.find((mp) => mp.id === sel.playerId);
							return sum + (p?.points?.total ?? 0);
						  }, 0)
						: null;

					  return (
						<div
						  key={match.id}
						  className="mb-3 border border-gray-300 rounded p-2 bg-gray-50"
						>
						  <div className="flex justify-between items-center">
							
							  Match {idx + 1}: {team1Name} vs {team2Name} {" "}
							  <span className="text-sm text-gray-600 ml-1">
								({matchTotal !== null ? `match total: ${matchTotal}` : "match total: Pending"}){" "}
							  </span>
							
							<button
							  onClick={() => toggleMatchDetails(match.id)}
							  className="text-blue-600 underline text-sm"
							>
							  {expandedMatches[match.id] ? "Hide Details" : "Show Details"}
							</button>
						  </div>

						  {expandedMatches[match.id] && (
							<div className="mt-2">
							  <table className="score-table text-sm border border-gray-300 rounded w-auto">
								<thead className="bg-gray-100">
								  <tr>
									<th className="border px-2 py-1 text-left">Player</th>
									<th className="border px-2 py-1 text-right">Bat</th>
									<th className="border px-2 py-1 text-right">Bowl</th>
									<th className="border px-2 py-1 text-right">Field</th>
									<th className="border px-2 py-1 text-right">Gen</th>
									<th className="border px-2 py-1 text-right">Total</th>
								  </tr>
								</thead>
								<tbody>
								  {playerRows.filter(Boolean).map((row, i) =>
									React.cloneElement(row, { key: i })
								  )}
								</tbody>
								<tfoot>
								  <tr>
									<td className="text-right font-semibold" colSpan="5">
									  Match Total
									</td>
									<td className="text-right font-semibold">{totalPoints}</td>
								  </tr>
								</tfoot>
							  </table>
							</div>
						  )}
						</div>
					  );
					})}
				  </div>
				)}

                {/* Selected Players */}
                <h3 className="font-semibold mb-2">
				  {user?.displayName
					? `${user.displayName.split(" ")[0]}'s current team for ${stage.name}`
					: `Your current team for ${stage.name}`}
				</h3>

				
				{errors.length > 0 && (
				  <div className="text-red-600 font-semibold mb-2">
					Violations: {errors.join(", ")}
				  </div>
				)}
				
			  	{/* 🔹 Save button directly after selected players */}
				<p className={`${errors.length ? "text-red-600" : "text-gray-600"}`}>
				  Subs remaining: {stage.subsAllowed ?? 0} | Budget: {total - remaining}/{total}
				</p>
				{joined && (
				  <button
					onClick={() => handleSaveTeam(stage.id)}
					className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
				  >
					Save Team
				  </button>
				)}

                {stageSelections.length === 0 ? (
                  <p className="text-sm text-gray-700">No players selected.</p>
                ) : (
                  <table className="score-table text-sm mt-2">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-1">Name</th>
                        <th className="border px-2 py-1">Role</th>
                        <th className="border px-2 py-1">Team</th>
                        <th className="border px-2 py-1">Points</th>
                        <th className="border px-2 py-1">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageSelections.map((sel, i) => {
                        const player = resolvePlayer(sel.playerId);
                        if (!player) return null;
                        return (
                          <tr key={i}>
                            <td className="border px-2 py-1">{player.playerName}</td>
                            <td className="border px-2 py-1">{player.role}</td>
                            <td className="border px-2 py-1">{player.team}</td>
                            <td className="border px-2 py-1">{player.value}</td>
                            <td className="border px-2 py-1">
                              <button
                                onClick={() => togglePlayer(stage.id, player)}
                                className="bg-red-500 text-white px-2 py-1 rounded"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {/* Available Players */}
                <h3 className="font-semibold mb-2">Available Players</h3>
                <table className="score-table text-sm mt-2">
   				  <thead className="bg-gray-100">
   				    <tr>
   				    	<th
   				    	className="border px-2 py-1 cursor-pointer"
   				    	onClick={() => handleSort("playerName")}
   				    	>
   				    	Name{" "}
   				    	{sortConfig.field === "playerName" && (
   				    		<span>{sortConfig.dir === "asc" ? "▲" : "▼"}</span>
   				    	)}
   				    	</th>
   				    	<th
   				    	className="border px-2 py-1 cursor-pointer"
   				    	onClick={() => handleSort("role")}
   				    	>
   				    	Role{" "}
   				    	{sortConfig.field === "role" && (
   				    		<span>{sortConfig.dir === "asc" ? "▲" : "▼"}</span>
   				    	)}
   				    	</th>
   				    	<th
   				    	className="border px-2 py-1 cursor-pointer"
   				    	onClick={() => handleSort("team")}
   				    	>
   				    	Team{" "}
   				    	{sortConfig.field === "team" && (
   				    		<span>{sortConfig.dir === "asc" ? "▲" : "▼"}</span>
   				    	)}
   				    	</th>
   				    	<th
   				    	className="border px-2 py-1 cursor-pointer"
   				    	onClick={() => handleSort("value")}
   				    	>
   				    	Points{" "}
   				    	{sortConfig.field === "value" && (
   				    		<span>{sortConfig.dir === "asc" ? "▲" : "▼"}</span>
   				    	)}
   				    	</th>
   				    	<th className="border px-2 py-1">Action</th>
   				    </tr>
   				  </thead>
				  <tbody>
					{(teamsByStage[stage.id] || [])
					  .flatMap((team) => playersByTeam[team.id] || [])
					  .sort((a, b) => {
						if (!sortConfig.field) return 0;
						const { field, dir } = sortConfig;
						let valA = a[field];
						let valB = b[field];
						if (typeof valA === "string") valA = valA.toLowerCase();
						if (typeof valB === "string") valB = valB.toLowerCase();
						if (valA < valB) return dir === "asc" ? -1 : 1;
						if (valA > valB) return dir === "asc" ? 1 : -1;
						return 0;
					  })
					  .map((p, i) => {
						const isSelected = stageSelections.some((sel) => sel.playerId === p.id);
						return (
						  <tr key={i}>
							<td className="border px-2 py-1">{p.playerName}</td>
							<td className="border px-2 py-1">{p.role}</td>
							<td className="border px-2 py-1">{p.team}</td>
							<td className="border px-2 py-1">{p.value}</td>
							<td className="border px-2 py-1">
							  {isSelected ? (
								<button
								  onClick={() => togglePlayer(stage.id, p)}
								  className="bg-red-500 text-white px-2 py-1 rounded"
								>
								  Remove
								</button>
							  ) : (
								<button
								  onClick={() => togglePlayer(stage.id, p)}
								  className="bg-green-500 text-white px-2 py-1 rounded"
								  disabled={!joined}
								>
								  Add
								</button>
							  )}
							</td>
						  </tr>
						);
					  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default JoinTournament;
