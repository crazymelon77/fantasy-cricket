import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection, getDocs, doc, getDoc, query, orderBy
} from "firebase/firestore";

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

  // Participants from user_teams: [{ uid, displayName?, email?, stagesSelections }]
  const [participants, setParticipants] = useState([]);

  // Match meta: { [stageId]: { [matchId]: { team1Name, team2Name } } }
  const [matchMeta, setMatchMeta] = useState({});

  // Per-match locked squads: { [stageId]: { [matchId]: { [uid]: string[] /*playerIds*/ } } }
  const [managerMatchSquads, setManagerMatchSquads] = useState({});

  const [expandedStages, setExpandedStages] = useState({});   // { uid: { stageId: true } }
  const [expandedMatches, setExpandedMatches] = useState({}); // { uid: { stageId: { matchId: true } } }
  const [sort, setSort] = useState({ key: "total", dir: "desc" });

  // ---- toggles ----
  const toggleStageExpand = (uid, stageId) => {
    setExpandedStages(prev => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [stageId]: !prev[uid]?.[stageId] }
    }));
  };

  const toggleMatchExpand = (uid, stageId, matchId) => {
    setExpandedMatches(prev => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [stageId]: {
          ...(prev[uid]?.[stageId] || {}),
          [matchId]: !prev[uid]?.[stageId]?.[matchId]
        }
      }
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

        // Per-stage player info, per-player match totals, per-match squads, and match labels
        const infoByStage = {};
        const matchTotalsByStage = {};
        const squadsByStage = {};
        const matchMetaByStage = {};

        for (const s of sList) {
          // Player info
          const teamsSnap = await getDocs(collection(tourRef, "stages", s.id, "teams"));
          const infoMap = {};
          for (const tDoc of teamsSnap.docs) {
            const team = { id: tDoc.id, ...(tDoc.data() || {}) };
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

          // Matches: points + meta + per-match squads
          matchTotalsByStage[s.id] = {};
          squadsByStage[s.id] = {};
          matchMetaByStage[s.id] = {};

          const matchesSnap = await getDocs(
			  query(collection(tourRef, "stages", s.id, "matches"), orderBy("order", "asc"))
			);
          for (const m of matchesSnap.docs) {
            const mId = m.id;
            const md = m.data() || {};

            // Team names for label
            let team1Name = "TBD", team2Name = "TBD";
            if (md.team1 && md.team1 !== "TBD") {
              const t1Snap = await getDoc(doc(tourRef, "stages", s.id, "teams", md.team1));
              team1Name = t1Snap.exists() ? (t1Snap.data().name || "TBD") : "TBD";
            }
            if (md.team2 && md.team2 !== "TBD") {
              const t2Snap = await getDoc(doc(tourRef, "stages", s.id, "teams", md.team2));
              team2Name = t2Snap.exists() ? (t2Snap.data().name || "TBD") : "TBD";
            }
            matchMetaByStage[s.id][mId] = { team1Name, team2Name };

            // Stats → per-player points for this match
            const statsSnap = await getDocs(collection(tourRef, "stages", s.id, "matches", mId, "stats"));
            statsSnap.forEach(st => {
              const pid = st.id;
              const pts = (st.data()?.points?.total) ?? 0;
              if (!matchTotalsByStage[s.id][pid]) matchTotalsByStage[s.id][pid] = {};
              matchTotalsByStage[s.id][pid][mId] = pts;
            });

            // Locked squads for this match (per user)
            squadsByStage[s.id][mId] = {};
            const squadsSnap = await getDocs(collection(tourRef, "stages", s.id, "matches", mId, "11s"));
            squadsSnap.forEach(sqDoc => {
              const d = sqDoc.data() || {};
              const players = Array.isArray(d.team) ? d.team : [];
              squadsByStage[s.id][mId][sqDoc.id] = players; // key is uid
            });
          }
        }

        setPlayerInfoByStage(infoByStage);
        setPlayerMatchTotals(matchTotalsByStage);
        setManagerMatchSquads(squadsByStage);
        setMatchMeta(matchMetaByStage);

      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId, navigate, db]);

  // Build leaderboard rows (stage total = sum of per-match totals using that match's locked squad)
  const rows = useMemo(() => {
    return participants.map(u => {
      const stageTotals = {};
      let grand = 0;

      for (const s of stages) {
        const matchMap = playerMatchTotals[s.id] || {};
        const userSquadsByMatch = managerMatchSquads[s.id] || {};

        // Enumerate matches we know about (from matchMap keys)
        const allMatchIds = new Set();
        Object.values(matchMap).forEach(perMatch => {
          Object.keys(perMatch || {}).forEach(mId => allMatchIds.add(mId));
        });

        let stageSum = 0;
        for (const mId of allMatchIds) {
          const locked = userSquadsByMatch[mId]?.[u.uid] || []; // array of playerIds locked for this match
          if (locked.length === 0) continue; // no recorded squad for this user+match

          let matchTotal = 0;
          for (const pid of locked) {
            matchTotal += matchMap[pid]?.[mId] || 0;
          }
          stageSum += matchTotal;
        }

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
  }, [participants, stages, playerMatchTotals, managerMatchSquads]);

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
    <div className="p-4 overflow-x-auto overflow-y-auto" style={{ maxHeight: "90vh" }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{tournament.name} — Leaderboard</h1>
        <div className="flex gap-2">
          <button className="bg-gray-500 text-white px-3 py-1 rounded" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>

      <table className="score-table">
        <thead>
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

                  // consider "has any recorded squad in any match" to allow expansion
                  const userSquadsByMatch = managerMatchSquads[s.id] || {};
                  const anyRecorded = Object.values(userSquadsByMatch).some(byUser => Array.isArray(byUser?.[r.uid]) && byUser[r.uid].length > 0);

                  return (
                    <td key={s.id} style={{textAlign:"right"}}>
                      {anyRecorded ? (
                        <button
                          className="text-blue-600 underline"
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
                const matchRows = Array.from(allMatchIds).map(mId => {
                  const locked = userSquadsByMatch[mId]?.[r.uid] || [];
                  let matchTotal = 0;
                  for (const pid of locked) matchTotal += matchMap[pid]?.[mId] || 0;
                  return { id: mId, total: matchTotal };
                }).sort((a,b)=> a.id.localeCompare(b.id));

                return (
                  <tr key={`${r.uid}-${s.id}-stage`}>
                    <td colSpan={colCount} style={{ background:"#f9fafb" }}>
                      <div className="p-2">
                        <div className="font-semibold mb-2">
                          Matches for <span className="underline">{s.name}</span>
                        </div>
                        <table className="score-table text-sm">
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


                              const hasLocked = Array.isArray((managerMatchSquads[s.id]?.[m.id] || {})[r.uid]) &&
                                                (managerMatchSquads[s.id][m.id][r.uid].length > 0);

                              return (
                                <React.Fragment key={m.id}>
                                  <tr>
                                    <td>{label}</td>
                                    <td style={{textAlign:"right"}}>{hasLocked ? m.total : "-"}</td>
                                    <td style={{textAlign:"center"}}>
                                      {hasLocked ? (
                                        <button
                                          className="text-blue-600 underline"
                                          onClick={() => toggleMatchExpand(r.uid, s.id, m.id)}
                                        >
                                          {expandedMatches[r.uid]?.[s.id]?.[m.id] ? "Hide" : "Details"}
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
                                        <table className="score-table text-xs" style={{marginLeft:"1rem", maxWidth:"640px"}}>
                                          <thead>
                                            <tr>
                                              <th>Player</th>
                                              <th>Role</th>
                                              <th>Team</th>
                                              <th style={{textAlign:"right"}}>Match Points</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(managerMatchSquads[s.id][m.id][r.uid] || []).map(pid => {
                                              const info = playerInfoByStage[s.id]?.[pid] || {};
                                              const pts = playerMatchTotals[s.id]?.[pid]?.[m.id] || 0;
                                              return (
                                                <tr key={pid}>
                                                  <td>{info.name || pid}</td>
                                                  <td>{info.role || ""}</td>
                                                  <td>{info.team || ""}</td>
                                                  <td style={{textAlign:"right"}}>{pts}</td>
                                                </tr>
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
  );
};

export default Leaderboard;
