import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection, getDocs, doc, getDoc, query, orderBy
} from "firebase/firestore";
import PlayerBreakdown from "./PlayerBreakdown";


async function loadMatchStats(tId, sId, mId) {
  const statsSnap = await getDocs(
    collection(db, "tournaments", tId, "stages", sId, "matches", mId, "stats")
  );
  const stats = {};
  statsSnap.forEach((d) => {
    stats[d.id] = d.data()?.points || {};
  });
  return stats; // { playerId: { total, batting, bowling, ... } }
}

const Leaderboard = () => {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);

  // Player meta per stage: { [stageId]: { [playerId]: {name, role, team} } }
  const [playerInfoByStage, setPlayerInfoByStage] = useState({});

  // Points per player per match: { [stageId]: { [playerId]: { [matchId]: number } } }
  const [playerMatchTotals, setPlayerMatchTotals] = useState({});
  const [playerMatchStatlines, setPlayerMatchStatlines] = useState({});
// structure: { [stageId]: { [matchId]: { [playerId]: full stats doc } } }


  // Participants from user_teams: [{ uid, displayName?, email?, stagesSelections }]
  const [participants, setParticipants] = useState([]);

  // Match meta: { [stageId]: { [matchId]: { team1Name, team2Name } } }
  const [matchMeta, setMatchMeta] = useState({});

  // Per-match locked squads: { [stageId]: { [matchId]: { [uid]: string[] /*playerIds*/ } } }
  const [managerMatchSquads, setManagerMatchSquads] = useState({});

  const [expandedStages, setExpandedStages] = useState({});   // { uid: { stageId: true } }
  const [expandedMatches, setExpandedMatches] = useState({}); // { uid: { stageId: { matchId: true } } }
  const [sort, setSort] = useState({ key: "total", dir: "desc" });
  
  const [expandedPlayers, setExpandedPlayers] = useState({}); // { [stageId]: { [matchId]: { [playerId]: true } } }
  
    
  const togglePlayerDetails = (stageId, matchId, playerId) => {
    setExpandedPlayers(prev => {
      const next = structuredClone(prev); // deep clone to avoid state overwrite
      if (!next[stageId]) next[stageId] = {};
      if (!next[stageId][matchId]) next[stageId][matchId] = {};
      next[stageId][matchId][playerId] = !next[stageId][matchId][playerId];
      return next;
    });
  };
  


  // ---- toggles ----
  const toggleStageExpand = (uid, stageId) => {
    setExpandedStages(prev => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [stageId]: !prev[uid]?.[stageId] }
    }));
  };

