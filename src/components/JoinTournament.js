import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { query, orderBy } from "firebase/firestore";
import PlayerBreakdown from "./PlayerBreakdown";



import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {sortByRole } from "../lib/sortByRole";

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
  
  const [savedPlayers, setSavedPlayers] = useState({});     // last saved squads per stage
  const [subsUsedLive, setSubsUsedLive] = useState({});     // live (unsaved) subs per stage
  const [subsUsedFromDB, setSubsUsedFromDB] = useState({}); // committed subs per stage
  
  const [xiByMatch, setXiByMatch] = useState({});        // { [matchId]: string[] of playerIds }
  const [xiTotalByMatch, setXiTotalByMatch] = useState({}); // { [matchId]: number }
  const [expandedPlayer, setExpandedPlayer] = React.useState(null);
  
  const [playerSort, setPlayerSort] = useState({ field: "total", dir: "desc" });
  
  const recalcBudget = (stageId, team) => {
    const totalSpent = team.reduce((sum, p) => sum + (p.cost || 0), 0);
    const budgetLeft = (stages.find(s => s.id === stageId)?.maxBudget ?? 0) - totalSpent;
  
    setBudgetLeftByStage(prev => ({ ...prev, [stageId]: budgetLeft }));
  };

  const handlePlayerSort = (field) => {
    setPlayerSort((prev) => {
      const dir = prev.field === field && prev.dir === "asc" ? "desc" : "asc";
      return { field, dir };
    });
  };
  
  const togglePlayerDetails = (playerId) => {
    setExpandedPlayer((prev) => (prev === playerId ? null : playerId));
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const stageToExpand = searchParams.get("stage");
    if (stageToExpand) setExpandedStage(stageToExpand);
  }, [searchParams]);

  const toggleMatchDetails = (matchId) => {
    setExpandedMatches((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };
  
 
  // 🔹 Helper: compute total points earned by a player across all matches in this stage
  const getPlayerTotalPoints = (stageId, playerId) => {
    const matches = stageResults[stageId] || [];
    return matches.reduce((sum, match) => {
      const p = match.players.find(mp => mp.id === playerId);
      return sum + (p?.points?.total ?? 0);
    }, 0);
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
        const data = userSnap.data() || {};
        const rec = data[id] || {};
  
        if (rec.joined) setJoined(true);
		if (rec.stages) {
		  const sortedStages = {};
		  Object.keys(rec.stages).forEach(stageId => {
			const team = rec.stages[stageId] || [];
			sortedStages[stageId] = sortByRole(team, resolvePlayer);
		  });

		  setSelectedPlayers(sortedStages);
		  setSavedPlayers(sortedStages); // 🔹 baseline for comparisons
		} else {
		  setSelectedPlayers({});
		  setSavedPlayers({});
		}
  
        if (rec.budgets) setBudgetLeftByStage(rec.budgets);
        setSubsUsedFromDB(rec.subsUsed || {});     // 🔹 committed subs from DB (per stage)
      } else {
        setJoined(false);
        setSelectedPlayers({});
        setSavedPlayers({});
        setBudgetLeftByStage({});
        setSubsUsedFromDB({});
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
	  await setDoc(
		  userRef,
		  {
			displayName: auth.currentUser.displayName || "",
			email: auth.currentUser.email || "",
			[id]: { joined: true, stages: {}, budgets: {} },
		  },
		  { merge: true }
		);

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
  const togglePlayer = async (stageId, player) => {
    if (!joined) return;
  
    const stagePlayers = selectedPlayers[stageId] || [];
    const exists = stagePlayers.some((p) => p.playerId === player.id);
  
    // build new selection
    const newSelection = exists
      ? stagePlayers.filter((p) => p.playerId !== player.id)
      : [...stagePlayers, { playerId: player.id, teamId: player.team }];
  
    // update selection state
	// update selection state (always sorted)
	const sortedSelection = sortByRole(newSelection, resolvePlayer);
	const updated = { ...selectedPlayers, [stageId]: sortedSelection };
	setSelectedPlayers(updated);
	
	// --- 🔹 Sub counting only if stage has locked matches ---
	const matchesSnap = await getDocs(
		query(
		collection(db, "tournaments", id, "stages", stageId, "matches"),
		orderBy("order", "asc")
		)
	);
	const anyLocked = matchesSnap.docs.some((d) => {
		const m = d.data() || {};
		const cut = m.cutoffDate?.toDate ? m.cutoffDate.toDate() : m.cutoffDate;
		return cut && new Date(cut) < new Date();
	});
	if (!anyLocked) return; // 🚫 skip sub count updates

  
    // --- 🔹 Live sub logic ---
    const oldSquad = savedPlayers[stageId] || [];
    const oldIds = oldSquad.map((p) => p.playerId);
    const newIds = newSelection.map((p) => p.playerId);
  
    if (oldIds.length === 11 && newIds.length === 11) {
      const removed = oldIds.filter((p) => !newIds.includes(p));
      const added = newIds.filter((p) => !oldIds.includes(p));
      const changes = Math.max(removed.length, added.length);
  
      setSubsUsedLive((prev) => ({ ...prev, [stageId]: changes }));
    } else {
      // if not full team yet, reset subs count for this stage
      setSubsUsedLive((prev) => ({ ...prev, [stageId]: 0 }));
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

        next[stage.id] = total - spent;
      });
      return next;
    });
  }, [stages, selectedPlayers, playersByTeam]);
  
  const hasLockedMatches = async (stageId) => {
    const matchesSnap = await getDocs(
      query(collection(db, "tournaments", id, "stages", stageId, "matches"), orderBy("order", "asc"))
    );
    return matchesSnap.docs.some(d => {
      const m = d.data() || {};
      const cut = m.cutoffDate?.toDate ? m.cutoffDate.toDate() : m.cutoffDate;
      return cut && new Date(cut) < new Date(); // locked
    });
  };

  
  const handleResetTeam = async (stageId) => {
    if (!window.confirm("Discard all unsaved changes and revert to your last saved team?")) return;
  
    try {
      const userRef = doc(db, "user_teams", user.uid);
      const userSnap = await getDoc(userRef);
  
      if (!userSnap.exists()) {
        alert("No saved team found in Firestore.");
        return;
      }
  
      const userData = userSnap.data() || {};
      const stageData = userData[id]?.stages?.[stageId] || [];
      const subsSaved = userData[id]?.subsUsed?.[stageId] ?? 0;
  
      // ✅ Reset to what’s truly saved in Firestore
      setSelectedPlayers(prev => ({ ...prev, [stageId]: stageData }));
      setSavedPlayers(prev => ({ ...prev, [stageId]: stageData }));
      setSubsUsedLive(prev => ({ ...prev, [stageId]: 0 }));
      setSubsUsedFromDB(prev => ({ ...prev, [stageId]: subsSaved }));
	  
	  recalcBudget(stageId, stageData);
  
      alert(`Changes discarded. Restored your last saved team with ${subsSaved} substitutions used.`);
    } catch (err) {
      console.error("Error discarding changes:", err);
      alert("Failed to restore saved team. Please try again.");
    }
  };


  const handleRevertTeam = async (stageId) => {
    if (!user) return;
    if (!window.confirm("Revert to the last locked team? This will overwrite your current team.")) return;
  
    const now = new Date();
    const matchesSnap = await getDocs(
      query(collection(db, "tournaments", id, "stages", stageId, "matches"), orderBy("order", "asc"))
    );
  
    // find last locked match (cutoffDate < now)
    const lockedMatches = matchesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => {
        const cut = m.cutoffDate?.toDate ? m.cutoffDate.toDate() : m.cutoffDate;
        return cut && new Date(cut) < now;
      });
  
	if (lockedMatches.length === 0) {
	  const lastSaved = savedPlayers[stageId] || [];
	  setSelectedPlayers(prev => ({ ...prev, [stageId]: lastSaved }));
	  recalcBudget(stageId, lastSaved);
	  return;
	}
	  
    // get latest locked match (highest order)
    const lastLocked = lockedMatches[lockedMatches.length - 1];
  
    // read its XI doc
    const xiRef = doc(db, "tournaments", id, "stages", stageId, "matches", lastLocked.id, "11s", user.uid);
    const xiSnap = await getDoc(xiRef);
	
	
  
    if (!xiSnap.exists()) {
      alert("No saved XI found for your team in the last locked match.");
      return;
    }
  
    const xiData = xiSnap.data();
    const team = xiData.team || [];
    const subsUsedAtThatTime = xiData.subsUsed ?? 0;
  
    // rebuild selectedPlayers array from IDs
    const restoredSelections = team.map(pid => ({ playerId: pid }));
  
    setSelectedPlayers(prev => ({ ...prev, [stageId]: restoredSelections }));
    //setSavedPlayers(prev => ({ ...prev, [stageId]: restoredSelections }));
    setSubsUsedFromDB(prev => ({ ...prev, [stageId]: subsUsedAtThatTime }));
    setSubsUsedLive(prev => ({ ...prev, [stageId]: 0 }));
	
	// 🔹 Persist reverted subsUsed to Firestore so future saves start from this point
	const userRef = doc(db, "user_teams", user.uid);
	
	recalcBudget(stageId, restoredSelections);
  
    alert(`Team reverted to last locked match (${lastLocked.order}). Substitutions used: ${subsUsedAtThatTime}`);
  };

  
  const handleGenerateRandomTeam = async (stageId) => {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return;

  // 🚫 Case 1: already has a saved team
  if ((savedPlayers[stageId] || []).length > 0) {
    alert("You already have a saved team. Cannot randomize.");
    return;
  }

  const roleComp = stage.roleComposition || {};
  const budget = stage.budget || 0;
  const sameTeamMax = roleComp.sameTeamMax || 11;

  // 🔹 Get all players in this stage
  const allPlayers = (teamsByStage[stageId] || [])
    .flatMap((team) => playersByTeam[team.id] || [])
    .filter(Boolean);

  // 🔹 Group by role
  const batsmen = allPlayers.filter(p => p.role === "Batsman");
  const bowlers = allPlayers.filter(p => p.role === "Bowler");
  const allRounders = allPlayers.filter(p => p.role === "All Rounder");

  const requiredBats = roleComp.batsman ?? 0;
  const requiredBowl = roleComp.bowler ?? 0;
  const requiredAllr = roleComp.allRounder ?? 0;
  const totalRequired = 11;

  // Helper to shuffle an array (Fisher–Yates)
  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // 🔹 Shuffle each role group for randomness
  const pickRandom = (arr, n) => shuffle(arr).slice(0, n);
  
    let attempt = 0;
    let team = [];
    const maxAttempts = 100;
  
    while (attempt < maxAttempts) {
      attempt++;
  
      const chosen = [
        ...pickRandom(batsmen, requiredBats),
        ...pickRandom(bowlers, requiredBowl),
        ...pickRandom(allRounders, requiredAllr),
      ];
  
      // Fill remaining slots randomly if < 11
      let remaining = totalRequired - chosen.length;
      if (remaining > 0) {
        const leftoverPool = allPlayers.filter(p => !chosen.includes(p));
        chosen.push(...pickRandom(leftoverPool, remaining));
      }
  
      // 🔹 Check constraints
      const totalCost = chosen.reduce((sum, p) => sum + Number(p.value || 0), 0);
      const teamCount = {};
      chosen.forEach(p => {
        teamCount[p.team] = (teamCount[p.team] || 0) + 1;
      });
      const maxFromTeam = Math.max(...Object.values(teamCount));
  
      if (totalCost <= budget && maxFromTeam <= sameTeamMax) {
        team = chosen;
        break;
      }
    }
  
    if (team.length !== 11) {
      alert("Could not generate a valid random team within the budget after several tries.");
      return;
    }
  
    // ✅ Save locally
    const selections = team.map((p) => ({ playerId: p.id, teamId: p.team }));
    setSelectedPlayers((prev) => ({ ...prev, [stageId]: selections }));
  
    alert("Random XI generated! Review and click Save Team to confirm.");
  };



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
	
	// --- Substitution validation (UI-driven, no diff logic) ---
	const userRef = doc(db, "user_teams", user.uid);
	const userSnap = await getDoc(userRef);
	const prevData = userSnap.exists() ? userSnap.data() : {};

	// ✅ use exactly what UI shows
	const uiSubs =
	  (subsUsedFromDB[stageId] ?? 0) + (subsUsedLive[stageId] ?? 0);
	const subsUsed = uiSubs;

	// validate against stage cap
	if (subsUsed > stage.subsAllowed) {
	  violations.push(`Too many subs: (${subsUsed}/${stage.subsAllowed})`);
	}

	
  
    if (violations.length > 0) {
      alert(`Cannot save stage "${stage.name}". Fix violations: ${violations.join(", ")}`);
      return;
    }
  
    // --- save to Firestore ---
    try {
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
		  subsUsed: {
			  ...(prevData[id]?.subsUsed || {}),
			  [stageId]: subsUsed,
		  },
		  },
	  },
	  { merge: true }
	 );
	 
	// 🔒 Write XI only for matches that are NOT locked
	const teamIds = stageSelections.map(sel => sel.playerId);
	const matchesSnap = await getDocs(
	  collection(db, "tournaments", id, "stages", stageId, "matches")
	);

	let xiWritten = 0, xiSkipped = 0;
	
	for (const mdoc of matchesSnap.docs) {
	  const m = mdoc.data() || {};
	  
	  const cutoff = m.cutoffDate?.toDate ? m.cutoffDate.toDate() : m.cutoffDate;
	  const isBeforeCutoff = cutoff && new Date() < new Date(cutoff);
	  if (!isBeforeCutoff) { xiSkipped++; continue; }


	  const xiRef = doc(
		db,
		"tournaments", id,
		"stages", stageId,
		"matches", mdoc.id,
		"11s", user.uid
	  );

	  // Only update team + timestamp; preserve totalPoints if present
	  await setDoc(
		xiRef,
		{ 
		  uid: user.uid, 
		  team: teamIds, 
		  updatedAt: serverTimestamp(),
		  subsUsed: subsUsed,
		},
		{ merge: true }
	  );
	  xiWritten++;
	}
	console.log(`XI write: written=${xiWritten}, skipped(locked)=${xiSkipped}`);

	// 🔄 refresh my XI + totals for this stage so UI updates right away
	const matchesSnapAfter = await getDocs(
	  collection(db, "tournaments", id, "stages", stageId, "matches")
	);
	const matchesAfter = matchesSnapAfter.docs.map(d => ({ id: d.id, ...d.data() }));
	await fetchMyXIForStage(stageId, matchesAfter);

	// 🔹 User-facing summary (single alert)
	if (xiWritten === 0) {
	  alert("Cannot save team. All matches in this stage are locked.");
	  return; // stop further execution
	} else {
	  alert(`Saved team. This team will be used for the ${xiWritten} remaining match(es) in this stage.`);
	}

	setSavedPlayers((prev) => ({ ...prev, [stageId]: stageSelections }));
	setSubsUsedFromDB((prev) => ({ ...prev, [stageId]: subsUsed }));
	setSubsUsedLive((prev) => ({ ...prev, [stageId]: 0 }));

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
	const matchesSnap = await getDocs(
	  query(matchesRef, orderBy("order", "asc"))
	);  
	console.log("Fetching match results for user:", user?.uid);
    for (const m of matchesSnap.docs) {
      const matchData = { id: m.id, ...m.data(), players: [] };
  
      const statsSnap = await getDocs(collection(matchesRef, m.id, "stats"));
      statsSnap.forEach((s) => {
        matchData.players.push({ id: s.id, ...s.data() });
      });
	  
	  // 🔹 Fetch this user's locked XI for this match
		const xiRef = doc(
		  db,
		  "tournaments", id,
		  "stages", stageId,
		  "matches", m.id,
		  "11s", user.uid
		);
	  const xiSnap = await getDoc(xiRef);
	  if (xiSnap.exists()) {
		  matchData.userXI = xiSnap.data().team || [];
		  
		  console.log(`[DB READ] Match ${m.id}: XI found. Player Count: ${matchData.userXI.length}`);
	  } else {
		  matchData.userXI = [];
		  
		  console.log(`[DB READ] Match ${m.id}: NO XI found.`);
	  }
 
      results.push(matchData);
    }
  
    return results;
  };
  
  const fetchMyXIForStage = async (stageId, matches) => {
  if (!user) return;
  const byMatch = {};
  const totals = {};
  for (const m of matches) {
    try {
      const xiDoc = await getDoc(
        doc(db, "tournaments", id, "stages", stageId, "matches", m.id, "11s", user.uid)
      );
      if (xiDoc.exists()) {
        const d = xiDoc.data() || {};
        byMatch[m.id] = Array.isArray(d.team) ? d.team : [];
        totals[m.id] = Number.isFinite(d.totalPoints) ? d.totalPoints : 0;
      } else {
        byMatch[m.id] = [];
        totals[m.id] = 0;
      }
    } catch (e) {
      console.error("XI load failed for match", m.id, e);
      byMatch[m.id] = [];
      totals[m.id] = 0;
    }
  }
  setXiByMatch(prev => ({ ...prev, ...byMatch }));
  setXiTotalByMatch(prev => ({ ...prev, ...totals }));
};


  const formatScoringSummary = (scoring = {}) => {
    const parts = [];
  
    // --- Batting ---
    const bat = scoring.batting || {};
    const batting = [];
    if (bat.perRun != null) batting.push(`${bat.perRun}/run`);
    if (bat.perBallFaced != null) batting.push(`${bat.perBallFaced}/ball faced`);
	if (bat.perDuck != null) batting.push(`${bat.perDuck}/duck`);
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
	if (bowl.perMaidenOver != null) bowling.push(`${bowl.perMaidenOver}/maiden`);
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
	if (gen.perWin != null) {
      const prefix = gen.perWin > 0 ? "+" : "";
      general.push(`${prefix}${gen.perWin} win bonus`);
    }
	if (gen.perSelection != null) {
      const prefix = gen.perSelection > 0 ? "+" : "";
      general.push(`${prefix}${gen.perSelection} selection bonus`);
    }
	if (gen.manOfTheMatch != null) {
      const prefix = gen.manOfTheMatch > 0 ? "+" : "";
      general.push(`${prefix}${gen.manOfTheMatch} for man of match`);
    }
	if (gen.awayTeamBonus != null) {
      const prefix = gen.manOfTheMatch > 0 ? "+" : "";
      general.push(`${prefix}${gen.awayTeamBonus} away bonus`);
    }
    if (general.length) parts.push(`Other: ${general.join(", ")}`);
  
    return parts;
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!tournament) return null;

  return (
    <div className="join-tournament-container p-4 md:p-6" style={{ maxHeight: "100vh", overflowX: "auto", overflowY: "auto", width: "100%" }}>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <div className="flex gap-2">
          {joined ? (
            <button onClick={handleLeave} className="btn-danger">Leave</button>
          ) : (
            <button onClick={handleJoin} className="btn-add">Join</button>
          )}
		  <button
      onClick={() => navigate(`/tournament/${id}/leaderboard`)}
      className="bg-gray-700 text-white px-4 py-2 rounded"
    >
      Leaderboard
    </button>
          <button onClick={() => navigate("/")} className="bg-gray-500 text-white px-4 py-2 rounded">Back to Home</button>
        </div>
      </div>

      {stages.map((stage) => {
		const totalStagePoints =
		  (stageResults[stage.id] || []).reduce(
			(sum, m) => sum + (xiTotalByMatch[m.id] ?? 0),
			0
		  );

				
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
			<div className="p-3 bg-gray-100 flex items-center justify-between gap-3">
			  <span className="font-bold text-base md:text-lg"><b>{stage.name}</b></span>

			  <div className="flex items-center gap-3 text-sm text-gray-700">
				<span>
				  {stageSelections.length} picked | Budget left: {remaining}
				</span>
				<button
				  onClick={async () => {
					if (isExpanded) {
					  setExpandedStage(null);
					} else {
					  const matches = await fetchMatchResults(stage.id);
					  setStageResults(prev => ({ ...prev, [stage.id]: matches }));
					  setExpandedStage(stage.id);
					  await fetchMyXIForStage(stage.id, matches);
					}
				  }}
				  className="btn-secondary"
				>
				  {isExpanded ? "Collapse" : "Expand"}
				</button>
			  </div>
			</div>



            {isExpanded && (
              <div className="p-3">
			    <div className="mt-1 text-sm">

				{/* Scoring summary */}
				<b>Scoring Rules:</b> <br />

				<div className="text-sm text-gray-700 mt-1">
				  {formatScoringSummary(stage.scoring).map((line, idx) => (
					<div key={idx}>{line}</div>
				  ))}
				</div>

				<p className={`${errors.length ? "text-red-600" : "text-gray-600"}`}>
				  <b>Role Composition:</b> <br />
				  {roleComp.batsman ?? 0} Batsmen | {roleComp.bowler ?? 0} Bowlers | {roleComp.allRounder ?? 0} All Rounders | Max {" "}{roleComp.sameTeamMax ?? 0} from same team
				  <br />
				  11 Total Players
				</p> 
				
                </div>
			  {/* Match Results */}
				{(stageResults[stage.id] || []).length > 0 && (
				  <div className="mb-4">
					<h3 className="font-semibold mb-2">Match Results</h3>
					
					<p className="text-lg font-semibold text-gray-800 mt-3 mb-2">
					  <b>Stage Points: {totalStagePoints}</b>
					</p>
					
					{stageResults[stage.id].map((match, idx) => {
					  const xi = xiByMatch[match.id] || []; // array of playerIds

						let totalPoints = 0;
						const playerRows = xi.map((pid) => {
						  const stat = match.players.find(mp => mp.id === pid);
						  if (!stat) return null;
						  const pts = stat.points || {};
						  totalPoints += pts.total ?? 0;
							return (
							  <React.Fragment key={pid}>
								<tr>
								  <td className="border px-2 py-1">{resolvePlayer(pid)?.playerName}</td>
								  <td className="border px-2 py-1 text-right">{pts.batting ?? 0}</td>
								  <td className="border px-2 py-1 text-right">{pts.bowling ?? 0}</td>
								  <td className="border px-2 py-1 text-right">{pts.fielding ?? 0}</td>
								  <td className="border px-2 py-1 text-right">{pts.general ?? 0}</td>
								  <td className="border px-2 py-1 text-right font-semibold">{pts.total ?? 0}</td>
								  <td className="border px-2 py-1 text-center">
									<button
									  className="btn-secondary"
									  onClick={() => togglePlayerDetails(pid)}
									>
									  {expandedPlayer === pid ? "Hide" : "Details"}
									</button>
								  </td>
								</tr>

								{expandedPlayer === pid && (
								  <tr>
									<td colSpan={7} className="bg-gray-50 p-2">
									  <PlayerBreakdown
										p={{ id: pid, ...resolvePlayer(pid), points: pts }}
										scoring={stage.scoring}
									  />
									</td>
								  </tr>
								)}
							  </React.Fragment>
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

					  const matchTotal = match.players.some(p => p.points)
					  ? xi.reduce((sum, pid) => {
						  const stat = match.players.find(mp => mp.id === pid);
						  return sum + (stat?.points?.total ?? 0);
						}, 0)
					  : null;
					  
					  const isScored = !!match.scored;
					  const cut = match.cutoffDate?.toDate ? match.cutoffDate.toDate() : match.cutoffDate;
					  const cutoffStringHere = cut ? new Date(cut).toLocaleString() : "cutoff";
					  

					  return (
						<div
						  key={match.id}
						  className="mb-3 border border-gray-300 rounded p-2 bg-gray-50"
						>
						  <div className="flex justify-between items-center">
							
							  Match {match.order}: {team1Name} vs {team2Name} {" "}
 							  {(() => {
 							    const total = xiTotalByMatch[match.id] ?? 0;
 							    const cut = match.cutoffDate?.toDate ? match.cutoffDate.toDate() : match.cutoffDate;
 							    const cutoffTime = cut ? new Date(cut) : null;
 							    const now = new Date();
 							    const isBeforeCutoff = cutoffTime && now < cutoffTime;
 							    const isScored = total > 0;
							  
 							    if (isScored) {
								  return (
								 	 <>
								 	 <span className="text-sm text-gray-600 ml-1">
								 		 (match total: {total})
								 	 </span>
								  
								 	 
								  
								 	 <button
								 		 onClick={() => toggleMatchDetails(match.id)}
								 		 className="btn-secondary ml-2"
								 	 >
								 		 {expandedMatches[match.id] ? "Hide Match XI" : "Show Match XI"}
								 	 </button>
									 
									 {/* ✅ New Scorecard button */}
								 	 <button
								 		 
								 		 onClick={() =>
								 		 navigate(`/tournament/${id}/stage/${stage.id}/match/${match.id}/scorecard`)
								 		 }
								 	 >
								 		 See Full Scorecard
								 	 </button>
									 
								 	 </>
								  );
								} else if (isBeforeCutoff) {
 							  	return (
 							  	  <span className="text-sm text-gray-600 ml-1">
 							  		(changes allowed till <b>{cutoffTime.toLocaleString()}</b>)
 							  	  </span>
 							  	);
 							    } else {
								  return (
								    <>
								    <span className="text-sm text-gray-400 ml-1">
								  	(waiting for results) {" "}
								    </span>
								    <button
								  	onClick={() => toggleMatchDetails(match.id)}
								  	className="text-blue-600 underline text-sm ml-2"
								    >
								  	{expandedMatches[match.id] ? "Hide Details" : "Show Details"}
								    </button>
								    </>
								  );
 							    }
 							  })()}
							  

						  </div>
						 
						  {/* 🔹 Show team details for matches that are locked but not yet scored */}
							{expandedMatches[match.id] && !isScored && (
							  <div className="mt-2">
								<table className="score-table text-sm border border-gray-300 rounded w-auto">
								  <thead className="bg-gray-100">
									<tr>
									  <th className="border px-2 py-1 text-left">Player</th>
									  <th className="border px-2 py-1 text-right">Role</th>
									  <th className="border px-2 py-1 text-right">Team</th>
									</tr>
								  </thead>
								  <tbody>
									{sortByRole((match.userXI || []).map(pid => ({ playerId: pid })), resolvePlayer).map(sel => {
									  const p = resolvePlayer(sel.playerId);
									  return (
										<tr key={sel.playerId}>
										  <td className="border px-2 py-1">{p?.playerName || sel.playerId}</td>
										  <td className="border px-2 py-1 text-right">{p?.role || ""}</td>
										  <td className="border px-2 py-1 text-right">{p?.team || ""}</td>
										</tr>
									  );
									})}
								  </tbody>
								</table>
							  </div>
							)}

						  {isScored && expandedMatches[match.id] && (
							<div className="mt-2">

							  <table className="score-table text-sm border border-gray-300 rounded w-auto">
								<thead className="bg-gray-100">
								  <tr>
									<th 
									  className="border px-2 py-1 text-left cursor-pointer"
									  onClick={() => handlePlayerSort("name")}
									>
									  Player {playerSort.field === "name" && (playerSort.dir === "asc" ? "▲" : "▼")}
									</th>
									<th 
									  className="border px-2 py-1 text-right cursor-pointer"
									  onClick={() => handlePlayerSort("batting")}
									>
									  Bat {playerSort.field === "batting" && (playerSort.dir === "asc" ? "▲" : "▼")}
									</th>
									<th 
									  className="border px-2 py-1 text-right cursor-pointer"
									  onClick={() => handlePlayerSort("bowling")}
									>
									  Bowl {playerSort.field === "bowling" && (playerSort.dir === "asc" ? "▲" : "▼")}
									</th>
									<th 
									  className="border px-2 py-1 text-right cursor-pointer"
									  onClick={() => handlePlayerSort("fielding")}
									>
									  Field {playerSort.field === "fielding" && (playerSort.dir === "asc" ? "▲" : "▼")}
									</th>
									<th 
									  className="border px-2 py-1 text-right cursor-pointer"
									  onClick={() => handlePlayerSort("general")}
									>
									  Gen {playerSort.field === "general" && (playerSort.dir === "asc" ? "▲" : "▼")}
									</th>
									<th 
									  className="border px-2 py-1 text-right cursor-pointer"
									  onClick={() => handlePlayerSort("total")}
									>
									  Total {playerSort.field === "total" && (playerSort.dir === "asc" ? "▲" : "▼")}
									</th>
									<th className="border px-2 py-1 text-center">Details</th>
								  </tr>
								</thead>

<tbody>
  {xi
    .map(pid => {
      const stat = match.players.find((mp) => mp.id === pid);
      if (!stat) return null;
      const pts = stat.points || {};
      return { pid, stat, pts, player: resolvePlayer(pid) };
    })
    .filter(item => item !== null)
    .sort((a, b) => {
      const { field, dir } = playerSort;
      let valA, valB;
      
      if (field === "total") {
        valA = a.pts.total ?? 0;
        valB = b.pts.total ?? 0;
      } else if (["batting", "bowling", "fielding", "general"].includes(field)) {
        valA = a.pts[field] ?? 0;
        valB = b.pts[field] ?? 0;
      } else if (field === "name") {
        valA = a.player?.playerName || "";
        valB = b.player?.playerName || "";
      }
      
      if (valA < valB) return dir === "asc" ? -1 : 1;
      if (valA > valB) return dir === "asc" ? 1 : -1;
      return 0;
    })
    .map(({ pid, stat, pts, player }) => {
      return (
        <React.Fragment key={pid}>
          <tr>
            <td className="border px-2 py-1">{player?.playerName}</td>
            <td className="border px-2 py-1 text-right">{pts.batting ?? 0}</td>
            <td className="border px-2 py-1 text-right">{pts.bowling ?? 0}</td>
            <td className="border px-2 py-1 text-right">{pts.fielding ?? 0}</td>
            <td className="border px-2 py-1 text-right">{pts.general ?? 0}</td>
            <td className="border px-2 py-1 text-right font-semibold">
              {pts.total ?? 0}
            </td>
            <td className="border px-2 py-1 text-center">
              <button
                className="btn-secondary"
                onClick={() => togglePlayerDetails(pid)}
              >
                {expandedPlayer === pid ? "Hide" : "Details"}
              </button>
            </td>
          </tr>

          {expandedPlayer === pid && (
            <tr>
              <td colSpan={7} className="bg-gray-50 p-2">
                <PlayerBreakdown
                  p={{ id: pid, ...stat, points: pts }}
                  scoring={stage.scoring}
                />
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    })}
</tbody>
								<tfoot>
								  <tr>
									<td className="text-right font-semibold" colSpan="6">
									  Match Total
									</td>
									<td className="text-right font-semibold">
									  {xiTotalByMatch[match.id] != null ? xiTotalByMatch[match.id] : totalPoints}
									</td>

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
					? `${user.displayName.split(" ")[0]}'s team for ${stage.name}`
					: `Your team for ${stage.name}`}
				</h3>

				{errors.length > 0 && (
				  <div className="text-red-600 font-semibold mb-2">
					Violations: {errors.join(", ")}
				  </div>
				)}
				
			  	{/* 🔹 Save button directly after selected players */}
				
				
				<p className={`${errors.length ? "text-red-600" : "text-gray-600"}`}>
				  {batsmen}/{roleComp.batsman ?? 0} Batsmen,{" "}
				  {bowlers}/{roleComp.bowler ?? 0} Bowlers,{" "}
				  {allRounders}/{roleComp.allRounder ?? 0} All Rounders,{" "}
				  {maxFromSameTeam}/{roleComp.sameTeamMax ?? 0} same team
				  <br />
				  {stageSelections.length}/11 Total Players
				</p> 
				
				<p className={`${errors.length ? "text-red-600" : "text-gray-600"}`}>
				  <b>
  Subs used: {(subsUsedFromDB[stage.id] ?? 0) + (subsUsedLive[stage.id] ?? 0)}/{stage.subsAllowed ?? 0}{" "}
  ({(stage.subsAllowed ?? 0) - ((subsUsedFromDB[stage.id] ?? 0) + (subsUsedLive[stage.id] ?? 0))} left)


					{" "} | Budget: {total - remaining}/{total} ({remaining} left)</b>
				</p>
				
				{joined && (() => {
				  // --- Compare selected vs saved XI for this stage ---
				  const currentTeam = selectedPlayers[stage.id] || [];
				  const savedTeam = savedPlayers[stage.id] || [];

				  const isSameXI = (a, b) => {
					if (a.length !== b.length) return false;
					const aIds = a.map(p => p.playerId).sort();
					const bIds = b.map(p => p.playerId).sort();
					return JSON.stringify(aIds) === JSON.stringify(bIds);
				  };

				  const hasChanges = !isSameXI(currentTeam, savedTeam);

				  return (
					<div className="flex gap-2 mb-4">
					  <button
						onClick={() => handleGenerateRandomTeam(stage.id)}
						className="bg-green-400 text-black px-4 py-2 rounded"
					  >
						Random XI
					  </button>

					  <button
						onClick={() => handleSaveTeam(stage.id)}
						disabled={!hasChanges}
						className={`px-4 py-2 rounded ${
						  hasChanges
							? "bg-blue-500 text-white cursor-pointer"
							: "bg-blue-300 text-gray-200 cursor-not-allowed"
						}`}
					  >
						{hasChanges ? "Save Team" : "No Changes to Save"}
					  </button>

					  <button
						onClick={() => handleResetTeam(stage.id)}
						disabled={!hasChanges}
						className={`px-4 py-2 rounded ${
						  hasChanges
							? "bg-gray-500 text-white cursor-pointer"
							: "bg-gray-400 text-gray-200 cursor-not-allowed"
						}`}
					  >
						Discard Changes
					  </button>

					  <button
						onClick={() => handleRevertTeam(stage.id)}
						className="btn-danger"
					  >
						Revert to Last XI
					  </button>
					</div>
				  );
				})()}


                {stageSelections.length === 0 ? (
                  <p className="text-sm text-gray-700">No players selected.</p>
                ) : (
                  <table className="score-table text-sm mt-2 w-full min-w-max">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-1">Name</th>
                        <th className="border px-2 py-1">Role</th>
                        <th className="border px-2 py-1">Team</th>
                        <th className="border px-2 py-1">Cost</th>
						<th className="border px-2 py-1">Points</th>
                        <th className="border px-2 py-1">Action</th>
                      </tr>
                    </thead>
					<tbody>
					  {sortByRole(stageSelections, resolvePlayer).map((sel, i) => {
						const player = resolvePlayer(sel.playerId);
						if (!player) return null;
						return (
						  <tr key={i}>
							<td className="border px-2 py-1">{player.playerName}</td>
							<td className="border px-2 py-1">{player.role}</td>
							<td className="border px-2 py-1">{player.team}</td>
							<td className="border px-2 py-1">{player.value}</td>
							<td className="border px-2 py-1 text-right">
							  {getPlayerTotalPoints(stage.id, player.id)}
							</td>
							<td className="border px-2 py-1">
							  <button
								onClick={() => togglePlayer(stage.id, player)}
								className="btn-danger"
							  >
								Drop
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
                <table className="score-table text-sm mt-2 w-full min-w-max">
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
   				    	Cost{" "}
   				    	{sortConfig.field === "value" && (
   				    		<span>{sortConfig.dir === "asc" ? "▲" : "▼"}</span>
   				    	)}
   				    	</th>
						<th
					    className="border px-2 py-1 cursor-pointer"
					    onClick={() => handleSort("pointsEarned")}
						>
					    Points {" "}
					    {sortConfig.field === "pointsEarned" && (
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
					    let valA, valB;
					  
					    if (field === "pointsEarned") {
					  	valA = getPlayerTotalPoints(stage.id, a.id);
					  	valB = getPlayerTotalPoints(stage.id, b.id);
					    } else {
					  	valA = a[field];
					  	valB = b[field];
					    }
					  
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
							<td className="border px-2 py-1 text-right">
							  {getPlayerTotalPoints(stage.id, p.id)}
							</td>
							<td className="border px-2 py-1">
							  {isSelected ? (
								<button
								  onClick={() => togglePlayer(stage.id, p)}
								  className="btn-danger"
								>
								  Drop
								</button>
							  ) : (
								<button
								  onClick={() => togglePlayer(stage.id, p)}
								  className="btn-add"
								  disabled={!joined}
								>
								  Pick
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
