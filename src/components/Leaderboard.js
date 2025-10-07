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
  const [playerInfoByStage, setPlayerInfoByStage] = useState({});  // {stageId: {playerId: {name, role, team}}}
  const [playerStageTotals, setPlayerStageTotals] = useState({});  // {stageId: {playerId: number}}
  const [participants, setParticipants] = useState([]);            // [{ uid, displayName?, email?, stagesSelections }]
  const [expanded, setExpanded] = useState({});                    // { [uid]: { [stageId]: true } }
  const [sort, setSort] = useState({ key: "total", dir: "desc" });

  // ---- helpers ----
  const toggleExpand = (uid, stageId) => {
    setExpanded(prev => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [stageId]: !prev[uid]?.[stageId] }
    }));
  };

  const colCount = 2 + stages.length; // User + Total + per-stage

  const headerClick = (key) => {
    setSort(prev => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "desc" };
    });
  };

  // ---- load everything ----
  useEffect(() => {
    const load = async () => {
      try {
        // tournament
        const tourRef = doc(db, "tournaments", tournamentId);
        const tourSnap = await getDoc(tourRef);
        if (!tourSnap.exists()) {
          alert("Tournament not found");
          navigate("/");
          return;
        }
        setTournament({ id: tourSnap.id, ...tourSnap.data() });

        // stages
        const sSnap = await getDocs(query(collection(tourRef, "stages"), orderBy("order", "asc")));
        const sList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStages(sList);

        // build player info per stage (names, roles, team)
        const infoByStage = {};
        for (const s of sList) {
          const teamsSnap = await getDocs(collection(tourRef, "stages", s.id, "teams"));
          const byId = {};
          for (const tDoc of teamsSnap.docs) {
            const team = { id: tDoc.id, ...(tDoc.data() || {}) };
            const playersSnap = await getDocs(collection(tourRef, "stages", s.id, "teams", team.id, "players"));
            playersSnap.forEach(p => {
              const pd = p.data() || {};
              byId[p.id] = {
                name: pd.playerName || p.id,
                role: pd.role || "",
                team: team.name || ""
              };
            });
          }
          infoByStage[s.id] = byId;
        }
        setPlayerInfoByStage(infoByStage);

        // pre-aggregate per-player totals for each stage
        const totals = {};
        for (const s of sList) {
          totals[s.id] = {};
          const matchesSnap = await getDocs(collection(tourRef, "stages", s.id, "matches"));
          for (const m of matchesSnap.docs) {
            const statsSnap = await getDocs(collection(tourRef, "stages", s.id, "matches", m.id, "stats"));
            statsSnap.forEach(st => {
              const pid = st.id;
              const pts = (st.data()?.points?.total) ?? 0;
              totals[s.id][pid] = (totals[s.id][pid] || 0) + pts;
            });
          }
        }
        setPlayerStageTotals(totals);

        // participants: read all user_teams (simple, small scale)
        const allUsersSnap = await getDocs(collection(db, "user_teams"));
        const users = [];
        allUsersSnap.forEach(uDoc => {
          const data = uDoc.data() || {};
          const tRec = data[tournamentId];
          if (!tRec?.joined) return;
          users.push({
            uid: uDoc.id,
            // if you later add a profiles collection, hydrate these:
            displayName: data.displayName || null,
            email: data.email || null,
            stagesSelections: tRec.stages || {} // { [stageId]: [{playerId, teamId}] }
          });
        });
        setParticipants(users);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId, navigate]);

  // build leaderboard rows
  const rows = useMemo(() => {
    return participants.map(u => {
      const stageTotals = {};
      let grand = 0;
      for (const s of stages) {
        const picks = u.stagesSelections[s.id] || [];
        const perPlayerTotals = playerStageTotals[s.id] || {};
        const sum = picks.reduce((acc, sel) => acc + (perPlayerTotals[sel.playerId] || 0), 0);
        stageTotals[s.id] = sum;
        grand += sum;
      }
      return {
        uid: u.uid,
        label: (u.displayName || u.email || u.uid).replace(/^"|"$/g, ""),
        perStage: stageTotals,
        total: grand
      };
    });
  }, [participants, stages, playerStageTotals]);

  // sort rows
  const sortedRows = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort.key === "user") {
        return a.label.localeCompare(b.label) * dir;
      } else if (sort.key === "total") {
        return (a.total - b.total) * dir;
      } else if (sort.key.startsWith("stage:")) {
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
                  const hasTeam = !!(participants.find(p=>p.uid===r.uid)?.stagesSelections?.[s.id]?.length);
                  return (
                    <td key={s.id} style={{textAlign:"right"}}>
                      {hasTeam ? (
                        <button
                          className="text-blue-600 underline"
                          onClick={() => toggleExpand(r.uid, s.id)}
                          title="Show squad for this stage"
                        >
                          {val} {expanded[r.uid]?.[s.id] ? "▲" : "▼"}
                        </button>
                      ) : "-"}
                    </td>
                  );
                })}
                <td style={{textAlign:"right", fontWeight:"bold"}}>{r.total}</td>
              </tr>

              {/* Expanded squads per-stage */}
              {stages.map(s => {
                const isOpen = expanded[r.uid]?.[s.id];
                if (!isOpen) return null;

                const u = participants.find(p => p.uid === r.uid);
                const picks = u?.stagesSelections?.[s.id] || [];
                const infoMap = playerInfoByStage[s.id] || {};
                const perPlayerTotals = playerStageTotals[s.id] || {};

                // Build rows: player name, role, team, stage total
                const squadRows = picks.map(sel => {
                  const info = infoMap[sel.playerId] || { name: sel.playerId, role: "", team: "" };
                  const pTotal = perPlayerTotals[sel.playerId] || 0;
                  return { id: sel.playerId, ...info, points: pTotal };
                }).sort((a,b)=> b.points - a.points);

                const sum = squadRows.reduce((acc, x)=>acc+x.points, 0);

                return (
                  <tr key={`${r.uid}-${s.id}-exp`}>
                    <td colSpan={colCount} style={{ background:"#f9fafb" }}>
                      <div className="p-2">
                        <div className="font-semibold mb-1">
                          Squad for <span className="underline">{s.name}</span> (Stage Total: {sum})
                        </div>
						{r.uid === auth.currentUser?.uid && (
							<button
							  onClick={() => navigate(`/tournament/${tournamentId}?stage=${s.id}`)}
							  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
							>
							  Modify Squad
							</button>
						 )}
                        {squadRows.length === 0 ? (
                          <div className="text-sm text-gray-600">No players selected for this stage.</div>
                        ) : (
                          <table className="score-table" style={{maxWidth: "640px"}}>
                            <thead>
                              <tr>
                                <th>Player</th>
                                <th>Role</th>
                                <th>Team</th>
                                <th style={{textAlign:"right"}}>Stage Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {squadRows.map(p => (
                                <tr key={p.id}>
                                  <td>{p.name}</td>
                                  <td>{p.role}</td>
                                  <td>{p.team}</td>
                                  <td style={{textAlign:"right"}}>{p.points}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={3} style={{textAlign:"right", fontWeight:600}}>Stage Total</td>
                                <td style={{textAlign:"right", fontWeight:600}}>{sum}</td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
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
