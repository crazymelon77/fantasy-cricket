import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";


const EditTournament = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);
  const [teamsByStage, setTeamsByStage] = useState({});
  const [playersByTeam, setPlayersByTeam] = useState({});
  const [loading, setLoading] = useState(true);
  const [team1, setTeam1] = useState("TBD");
  const [team2, setTeam2] = useState("TBD");

  // ---------- Save Tournament ----------
const saveTournament = async () => {
  try {
    const tourRef = doc(db, "tournaments", tournamentId);
    await updateDoc(tourRef, {
      name: tournament.name || "",
      type: tournament.type || "classic",   // ✅ default
      active: tournament.active ?? false,   // ✅ default
    });
    alert("Tournament saved");
  } catch (err) {
    console.error("Error saving tournament:", err);
    alert("Failed to save tournament");
  }
};

  
  // ---------- Fetch tournament, stages, teams, players ----------
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const tourRef = doc(db, "tournaments", tournamentId);
        const tourSnap = await getDoc(tourRef);
        if (!tourSnap.exists()) {
          console.error("Tournament not found");
          navigate("/");
          return;
        }
        setTournament({ id: tourSnap.id, ...tourSnap.data() });

   // stages (with matches fetched from subcollection)
   const stageSnap = await getDocs(
     collection(db, "tournaments", tournamentId, "stages")
   );
   const stageList = await Promise.all(
     stageSnap.docs.map(async (s) => {
       const base = { id: s.id, ...s.data() };
   
       // read matches from subcollection (single source of truth)
       const matchSnap = await getDocs(
         collection(db, "tournaments", tournamentId, "stages", s.id, "matches")
       );
       const matches = matchSnap.docs.map((m) => ({ id: m.id, ...m.data() }));
   
       return { ...base, matches }; // override any stale stage.matches field
     })
   );
   setStages(stageList);

        // teams + players
        const teamsData = {};
        const playersData = {};
        for (const stage of stageList) {
          const teamSnap = await getDocs(
            collection(db, "tournaments", tournamentId, "stages", stage.id, "teams")
          );
          const teamList = teamSnap.docs.map((t) => ({ id: t.id, ...t.data() }));
          teamsData[stage.id] = teamList;

          for (const team of teamList) {
            const playerSnap = await getDocs(
              collection(
                db,
                "tournaments",
                tournamentId,
                "stages",
                stage.id,
                "teams",
                team.id,
                "players"
              )
            );
            playersData[team.id] = playerSnap.docs.map((p) => ({
              id: p.id,
              ...p.data(),
            }));
          }
        }
        setTeamsByStage(teamsData);
        setPlayersByTeam(playersData);
      } catch (error) {
        console.error("Error fetching tournament:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTournament();
  }, [tournamentId, navigate]);

  // ---------- Helpers ----------
  const ensure = (obj, path) => {
    // create nested objects if missing
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    return cur;
  };

  // ---------- Stage handlers ----------
  const handleStageChange = (stageIndex, field, value) => {
    const updated = [...stages];
    updated[stageIndex][field] = value;
    setStages(updated);
  };

  const handleRoleChange = (stageIndex, roleKey, value) => {
    const updated = [...stages];
    if (!updated[stageIndex].roleComposition) updated[stageIndex].roleComposition = {};
    updated[stageIndex].roleComposition[roleKey] = Number(value);
    setStages(updated);
  };

  const handleScoringPairChange = (stageIndex, basePath, key, value) => {
    const updated = [...stages];
    if (!updated[stageIndex].scoring) updated[stageIndex].scoring = {};
  
    // ensure the full container path exists, including the pair object
    const tgt = ensure(updated[stageIndex].scoring, [...basePath, key]);
    tgt[key] = value === "" ? "" : Number(value);
  
    setStages(updated);
  };
  
  const handleScoringChange = (stageIndex, path, value) => {
    const updated = [...stages];
    if (!updated[stageIndex].scoring) updated[stageIndex].scoring = {};
    const tgt = ensure(updated[stageIndex].scoring, path);
    tgt[path[path.length - 1]] = value === "" ? "" : Number(value); // ✅
    setStages(updated);
  };
  
