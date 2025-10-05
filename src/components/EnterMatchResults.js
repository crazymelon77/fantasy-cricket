import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { computeStageScores } from "../lib/computeStageScores";

function EnterMatchResults() {
  const { tId, sId, mId } = useParams();
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState({});
  const [playerNames, setPlayerNames] = useState({});
  const [playerTeams, setPlayerTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [teamNames, setTeamNames] = useState({});

  // 🔹 Fetch stats or populate from teams if empty
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);

      const matchRef = doc(db, "tournaments", tId, "stages", sId, "matches", mId);
      const matchSnap = await getDoc(matchRef);
      if (!matchSnap.exists()) {
        alert("Match not found");
        setLoading(false);
        return;
      }

      const matchData = { id: matchSnap.id, ...matchSnap.data() };
      setMatch(matchData);

      // fetch team names
      if (matchData.team1 && matchData.team1 !== "TBD") {
        const team1Snap = await getDoc(
          doc(db, "tournaments", tId, "stages", sId, "teams", matchData.team1)
        );
        if (team1Snap.exists()) {
          setTeamNames((prev) => ({
            ...prev,
            [matchData.team1]: team1Snap.data().name,
          }));
        }
      }
      if (matchData.team2 && matchData.team2 !== "TBD") {
        const team2Snap = await getDoc(
          doc(db, "tournaments", tId, "stages", sId, "teams", matchData.team2)
        );
        if (team2Snap.exists()) {
          setTeamNames((prev) => ({
            ...prev,
            [matchData.team2]: team2Snap.data().name,
          }));
        }
      }

      const statsRef = collection(matchRef, "stats");
      const statsSnap = await getDocs(statsRef);

      // always fetch rosters so we have names + teams
      const team1Players = await getPlayers(matchData.team1);
      const team2Players = await getPlayers(matchData.team2);
      const squad = [...team1Players, ...team2Players];

      const nameMap = squad.reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});
      const teamMap = squad.reduce((acc, p) => { acc[p.id] = p.team; return acc; }, {});
      setPlayerNames(nameMap);
      setPlayerTeams(teamMap);

      if (statsSnap.empty && matchData.team1 && matchData.team2) {
        // populate stats if empty
        for (const p of squad) {
          await setDoc(doc(statsRef, p.id), getEmptyStats());
        }
        setPlayers(squad); // has id, name, team
        setStats(
          squad.reduce((acc, p) => {
            acc[p.id] = getEmptyStats();
            return acc;
          }, {})
        );
      } else {
        // load existing stats
        const existing = [];
        const statMap = {};
        statsSnap.forEach((d) => {
          existing.push({ id: d.id }); // names/teams from maps
          statMap[d.id] = d.data();
        });
        setPlayers(existing);
        setStats(statMap);
      }

      setLoading(false);
    };

    loadStats();
  }, [tId, sId, mId]);

  // 🔹 Helper: fetch players for a teamId and include team name
  const getPlayers = async (teamId) => {
    if (!teamId || teamId === "TBD") return [];
    const teamRef = doc(db, "tournaments", tId, "stages", sId, "teams", teamId);
    const teamSnap = await getDoc(teamRef);
    const teamName = teamSnap.exists() ? teamSnap.data().name || "Unknown Team" : "Unknown Team";

    const playersSnap = await getDocs(collection(teamRef, "players"));
    return playersSnap.docs.map((p) => ({
      id: p.id,
      name: p.data().playerName || "Unnamed Player",
      team: teamName,
    }));
  };

  // 🔹 Default empty stats
  const getEmptyStats = () => ({
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    zeros: 0,
    notOuts: 0,         // number
    ballsBowled: 0,
    runsGiven: 0,
    dotBalls: 0,
	maidenOvers: 0,
    wides: 0,
    noBalls: 0,
    wickets: 0,
    catches: 0,
    runouts: 0,
    played: false,
    won: false,
    mom: false,
    awayTeam: false,
  });

  const EMPTY = getEmptyStats();
  const NUMERIC_KEYS = Object.entries(EMPTY)
    .filter(([, v]) => typeof v === "number")
    .map(([k]) => k);
  
  const toNum0 = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  
  // 🔹 Handle input changes (booleans stay booleans)
  const handleChange = (playerId, key, value) => {
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [key]: typeof value === "boolean" ? value : value === "" ? "" : Number(value),
      },
    }));
  };

  // 🔹 Save results
  const saveResults = async () => {
    const statsRef = collection(
      db,
      "tournaments",
      tId,
      "stages",
      sId,
      "matches",
      mId,
      "stats"
    );
    for (const pid in stats) {
	  const row = { ...stats[pid] };
	  NUMERIC_KEYS.forEach((k) => (row[k] = toNum0(row[k])));
	  row.played = !!row.played; 
	  row.won = !!row.won; 
	  row.mom = !!row.mom; 
	  row.awayTeam = !!row.awayTeam;

      await setDoc(doc(statsRef, pid), row, { merge: true });
    }
    alert("Match results saved!");
  };

  // 🔹 Export CSV with name + team from maps
  const exportCSV = () => {
    const headers = [
      "playerId","name","team",
      "mom","awayTeam",
      "runs","ballsFaced","fours","sixes","zeros","notOuts",
      "ballsBowled", "maidenOvers", "runsGiven","dotBalls","wides","noBalls","wickets",
      "catches","runouts","won","played"
    ];

    const rows = [headers];

    players.forEach((p) => {
      rows.push([
        p.id,
        playerNames[p.id] || p.id,
        playerTeams[p.id] || "",

        (stats[p.id]?.mom ?? false),
        (stats[p.id]?.awayTeam ?? false),

        stats[p.id]?.runs ?? 0,
        stats[p.id]?.ballsFaced ?? 0,
        stats[p.id]?.fours ?? 0,
        stats[p.id]?.sixes ?? 0,
        stats[p.id]?.zeros ?? 0,
        stats[p.id]?.notOuts ?? 0,

        stats[p.id]?.ballsBowled ?? 0,
		stats[p.id]?.madienOvers ?? 0,
        stats[p.id]?.runsGiven ?? 0,
        stats[p.id]?.dotBalls ?? 0,
        stats[p.id]?.wides ?? 0,
        stats[p.id]?.noBalls ?? 0,
        stats[p.id]?.wickets ?? 0,
        stats[p.id]?.catches ?? 0,
        stats[p.id]?.runouts ?? 0,

        (stats[p.id]?.won ?? false),
        (stats[p.id]?.played ?? false),
      ]);
    });

    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `match_${mId}_results.csv`);
    link.click();
  };
  
  // helpers for parsing
  const toNum = (v, d = 0) => {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : d;
  };
  const toBool = (v) => /^(true|1|yes|y)$/i.test(String(v).trim());
  
  // column indices (fixed order)
  const IDX = {
    PID: 0, NAME: 1, TEAM: 2,
    MOM: 3, AWAY: 4,
    RUNS: 5, BF: 6, FOURS: 7, SIXES: 8, ZEROS: 9, NOTOUTS: 10,
    BALLS_BOWLED: 11, MAIDENS: 12, RUNS_GIVEN: 13, DOTBALLS: 14, WIDES: 15, NOBALLS: 16,
    WICKETS: 17, CATCHES: 18, RUNOUTS: 19, WON: 20, PLAYED: 21,
  };
  
  // Import CSV (from our own export)