const toggleMatchExpand = async (uid, stageId, matchId) => {
  const isOpen = expandedMatches[uid]?.[stageId]?.[matchId];

  if (!isOpen) {
    // ✅ Load match squad only when expanding
    const tourRef = doc(db, "tournaments", tournamentId);
    const squadsSnap = await getDocs(
      collection(tourRef, "stages", stageId, "matches", matchId, "11s")
    );

    setManagerMatchSquads(prev => {
      const next = { ...prev };
      if (!next[stageId]) next[stageId] = {};
      if (!next[stageId][matchId]) next[stageId][matchId] = {};

      squadsSnap.forEach(sqDoc => {
        const d = sqDoc.data() || {};
        const players = Array.isArray(d.team) ? d.team : [];
        next[stageId][matchId][sqDoc.id] = players;
      });

      return next;
    });

    // ✅ Load individual player stats (for totals)
    const stats = await loadMatchStats(tournamentId, stageId, matchId);
    setPlayerMatchTotals(prev => {
      const next = { ...prev };
      if (!next[stageId]) next[stageId] = {};
      Object.entries(stats).forEach(([pid, pts]) => {
        if (!next[stageId][pid]) next[stageId][pid] = {};
        next[stageId][pid][matchId] = pts.total ?? 0;
      });
      return next;
    });

    // ✅ NEW: Load full statline documents (for PlayerBreakdown)
    const statsSnapFull = await getDocs(
      collection(tourRef, "stages", stageId, "matches", matchId, "stats")
    );
    const statlines = {};
    statsSnapFull.forEach(d => {
      statlines[d.id] = d.data() || {};
    });

    setPlayerMatchStatlines(prev => {
      const next = { ...prev };
      if (!next[stageId]) next[stageId] = {};
      next[stageId][matchId] = statlines;
      return next;
    });
  }

  // toggle expansion state
  setExpandedMatches(prev => ({
    ...prev,
    [uid]: {
      ...(prev[uid] || {}),
      [stageId]: {
        ...(prev[uid]?.[stageId] || {}),
        [matchId]: !isOpen,
      },
    },
  }));
};


  const colCount = 2 + stages.length; // Manager + per-stage + Total

  const headerClick = (key) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  };

  // ---- load ----
  useEffect(() => {
    const load = async () => {
      try {
        // Tournament
        const tourRef = doc(db, "tournaments", tournamentId);
        const tourSnap = await getDoc(tourRef);
        if (!tourSnap.exists()) {
          alert("Tournament not found");
          navigate("/");
          return;
        }
        setTournament({ id: tourSnap.id, ...tourSnap.data() });
  
        // Stages
        const sSnap = await getDocs(query(collection(tourRef, "stages"), orderBy("order", "asc")));
        const sList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStages(sList);
  
        // Participants (from user_teams)
        const allUsersSnap = await getDocs(collection(db, "user_teams"));
        const users = [];
        allUsersSnap.forEach(uDoc => {
          const data = uDoc.data() || {};
          const tRec = data[tournamentId];
          if (!tRec?.joined) return;
          users.push({
            uid: uDoc.id,
            displayName: data.displayName || null,
            email: data.email || null,
            stagesSelections: tRec.stages || {}
          });
        });
        setParticipants(users);
  
        // ✅ OPTIMIZED: Only load minimal match data
        const infoByStage = {};
        const matchTotalsByStage = {};
        const matchMetaByStage = {};
  
		for (const s of sList) {
		  // ✅ Load all teams ONCE for this stage
		  const teamsSnap = await getDocs(collection(tourRef, "stages", s.id, "teams"));
		  const teamsById = {}; // Cache teams by ID
		  const infoMap = {};
		  
		  for (const tDoc of teamsSnap.docs) {
			const team = { id: tDoc.id, ...(tDoc.data() || {}) };
			teamsById[team.id] = team; // ✅ Store for quick lookup
			
			const playersSnap = await getDocs(collection(tourRef, "stages", s.id, "teams", team.id, "players"));
			playersSnap.forEach(p => {
			  const pd = p.data() || {};
			  infoMap[p.id] = {
				name: pd.playerName || p.id,
				role: pd.role || "",
				team: team.name || ""
			  };
			});
		  }
		  infoByStage[s.id] = infoMap;

		  // ✅ Only load match metadata + cached totals (NOT individual player stats)
		  matchTotalsByStage[s.id] = {};
		  matchMetaByStage[s.id] = {};

		  const matchesSnap = await getDocs(
			query(collection(tourRef, "stages", s.id, "matches"), orderBy("order", "asc"))
		  );
		  
		  for (const m of matchesSnap.docs) {
			const mId = m.id;
			const md = m.data() || {};

			// ✅ Lookup team names from cache (no extra DB reads!)
			const team1Name = teamsById[md.team1]?.name || md.team1 || "TBD";
			const team2Name = teamsById[md.team2]?.name || md.team2 || "TBD";
			
			matchMetaByStage[s.id][mId] = { team1Name, team2Name, scored: md.scored ?? false };

			// ✅ Only load cached totalPoints from 11s docs (skip stats entirely)
			if (md.scored) {
			  const xisSnap = await getDocs(
				collection(tourRef, "stages", s.id, "matches", mId, "11s")
			  );

			  xisSnap.forEach((xiDoc) => {
				const xi = xiDoc.data() || {};
				const uid = xiDoc.id;
				const totalPoints = Number.isFinite(xi.totalPoints) ? xi.totalPoints : 0;

				if (!matchTotalsByStage[s.id][uid]) matchTotalsByStage[s.id][uid] = {};
				matchTotalsByStage[s.id][uid][mId] = totalPoints;
			  });
			}
		  }
		}  
        setPlayerInfoByStage(infoByStage);
        setPlayerMatchTotals(matchTotalsByStage);
        setMatchMeta(matchMetaByStage);
        // ✅ squadsByStage is now loaded on-demand, so don't set it here
        setManagerMatchSquads({}); // Initialize empty
  
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId, navigate]);

  // Build leaderboard rows (stage total = sum of per-match totals using that match's locked squad)
	const rows = useMemo(() => {
	  return participants.map(u => {
		const stageTotals = {};
		let grand = 0;

		for (const s of stages) {
		  // ✅ Just sum up this user's matches directly
		  const userMatches = playerMatchTotals[s.id]?.[u.uid] || {};
		  const stageSum = Object.values(userMatches).reduce((sum, pts) => sum + pts, 0);
		  
		  stageTotals[s.id] = stageSum;
		  grand += stageSum;
		}

		return {
		  uid: u.uid,
		  label: (u.displayName || u.email || u.uid).replace(/^"|"$/g, ""),
		  perStage: stageTotals,
		  total: grand
		};
	  });
	}, [participants, stages, playerMatchTotals]);

  // Sorting
  const sortedRows = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort.key === "user") return a.label.localeCompare(b.label) * dir;
      if (sort.key === "total") return (a.total - b.total) * dir;
      if (sort.key.startsWith("stage:")) {
        const sId = sort.key.split(":")[1];
        return ((a.perStage[sId] || 0) - (b.perStage[sId] || 0)) * dir;
      }
      return 0;
    });
    return copy;
  }, [rows, sort]);

  if (loading) return <div className="p-4">Loading leaderboard…</div>;
  if (!tournament) return null;

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full overflow-y-auto" style={{ maxHeight: "90vh" }}>
        <div className="p-2 md:p-4 min-w-0">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold break-words">
              {tournament.name} — Leaderboard
            </h1>
			<button 
			  className="bg-gray-500 text-white px-3 py-1 rounded whitespace-nowrap flex-shrink-0" 
			  onClick={() => navigate("/")}
			>
			  Back to Home
			</button>
          </div>
  
          <div className="main-leaderboard-container w-full overflow-x-auto">
            <table className="main-leaderboard w-full" style={{ minWidth: "100%" }}>        <thead>
          <tr>
            <th onClick={() => headerClick("user")} style={{cursor:"pointer"}}>
              Manager {sort.key==="user" ? (sort.dir==="asc"?"▲":"▼"):""}
            </th>
            {stages.map(s => (
              <th key={s.id} onClick={() => headerClick(`stage:${s.id}`)} style={{cursor:"pointer", textAlign:"right"}}>
                {s.name} {sort.key===`stage:${s.id}` ? (sort.dir==="asc"?"▲":"▼"):""}
              </th>
            ))}
            <th onClick={() => headerClick("total")} style={{cursor:"pointer", textAlign:"right"}}>
              Total {sort.key==="total" ? (sort.dir==="asc"?"▲":"▼"):""}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map(r => (
            <React.Fragment key={r.uid}>
              <tr>
                <td>{r.label}</td>
                {stages.map(s => {
				  const val = r.perStage[s.id] || 0;

				  // ✅ Show expand button if user has any points in this stage
				  const hasAnyMatches = (playerMatchTotals[s.id]?.[r.uid] && 
										 Object.keys(playerMatchTotals[s.id][r.uid]).length > 0);

				  return (
					<td key={s.id} style={{textAlign:"right"}}>
					  {hasAnyMatches ? (
						<button
						  className="btn-secondary"
						  onClick={() => toggleStageExpand(r.uid, s.id)}
						>
						  {val} {expandedStages[r.uid]?.[s.id] ? "▲" : "▼"}
						</button>
					  ) : (val || 0)}
					</td>
				  );
				})}
                <td style={{textAlign:"right", fontWeight:"bold"}}>{r.total}</td>
              </tr>

              {/* Expanded Stage → Matches */}
              {stages.map(s => {
                const isStageOpen = expandedStages[r.uid]?.[s.id];
                if (!isStageOpen) return null;

                const matchMap = playerMatchTotals[s.id] || {};
                const userSquadsByMatch = managerMatchSquads[s.id] || {};
                const metaMap = matchMeta[s.id] || {};

                // derive matchIds present in stats
                const allMatchIds = new Set();
                Object.values(matchMap).forEach(perMatch => {
                  Object.keys(perMatch || {}).forEach(mId => allMatchIds.add(mId));
                });
				// ✅ Get match IDs from this user's match totals
				const userMatchTotals = playerMatchTotals[s.id]?.[r.uid] || {};

				// 🔹 Sort by match.order field stored in Firestore
				const orderedMatches = stages
				  .find(stage => stage.id === s.id)
				  ?.matches || [];

				const matchRows = Object.keys(userMatchTotals)
				  .filter(mId => matchMeta[s.id]?.[mId]?.scored)
				  .map(mId => {
					const matchTotal = userMatchTotals[mId] ?? 0;
					const order = orderedMatches.find(m => m.id === mId)?.order ?? 9999;
					return { id: mId, total: matchTotal, order };
				  })
				  .sort((a, b) => a.order - b.order);


                return (
                  <tr key={`${r.uid}-${s.id}-stage`}>
                    <td colSpan={colCount} className="highlight-matches">
                      <div className="p-2">
                        <div className="font-semibold mb-2">
                          Matches for <span className="underline">{s.name}</span>
                        </div>
                        <table className="match-breakdown">
                          <thead>
                            <tr>
                              <th>Match</th>
                              <th style={{textAlign:"right"}}>Match Total</th>
                              <th style={{textAlign:"center"}}>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchRows.map(m => {
                              const matchIndex = Array.from(allMatchIds).indexOf(m.id) + 1;
							  const label = metaMap[m.id]
								? `Match ${matchIndex}: ${metaMap[m.id].team1Name} vs ${metaMap[m.id].team2Name}`
								: `Match ${matchIndex}: ${m.id}`;


								// ✅ User has a locked squad if they have a match total recorded
								const hasLocked = m.total > 0 || (playerMatchTotals[s.id]?.[r.uid]?.[m.id] != null);

								return (
								  <React.Fragment key={m.id}>
									<tr>
									  <td>
										{label}
										<button
										  style={{ marginLeft: "8px" }}
										  onClick={() =>
											navigate(`/tournament/${tournamentId}/stage/${s.id}/match/${m.id}/scorecard`)
										  }
										>
										  Full Scorecard
										</button>
									  </td>
									  <td style={{textAlign:"right"}}>{m.total}</td>
                                    <td style={{textAlign:"center"}}>
                                      {hasLocked ? (
                                        <button
                                          className="btn-secondary"
                                          onClick={() => toggleMatchExpand(r.uid, s.id, m.id)}
                                        >
                                          {expandedMatches[r.uid]?.[s.id]?.[m.id] ? "Hide XI" : "Match XI"}
                                        </button>
                                      ) : (
                                        <span className="text-gray-500">No squad recorded</span>
                                      )}
                                    </td>
                                  </tr>

                                  {/* Expanded Match → Squad (locked for that match) */}
                                  {expandedMatches[r.uid]?.[s.id]?.[m.id] && hasLocked && (
                                    <tr>
                                      <td colSpan={3} style={{ background:"#f3f4f6" }}>
                                        <table className="player-details" style={{marginLeft:"1rem", maxWidth:"640px"}}>
                                          <thead>
                                            <tr>
                                              <th>Player</th>
                                              <th>Role</th>
                                              <th>Team</th>
                                              <th style={{textAlign:"right"}}>Match Points</th>
											  <th style={{ textAlign: "center" }}>Details</th>
                                            </tr>
                                          </thead>
											<tbody>
											  {(managerMatchSquads[s.id][m.id][r.uid] || [])
												// build array of objects with points
												.map(pid => {
												  const info = playerInfoByStage[s.id]?.[pid] || {};
												  const pts = playerMatchTotals[s.id]?.[pid]?.[m.id] || 0;
												  const statline = playerMatchStatlines[s.id]?.[m.id]?.[pid] || {};
												  return { pid, info, pts, statline };
												})
												// 🔹 sort by match points (highest first)
												.sort((a, b) => b.pts - a.pts)
												// render
												.map(({ pid, info, pts, statline }) => {
												  const stageScoring = stages.find(x => x.id === s.id)?.scoring || {};
												  const isOpen = !!(expandedPlayers[s.id]?.[m.id]?.[pid]);

												  return (
													<React.Fragment key={pid}>
													  <tr>
														<td>{info.name || pid}</td>
														<td>{info.role || ""}</td>
														<td>{info.team || ""}</td>
														<td style={{ textAlign: "right" }}>{pts}</td>
														<td style={{ textAlign: "center" }}>
														  <button
															className="btn-secondary"
															onClick={() => togglePlayerDetails(s.id, m.id, pid)}
														  >
															{isOpen ? "Hide" : "Details"}
														  </button>
														</td>
													  </tr>

													  {isOpen && (
														<tr>
														  <td colSpan={5} style={{ background: "#f9fafb" }}>
															<PlayerBreakdown
															  p={{ id: pid, ...statline, points: statline.points || {} }}
															  scoring={stageScoring}
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
                                              <td colSpan={3} style={{textAlign:"right", fontWeight:600}}>Match Total</td>
                                              <td style={{textAlign:"right", fontWeight:600}}>{m.total}</td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
		</tbody>
      </table>
        </div>
      </div>
    </div>
  </div>
);
};
export default Leaderboard;