const addStage = async () => {
  const nextOrder = (stages?.length || 0) + 1; // auto-assign order

  const newStage = {
    name: "New Stage",
    order: nextOrder,   // 🔹 add order here
    subsAllowed: 0,
    budget: 600,
    roleComposition: { batsman: 0, bowler: 0, allRounder: 0, sameTeamMax: 0 },
    scoring: {
      general: { 
		perWin: 0, 
		perSelection: 0, 
		manOfTheMatch: 0,
		awayTeamBonus: 0
	  },
      batting: {
        perRun: 0,
        perBallFaced: 0,
        perFour: 0,
        perSix: 0,
        notOutBonus: 0,
        bonusEveryXRuns: { x: 0, points: 0 },
      },
      bowling: {
        perBallBowled: 0,
        perDotBall: 0,
        perRunConceded: 0,
        perWide: 0,
        perNoBall: 0,
        perWicket: 0,
		perMaidenOver: 0,
        bonusAfterMinWickets: { min: 0, points: 0 },
      },
      fielding: { perCatch: 0, perRunout: 0 },
    },
    matches: [],
  };

  const stageRef = await addDoc(
    collection(db, "tournaments", tournamentId, "stages"),
    newStage
  );

  setStages([...stages, { id: stageRef.id, ...newStage }]);
};

  const removeStage = async (stageId) => {
    await deleteDoc(doc(db, "tournaments", tournamentId, "stages", stageId));
    setStages(stages.filter((s) => s.id !== stageId));
    const t = { ...teamsByStage };
    delete t[stageId];
    setTeamsByStage(t);
  };

  const saveStage = async (stage) => {
    try {
      const { id, matches, team1, team2, matchDate, cutoffDate, ...payload } = stage;
      const stageRef = doc(db, "tournaments", tournamentId, "stages", id);
      await updateDoc(stageRef, payload);
	  
	  if (Array.isArray(matches)) {
		  for (const match of matches) {
			  if (!match.id) continue;
			  await saveMatch(id, match);
		  }
	  }  
	  
      alert("Stage saved");
	  
    } catch (err) {
      console.error("Error saving stage:", err);
      alert("Failed to save stage");
    }
  };

  // ---------- Matches ----------
  const addMatch = async (stageId) => {
    try {
      // 🔢 compute next order within this stage
      const stage = stages.find(s => s.id === stageId);
      const currentOrders = (stage?.matches || []).map(m => m.order || 0);
      const nextOrder = (currentOrders.length ? Math.max(...currentOrders) : 0) + 1;
  
      const newMatch = {
        team1: "TBD",
        team2: "TBD",
        matchDate: null,
        cutoffDate: null,
        order: nextOrder, // ✅ new
      };
  
      const matchRef = await addDoc(
        collection(db, "tournaments", tournamentId, "stages", stageId, "matches"),
        newMatch
      );
  
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? { ...s, matches: [...(s.matches || []), { id: matchRef.id, ...newMatch }] }
            : s
        )
      );
    } catch (err) {
      console.error("Error adding match:", err);
      alert("Failed to add match");
    }
  };


const saveMatch = async (stageId, match) => {
  try {
    if (!match.id) {
      alert("Match has no ID yet, save the stage first.");
      return;
    }
    const matchRef = doc(
      db,
      "tournaments",
      tournamentId,
      "stages",
      stageId,
      "matches",
      match.id
    );
    await updateDoc(matchRef, {
      team1: match.team1,
      team2: match.team2,
      matchDate: match.matchDate,
      cutoffDate: match.cutoffDate,
	  order: Number(match.order) || 0,
    });
	
	// if we just saved the match as locked, auto-snapshot XIs
	/*disabling snapshot
	if (match.locked) {
	  await snapshotMatchXIs(tournamentId, stageId, match.id);
	}
	*/

    
  } catch (err) {
    console.error("Error saving match:", err);
    alert("Failed to save match");
  }
};