const handleImportCSV = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (lines.length < 2) { alert("CSV is empty"); e.target.value = ""; return; }

  const updates = {};
  // skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 22) continue; // guard

    const pid = cols[IDX.PID]?.trim();
    if (!pid) continue;

    updates[pid] = {
      mom: toBool(cols[IDX.MOM]),
      awayTeam: toBool(cols[IDX.AWAY]),
      runs: toNum(cols[IDX.RUNS]),
      ballsFaced: toNum(cols[IDX.BF]),
      fours: toNum(cols[IDX.FOURS]),
      sixes: toNum(cols[IDX.SIXES]),
      zeros: toNum(cols[IDX.ZEROS]),
      notOuts: toNum(cols[IDX.NOTOUTS]),
      ballsBowled: toNum(cols[IDX.BALLS_BOWLED]),
	  maidenOvers: toNum(cols[IDX.MAIDENS]),
      runsGiven: toNum(cols[IDX.RUNS_GIVEN]),
      dotBalls: toNum(cols[IDX.DOTBALLS]),
      wides: toNum(cols[IDX.WIDES]),
      noBalls: toNum(cols[IDX.NOBALLS]),
      wickets: toNum(cols[IDX.WICKETS]),
      catches: toNum(cols[IDX.CATCHES]),
      runouts: toNum(cols[IDX.RUNOUTS]),
      won: toBool(cols[IDX.WON]),
      played: toBool(cols[IDX.PLAYED]),
    };
  }

 
    // write to Firestore
    const statsRef = collection(db, "tournaments", tId, "stages", sId, "matches", mId, "stats");
    await Promise.all(
  	Object.entries(updates).map(([pid, payload]) =>
  	  setDoc(doc(statsRef, pid), payload, { merge: true })
  	)
    );
  
    // update local state
    setStats((prev) => ({ ...prev, ...updates }));
  
    alert(`Imported ${Object.keys(updates).length} rows`);
    e.target.value = ""; // reset file input
  };
	

  // 🔹 Reset stats
  const resetStats = async () => {
    const matchRef = doc(db, "tournaments", tId, "stages", sId, "matches", mId);
    const statsRef = collection(matchRef, "stats");
    const existing = await getDocs(statsRef);
    for (const d of existing.docs) {
      await deleteDoc(d.ref);
    }

    const team1Players = await getPlayers(match.team1);
    const team2Players = await getPlayers(match.team2);
    const squad = [...team1Players, ...team2Players];

    const nameMap = squad.reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});
    const teamMap = squad.reduce((acc, p) => { acc[p.id] = p.team; return acc; }, {});
    setPlayerNames(nameMap);
    setPlayerTeams(teamMap);

    for (const p of squad) {
      await setDoc(doc(statsRef, p.id), getEmptyStats());
    }

    setPlayers(squad);
    setStats(
      squad.reduce((acc, p) => {
        acc[p.id] = getEmptyStats();
        return acc;
      }, {})
    );

    alert("Stats reset!");
  };

  // 🔹 Compute scores
  const runCompute = async () => {
    await computeStageScores(tId, sId, mId);
    // re-fetch stats for this match
	const matchRef = doc(db, "tournaments", tId, "stages", sId, "matches", mId);
    const statsSnap = await getDocs(collection(matchRef, "stats"));
    const updated = {};
    statsSnap.forEach((d) => (updated[d.id] = d.data() || {}));
    setStats((prev) => ({ ...prev, ...updated }));
	
    alert("Scores computed!");
  };

  if (loading) return <div>Loading players...</div>;
  
	const summaryRows = players
	  .map(p => {
		const pid = p.id || p;
		return { pid, name: playerNames[pid] || p.name || pid, points: Number(stats[pid]?.points ?? 0) };
	  })
	  .sort((a, b) => b.points - a.points);

  return (
    <div style={{ padding: "20px", maxHeight: "90vh", overflowY: "auto" }}>
      <h2>
        {match
          ? `Enter Results for ${
              match.team1 === "TBD"
                ? "TBD"
                : teamNames[match.team1] || match.team1
            } vs ${
              match.team2 === "TBD"
                ? "TBD"
                : teamNames[match.team2] || match.team2
            }`
          : "Enter Results"}
      </h2>
	  
	  {summaryRows.length > 0 && (
	  <div style={{ margin: "10px 0" }}>
		<table style={{ width: "100%", borderCollapse: "collapse" }}>
		  <thead>
			<tr>
			  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px" }}>Player</th>
			  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "6px" }}>Points</th>
			</tr>
		  </thead>
		  <tbody>
			{summaryRows.map((r) => (
			  <tr key={r.pid}>
				<td style={{ padding: "6px" }}>{r.name}</td>
				<td style={{ padding: "6px", textAlign: "right" }}>{r.points}</td>
			  </tr>
			))}
		  </tbody>
		</table>
	  </div>
	)}


      {players.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #ccc",
            padding: "8px",
            margin: "8px 0",
            borderRadius: "6px",
          }}
        >
          <h4>{playerNames[p.id] || p.id} — {(stats[p.id]?.points ?? 0)} pts</h4>

          {/* Batting */}
          <div>
            <label>Runs:</label>
            <input
              type="number"
              value={stats[p.id]?.runs ?? 0}
              onChange={(e) => handleChange(p.id, "runs", e.target.value)}
            />
            <label>Balls Faced:</label>
            <input
              type="number"
              value={stats[p.id]?.ballsFaced ?? 0}
              onChange={(e) => handleChange(p.id, "ballsFaced", e.target.value)}
            />
            <label>4s:</label>
            <input
              type="number"
              value={stats[p.id]?.fours ?? 0}
              onChange={(e) => handleChange(p.id, "fours", e.target.value)}
            />
            <label>6s:</label>
            <input
              type="number"
              value={stats[p.id]?.sixes ?? 0}
              onChange={(e) => handleChange(p.id, "sixes", e.target.value)}
            />
            <label>0s:</label>
            <input
              type="number"
              value={stats[p.id]?.zeros ?? 0}
              onChange={(e) => handleChange(p.id, "zeros", e.target.value)}
            />
            <label>Not Outs:</label>
            <input
              type="number"
              value={stats[p.id]?.notOuts ?? 0}
              onChange={(e) => handleChange(p.id, "notOuts", e.target.value)}
            />
          </div>

          {/* Bowling */}
          <div>
            <label>Balls Bowled:</label>
            <input
              type="number"
              value={stats[p.id]?.ballsBowled ?? 0}
              onChange={(e) => handleChange(p.id, "ballsBowled", e.target.value)}
            />
            <label>Runs Given:</label>
            <input
              type="number"
              value={stats[p.id]?.runsGiven ?? 0}
              onChange={(e) => handleChange(p.id, "runsGiven", e.target.value)}
            />
            <label>Dot Balls:</label>
            <input
              type="number"
              value={stats[p.id]?.dotBalls ?? 0}
              onChange={(e) => handleChange(p.id, "dotBalls", e.target.value)}
            />
			<label>Maiden Overs:</label>
			<input
			  type="number"
			  value={stats[p.id]?.maidenOvers ?? 0}
			  onChange={(e) => handleChange(p.id, "maidenOvers", e.target.value)}
			/>
            <label>Wides:</label>
            <input
              type="number"
              value={stats[p.id]?.wides ?? 0}
              onChange={(e) => handleChange(p.id, "wides", e.target.value)}
            />
            <label>No Balls:</label>
            <input
              type="number"
              value={stats[p.id]?.noBalls ?? 0}
              onChange={(e) => handleChange(p.id, "noBalls", e.target.value)}
            />
            <label>Wickets:</label>
            <input
              type="number"
              value={stats[p.id]?.wickets ?? 0}
              onChange={(e) => handleChange(p.id, "wickets", e.target.value)}
            />
          </div>

          {/* Fielding */}
          <div>
            <label>Catches:</label>
            <input
              type="number"
              value={stats[p.id]?.catches ?? 0}
              onChange={(e) => handleChange(p.id, "catches", e.target.value)}
            />
            <label>Run Outs:</label>
            <input
              type="number"
              value={stats[p.id]?.runouts ?? 0}
              onChange={(e) => handleChange(p.id, "runouts", e.target.value)}
            />
          </div>

          {/* General */}
          <div>
            <label>Played:</label>
            <input
              type="checkbox"
              checked={stats[p.id]?.played ?? false}
              onChange={(e) => handleChange(p.id, "played", e.target.checked)}
            />
            <label>Won:</label>
            <input
              type="checkbox"
              checked={stats[p.id]?.won || false}
              onChange={(e) => handleChange(p.id, "won", e.target.checked)}
            />
            <label>MoM:</label>
            <input
              type="checkbox"
              checked={stats[p.id]?.mom || false}
              onChange={(e) => handleChange(p.id, "mom", e.target.checked)}
            />
            <label>Away Team:</label>
            <input
              type="checkbox"
              checked={stats[p.id]?.awayTeam || false}
              onChange={(e) => handleChange(p.id, "awayTeam", e.target.checked)}
            />
          </div>
        </div>
      ))}

      <div style={{ marginTop: "20px" }}>
        <button onClick={saveResults}>Save Results</button>
        <button onClick={runCompute}>Compute Points</button>
        <button onClick={resetStats}>Reset Players</button>
        <button onClick={exportCSV}>Export CSV</button>
		<input
		  id="importCsvInput"
		  type="file"
		  accept=".csv"
		  style={{ display: "none" }}
		  onChange={handleImportCSV}
		/>
		<button onClick={() => document.getElementById("importCsvInput").click()}>
		  Import CSV
		</button>

      </div>
    </div>
  );
}

export default EnterMatchResults;