const removeMatch = async (stageIndex, matchIndex) => {
  try {
    const stage = stages[stageIndex];
    const match = stage.matches[matchIndex];
    if (!match?.id) return;

    // 1️⃣ Delete from Firestore
    const matchRef = doc(
      db,
      "tournaments",
      tournamentId,
      "stages",
      stage.id,
      "matches",
      match.id
    );
    await deleteDoc(matchRef);

    // 2️⃣ Remove locally from state so UI updates immediately
    const updated = [...stages];
    updated[stageIndex].matches.splice(matchIndex, 1);
    setStages(updated);

    alert("Match removed!");
  } catch (err) {
    console.error("Error removing match:", err);
    alert("Failed to remove match");
  }
};

// 🔒 Snapshot XIs for a match (manual trigger)
/* disabling snapshots
const snapshotMatchXIs = async (tid, sid, mid) => {
  try {
    // 1) validate match + cutoff
    const matchRef = doc(db, "tournaments", tid, "stages", sid, "matches", mid);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
      alert("Match not found");
      return;
    }
    const matchData = matchSnap.data() || {};
    const cutoff = matchData.cutoffDate?.toDate ? matchData.cutoffDate.toDate() : matchData.cutoffDate;
    if (!cutoff) {
      alert("No cutoff date set for this match.");
      return;
    }
    const now = new Date();
    if (now < new Date(cutoff)) {
      const proceed = window.confirm("Cutoff is in the future. Snapshot anyway?");
      if (!proceed) return;
    }

    // 2) iterate all user_teams docs
    const usersSnap = await getDocs(collection(db, "user_teams"));
    let created = 0, skipped = 0;

    for (const udoc of usersSnap.docs) {
      const udata = udoc.data() || {};
      const rec = udata[tid];                     // tournament bucket under this user
      if (!rec?.joined) { skipped++; continue; }

      const savedSquad = rec.stages?.[sid] || []; // last saved XI for this stage
      if (!Array.isArray(savedSquad) || savedSquad.length === 0) { skipped++; continue; }

      // flat list of playerIds
      const team = savedSquad.map(p => p?.playerId).filter(Boolean);
      if (team.length === 0) { skipped++; continue; }

      // 3) write per-user XI if not already present
      const xiRef = doc(db, "tournaments", tid, "stages", sid, "matches", mid, "11s", udoc.id);
      const xiSnap = await getDoc(xiRef);
      if (xiSnap.exists()) { skipped++; continue; }

      await setDoc(xiRef, {
        uid: udoc.id,
        team,               // string[] of playerIds
        totalPoints: 0,     // will be filled by scoring later
        createdAt: serverTimestamp(),
      });
      created++;
    }

    alert(`Snapshot complete. Created: ${created}, Skipped: ${skipped}`);
  } catch (e) {
    console.error("snapshotMatchXIs error", e);
    alert("Snapshot failed. See console for details.");
  }
};
*/


  const changeMatch = (stageIndex, matchIndex, field, value) => {
    const updated = [...stages];
    updated[stageIndex].matches[matchIndex][field] = value;
    setStages(updated);
  };

  const formatForInput = (date) => {
    if (!date) return "";
    const d =
      date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 16);
  };

  // ---------- Teams ----------
  const addTeam = async (stageId) => {
    const newTeam = { name: "New Team" };
    const teamRef = await addDoc(
      collection(db, "tournaments", tournamentId, "stages", stageId, "teams"),
      newTeam
    );
    setTeamsByStage({
      ...teamsByStage,
      [stageId]: [...(teamsByStage[stageId] || []), { id: teamRef.id, ...newTeam }],
    });
  };

  const removeTeam = async (stageId, teamId) => {
    await deleteDoc(
      doc(db, "tournaments", tournamentId, "stages", stageId, "teams", teamId)
    );
    setTeamsByStage({
      ...teamsByStage,
      [stageId]: (teamsByStage[stageId] || []).filter((t) => t.id !== teamId),
    });
    const p = { ...playersByTeam };
    delete p[teamId];
    setPlayersByTeam(p);
  };

  const changeTeamName = (stageId, teamId, value) => {
    setTeamsByStage({
      ...teamsByStage,
      [stageId]: (teamsByStage[stageId] || []).map((t) =>
        t.id === teamId ? { ...t, name: value } : t
      ),
    });
  };

  const saveTeam = async (stageId, team) => {
    const teamRef = doc(
      db,
      "tournaments",
      tournamentId,
      "stages",
      stageId,
      "teams",
      team.id
    );
    await updateDoc(teamRef, { name: team.name });
    alert("Team saved");
  };

  // ---------- Players ----------
  const addPlayer = async (stageId, teamId) => {
    const newPlayer = { playerName: "", role: "Batsman", value: 100 };
    const playerRef = await addDoc(
      collection(
        db,
        "tournaments",
        tournamentId,
        "stages",
        stageId,
        "teams",
        teamId,
        "players"
      ),
      newPlayer
    );
    setPlayersByTeam({
      ...playersByTeam,
      [teamId]: [...(playersByTeam[teamId] || []), { id: playerRef.id, ...newPlayer }],
    });
  };

  const removePlayer = async (stageId, teamId, playerId) => {
    await deleteDoc(
      doc(
        db,
        "tournaments",
        tournamentId,
        "stages",
        stageId,
        "teams",
        teamId,
        "players",
        playerId
      )
    );
    setPlayersByTeam({
      ...playersByTeam,
      [teamId]: (playersByTeam[teamId] || []).filter((p) => p.id !== playerId),
    });
  };

  const changePlayer = (teamId, playerId, field, value) => {
    setPlayersByTeam({
      ...playersByTeam,
      [teamId]: (playersByTeam[teamId] || []).map((p) =>
        p.id === playerId ? { ...p, [field]: field === "value" ? Number(value) : value } : p
      ),
    });
  };

  const savePlayer = async (stageId, teamId, player) => {
    const playerRef = doc(
      db,
      "tournaments",
      tournamentId,
      "stages",
      stageId,
      "teams",
      teamId,
      "players",
      player.id
    );
    await updateDoc(playerRef, {
      playerName: player.playerName,
      role: player.role,
      value: Number(player.value) || 0,
    });
    alert("Player saved");
  };

  const importCSV = async (e, stageId, teamId) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const lines = event.target.result
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const [playerName, role, value] = line.split(",").map((x) => x.trim());
        const newPlayer = {
          playerName,
          role,
          value: value ? Number(value) : 100,
        };
        const playerRef = await addDoc(
          collection(
            db,
            "tournaments",
            tournamentId,
            "stages",
            stageId,
            "teams",
            teamId,
            "players"
          ),
          newPlayer
        );
        setPlayersByTeam((prev) => ({
          ...prev,
          [teamId]: [...(prev[teamId] || []), { id: playerRef.id, ...newPlayer }],
        }));
      }
    };
    reader.readAsText(file);
  };

  // ---------- UI ----------
  if (loading) return <div>Loading...</div>;
  if (!tournament) return null;

  return (
    <div style={{ padding: "20px", overflowY: "auto", maxHeight: "100vh" }}>
      <h2>Edit Tournament</h2>

      <label>Tournament Name:</label>
      <input
        type="text"
        value={tournament.name || ""}
        onChange={(e) => setTournament({ ...tournament, name: e.target.value })}
      />

      <label>Type:</label>
      <select
        value={tournament.type || "classic"}
        onChange={(e) => setTournament({ ...tournament, type: e.target.value })}
      >
        <option value="classic">Classic</option>
      </select>

      <label>Active:</label>
      <input
        type="checkbox"
        checked={!!tournament.active}
        onChange={(e) =>
          setTournament({ ...tournament, active: e.target.checked })
        }
      />
	  
	  <div style={{ marginTop: "10px", marginBottom: "20px" }}>
		 <button onClick={saveTournament}>Save Tournament</button>
	  </div>


      <div style={{ marginTop: "20px" }}>
        <h3>Stages, Rules, Matches, Teams & Players</h3>

        {stages.map((stage, sIdx) => (
          <div
            key={stage.id}
            style={{ marginBottom: "20px", padding: "10px", border: "1px solid #ddd" }}
          >
		{/* Stage header */}
		<input
		  type="text"
		  placeholder="Stage Name"
		  value={stage.name || ""}
		  onChange={(e) => handleStageChange(sIdx, "name", e.target.value)}
		/>

		<label>Order:</label>
		<input
		  type="number"
		  value={stage.order ?? 0}
		  onChange={(e) => handleStageChange(sIdx, "order", Number(e.target.value))}
		/>

		<button onClick={() => removeStage(stage.id)}>Remove Stage</button>

            <label>Max Subs:</label>
            <input
              type="number"
              value={stage.subsAllowed ?? 0}
              onChange={(e) => handleStageChange(sIdx, "subsAllowed", Number(e.target.value))}
            />

            <label>Budget:</label>
            <input
              type="number"
              value={stage.budget ?? 0}
              onChange={(e) => handleStageChange(sIdx, "budget", Number(e.target.value))}
            />

            {/* Role Composition */}
            <h4>Role Composition</h4>
            <div>
              <label>Batsmen:</label>
              <input
                type="number"
                value={stage.roleComposition?.batsman ?? 0}
                onChange={(e) => handleRoleChange(sIdx, "batsman", e.target.value)}
              />
            </div>
            <div>
              <label>Bowlers:</label>
              <input
                type="number"
                value={stage.roleComposition?.bowler ?? 0}
                onChange={(e) => handleRoleChange(sIdx, "bowler", e.target.value)}
              />
            </div>
            <div>
              <label>All Rounders:</label>
              <input
                type="number"
                value={stage.roleComposition?.allRounder ?? 0}
                onChange={(e) => handleRoleChange(sIdx, "allRounder", e.target.value)}
              />
            </div>
            <div>
              <label>Same Team Max:</label>
              <input
                type="number"
                value={stage.roleComposition?.sameTeamMax ?? 0}
                onChange={(e) => handleRoleChange(sIdx, "sameTeamMax", e.target.value)}
              />
            </div>

            {/* Scoring Rules – General */}
            <h4>Scoring Rules – General</h4>
            <div>
              <label>Points for Win:</label>
              <input
                type="number"
                value={stage.scoring?.general?.perWin ?? 0}
                onChange={(e) => handleScoringChange(sIdx, ["general", "perWin"], e.target.value)}
              />
            </div>
            <div>
              <label>Points for Selection (played match):</label>
              <input
                type="number"
                value={stage.scoring?.general?.perSelection ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["general", "perSelection"], e.target.value)
                }
              />
            </div>
			<div>
			  <label>Man of the Match Bonus:</label>
			  <input
				type="number"
				value={stage.scoring?.general?.manOfTheMatch ?? 0}
				onChange={(e) =>
				  handleScoringChange(sIdx, ["general", "manOfTheMatch"], e.target.value)
				}
			  />
			</div>

			<div>
			  <label>Away Team Bonus:</label>
			  <input
				type="number"
				value={stage.scoring?.general?.awayTeamBonus ?? 0}
				onChange={(e) =>
				  handleScoringChange(sIdx, ["general", "awayTeamBonus"], e.target.value)
				}
			  />
			</div>

            {/* Scoring Rules – Batting */}
            <h4>Scoring Rules – Batting</h4>
            <div>
              <label>Points per Run:</label>
              <input
                type="number"
                value={stage.scoring?.batting?.perRun ?? 0}
                onChange={(e) => handleScoringChange(sIdx, ["batting", "perRun"], e.target.value)}
              />
            </div>
            <div>
              <label>Points per Ball Faced:</label>
              <input
                type="number"
                value={stage.scoring?.batting?.perBallFaced ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["batting", "perBallFaced"], e.target.value)
                }
              />
            </div>
            <div>
              <label>Points per 4:</label>
              <input
                type="number"
                value={stage.scoring?.batting?.perFour ?? 0}
                onChange={(e) => handleScoringChange(sIdx, ["batting", "perFour"], e.target.value)}
              />
            </div>
            <div>
              <label>Points per 6:</label>
              <input
                type="number"
                value={stage.scoring?.batting?.perSix ?? 0}
                onChange={(e) => handleScoringChange(sIdx, ["batting", "perSix"], e.target.value)}
              />
            </div>
            <div>
              <label>Bonus every </label>
              <input
                type="number"
                style={{ width: "60px" }}
                value={stage.scoring?.batting?.bonusEveryXRuns?.x ?? 0}
                onChange={(e) =>
                  handleScoringPairChange(sIdx, ["batting", "bonusEveryXRuns"], "x", e.target.value)
                }
              />
              <label> runs: </label>
              <input
                type="number"
                style={{ width: "60px" }}
                value={stage.scoring?.batting?.bonusEveryXRuns?.points ?? 0}
                onChange={(e) =>
                  handleScoringPairChange(
                    sIdx,
                    ["batting", "bonusEveryXRuns"],
                    "points",
                    e.target.value
                  )
                }
              />
            </div>
            <div>
              <label>Bonus for Not Out:</label>
              <input
                type="number"
                value={stage.scoring?.batting?.notOutBonus ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["batting", "notOutBonus"], e.target.value)
                }
              />
            </div>

            {/* Scoring Rules – Bowling */}
            <h4>Scoring Rules – Bowling</h4>
            <div>
              <label>Points per Ball Bowled:</label>
              <input
                type="number"
                value={stage.scoring?.bowling?.perBallBowled ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["bowling", "perBallBowled"], e.target.value)
                }
              />
            </div>
            <div>
              <label>Points per Dot Ball:</label>
              <input
                type="number"
                value={stage.scoring?.bowling?.perDotBall ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["bowling", "perDotBall"], e.target.value)
                }
              />
            </div>
			<div>
			  <label>Points per Maiden Over:</label>
			  <input
				type="number"
				value={stage.scoring?.bowling?.perMaidenOver ?? 0}
				onChange={(e) =>
				  handleScoringChange(sIdx, ["bowling", "perMaidenOver"], e.target.value)
				}
			  />
			</div>
            <div>
              <label>Points per Run Conceded:</label>
              <input
                type="number"
                value={stage.scoring?.bowling?.perRunConceded ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["bowling", "perRunConceded"], e.target.value)
                }
              />
            </div>
            <div>
              <label>Points per Wide:</label>
              <input
                type="number"
                value={stage.scoring?.bowling?.perWide ?? 0}
                onChange={(e) => handleScoringChange(sIdx, ["bowling", "perWide"], e.target.value)}
              />
            </div>
            <div>
              <label>Points per No Ball:</label>
              <input
                type="number"
                value={stage.scoring?.bowling?.perNoBall ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["bowling", "perNoBall"], e.target.value)
                }
              />
            </div>
            <div>
              <label>Points per Wicket:</label>
              <input
                type="number"
                value={stage.scoring?.bowling?.perWicket ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["bowling", "perWicket"], e.target.value)
                }
              />
            </div>
            <div>
              <label>Bonus after </label>
              <input
                type="number"
                style={{ width: "60px" }}
                value={stage.scoring?.bowling?.bonusAfterMinWickets?.min ?? 0}
                onChange={(e) =>
                  handleScoringPairChange(
                    sIdx,
                    ["bowling", "bonusAfterMinWickets"],
                    "min",
                    e.target.value
                  )
                }
              />
              <label> wickets: </label>
              <input
                type="number"
                style={{ width: "60px" }}
                value={stage.scoring?.bowling?.bonusAfterMinWickets?.points ?? 0}
                onChange={(e) =>
                  handleScoringPairChange(
                    sIdx,
                    ["bowling", "bonusAfterMinWickets"],
                    "points",
                    e.target.value
                  )
                }
              />
            </div>

            {/* Scoring Rules – Fielding */}
            <h4>Scoring Rules – Fielding</h4>
            <div>
              <label>Points per Catch:</label>
              <input
                type="number"
                value={stage.scoring?.fielding?.perCatch ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["fielding", "perCatch"], e.target.value)
                }
              />
            </div>
            <div>
              <label>Points per Run Out:</label>
              <input
                type="number"
                value={stage.scoring?.fielding?.perRunout ?? 0}
                onChange={(e) =>
                  handleScoringChange(sIdx, ["fielding", "perRunout"], e.target.value)
                }
              />
            </div>

            {/* Matches */}
            <h4>Matches</h4>
            {stage.matches?.map((match, mIdx) => (
              <div
                key={mIdx}
                style={{ marginBottom: "10px", padding: "5px", border: "1px solid #ccc" }}
              >
                <label>Match {mIdx + 1} </label>
				
			<div>
			  <label>Order:</label>
			  <input
				type="number"
				value={match.order ?? (mIdx + 1)}
				onChange={(e) => changeMatch(sIdx, mIdx, "order", Number(e.target.value))}
				style={{ width: "80px" }}
			  />
			</div>


			<div>
				<label>Team 1:</label>
				<select
				  value={match.team1 || "TBD"}
				  onChange={(e) => changeMatch(sIdx, mIdx, "team1", e.target.value)}
				>
				  <option value="TBD">TBD</option>
				  {(teamsByStage[stage.id] || []).map((team) => (
					<option key={team.id} value={team.id}>{team.name}</option>
				  ))}
				</select>

				<label>Team 2:</label>
				<select
				  value={match.team2 || "TBD"}
				  onChange={(e) => changeMatch(sIdx, mIdx, "team2", e.target.value)}
				>
				  <option value="TBD">TBD</option>
				  {(teamsByStage[stage.id] || []).map((team) => (
					<option key={team.id} value={team.id}>{team.name}</option>
				  ))}
				</select>

			 
			</div>
                <div>
                  <label>Match Date & Time:</label>
                  <input
                    type="datetime-local"
                    value={formatForInput(match.matchDate)}
                    onChange={(e) => changeMatch(sIdx, mIdx, "matchDate", new Date(e.target.value))}
                  />
                </div>

                <div>
                  <label>Sub Cutoff:</label>
                  <input
                    type="datetime-local"
                    value={formatForInput(match.cutoffDate)}
                    onChange={(e) => changeMatch(sIdx, mIdx, "cutoffDate", new Date(e.target.value))}
                  />
                </div>


				<button onClick={() => removeMatch(sIdx, mIdx)}>Remove Match</button>
				<button onClick={() => saveMatch(stage.id, match)}>Save Match</button>
				{/* disabling snapshots
				<button onClick={() => snapshotMatchXIs(tournamentId, stage.id, match.id)}>
				  Snapshot XIs
				</button>
				*/}
				{/* 🔹 New Scorecard button */}
				<Link
				  to={`/tournament/${tournamentId}/stage/${stage.id}/match/${match.id}/results`}
				>
				  <button>Scorecard</button>
				</Link>

              </div>
            ))}

             <button onClick={() => addMatch(stage.id, team1, team2)}>Add Match</button>


            {/* Teams & Players */}
            <h4>Stage Teams</h4>
            {(teamsByStage[stage.id] || []).map((team) => (
              <div
                key={team.id}
                style={{ marginBottom: "10px", padding: "5px", border: "1px solid #aaa" }}
              >
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => changeTeamName(stage.id, team.id, e.target.value)}
                />
                <button onClick={() => removeTeam(stage.id, team.id)}>Remove Team</button>
                <button onClick={() => saveTeam(stage.id, team)}>Save Team</button>

                <h5>Players</h5>
                {(playersByTeam[team.id] || []).map((player) => (
                  <div key={player.id}>
                    <input
                      type="text"
                      placeholder="Player Name"
                      value={player.playerName}
                      onChange={(e) =>
                        changePlayer(team.id, player.id, "playerName", e.target.value)
                      }
                    />
                    <select
                      value={player.role}
                      onChange={(e) => changePlayer(team.id, player.id, "role", e.target.value)}
                    >
                      <option value="Batsman">Batsman</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All Rounder">All Rounder</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Value"
                      value={player.value}
                      onChange={(e) => changePlayer(team.id, player.id, "value", e.target.value)}
                    />
                    <button onClick={() => removePlayer(stage.id, team.id, player.id)}>
                      Remove
                    </button>
                    <button onClick={() => savePlayer(stage.id, team.id, player)}>Save</button>
                  </div>
                ))}
                <button onClick={() => addPlayer(stage.id, team.id)}>Add Player</button>
                <button
                  onClick={() =>
                    document.getElementById(`csv-${stage.id}-${team.id}`).click()
                  }
                >
                  Import CSV
                </button>
                <input
                  id={`csv-${stage.id}-${team.id}`}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => importCSV(e, stage.id, team.id)}
                />
              </div>
            ))}
            <button onClick={() => addTeam(stage.id)}>Add Team</button>

            <div style={{ marginTop: "10px" }}>
              <button onClick={() => saveStage(stage)}>Save Stage</button>
            </div>
          </div>
        ))}

        <button onClick={addStage}>Add Stage</button>
      </div>

      <button onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
};

export default EditTournament;
