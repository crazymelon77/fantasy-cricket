import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import PlayerBreakdown from "./PlayerBreakdown";


const MatchDetails = () => {
  const { tId, sId, mId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [playerMeta, setPlayerMeta] = React.useState({}); // { [playerId]: { name, team } }
  const [sortConfig, setSortConfig] = React.useState({
    field: "total",
    dir: "desc",
  });
  const [expandedPlayer, setExpandedPlayer] = React.useState(null);
  const [scoring, setScoring] = React.useState({});



  React.useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const matchRef = doc(db, "tournaments", tId, "stages", sId, "matches", mId);

        // 1) Build player meta (name + team) for this stage
        const stageRef = doc(db, "tournaments", tId, "stages", sId);
		
		const stageSnap = await getDoc(stageRef);
		
		if (stageSnap.exists()) {
		  setScoring(stageSnap.data().scoring || {});
		}		
        const teamsSnap = await getDocs(collection(stageRef, "teams"));
        const meta = {};

        for (const tdoc of teamsSnap.docs) {
          const teamName = (tdoc.data() || {}).name || "TBD";
          const playersSnap = await getDocs(
            collection(stageRef, "teams", tdoc.id, "players")
          );
          playersSnap.forEach((p) => {
            const d = p.data() || {};
            meta[p.id] = { name: d.playerName || p.id, team: teamName };
          });
        }
        setPlayerMeta(meta);

        // 2) Read stats for the match
        const statsSnap = await getDocs(collection(matchRef, "stats"));
        const results = [];

        for (const d of statsSnap.docs) {
          const row = d.data() || {};
		  
		  //skip players who did not play this match
		  if (!row.played) continue;
		  
          const metaRec = meta[d.id] || {};
          results.push({
            id: d.id,
            name: metaRec.name || row.playerName || d.id,
            team: metaRec.team || row.team || "TBD",
            points: row.points || {},
            ...row,
          });
        }

        setPlayers(results);
		
		
      } catch (e) {
        console.error("Error loading match stats", e);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [tId, sId, mId]);
  
  const handleSort = (field) => {
    setSortConfig((prev) => {
      const newDir =
        prev.field === field && prev.dir === "asc" ? "desc" : "asc";
      return { field, dir: newDir };
    });
  };
  
  // Sort players before rendering
  const sortedPlayers = React.useMemo(() => {
    const copy = [...players];
    const { field, dir } = sortConfig;
    const sign = dir === "asc" ? 1 : -1;
  
    copy.sort((a, b) => {
      const pa = a.points || {};
      const pb = b.points || {};
  
      const getValue = (p, f) =>
        f === "name"
          ? p.name.toLowerCase()
          : f === "team"
          ? p.team.toLowerCase()
          : pa[f] ?? 0;
  
      const va =
        field === "total"
          ? pa.total ?? 0
          : field === "name" || field === "team"
          ? a[field]
          : pa[field] ?? 0;
      const vb =
        field === "total"
          ? pb.total ?? 0
          : field === "name" || field === "team"
          ? b[field]
          : pb[field] ?? 0;
  
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb) * sign;
      return (va - vb) * sign;
    });
    return copy;
  }, [players, sortConfig]);
  
  const toggleDetails = (playerId) => {
    setExpandedPlayer((prev) => (prev === playerId ? null : playerId));
  };
  
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Match Scorecard</h2>
	  <div className="mb-4">
        <button onClick={() => navigate(-1)}>
          Back
        </button>
	  </div>

      {loading ? (
        <p>Loading match details...</p>
      ) : (
        <div
          className="p-3 overflow-x-auto"
          style={{ maxHeight: "85vh", width: "100%" }}
        >
          <table className="score-table mt-3 w-full" style={{ minWidth: "100%" }}>
            <thead>
			  <tr>
				<th
				  className="cursor-pointer"
				  onClick={() => handleSort("name")}
				>
				  Player {sortConfig.field === "name" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th
				  className="cursor-pointer"
				  onClick={() => handleSort("team")}
				>
				  Team {sortConfig.field === "team" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th
				  style={{ textAlign: "right", cursor: "pointer" }}
				  onClick={() => handleSort("batting")}
				>
				  Batting {sortConfig.field === "batting" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th
				  style={{ textAlign: "right", cursor: "pointer" }}
				  onClick={() => handleSort("bowling")}
				>
				  Bowling {sortConfig.field === "bowling" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th
				  style={{ textAlign: "right", cursor: "pointer" }}
				  onClick={() => handleSort("fielding")}
				>
				  Fielding {sortConfig.field === "fielding" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th
				  style={{ textAlign: "right", cursor: "pointer" }}
				  onClick={() => handleSort("general")}
				>
				  General {sortConfig.field === "general" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th
				  style={{ textAlign: "right", cursor: "pointer" }}
				  onClick={() => handleSort("total")}
				>
				  Total {sortConfig.field === "total" && (sortConfig.dir === "asc" ? "▲" : "▼")}
				</th>
				<th style={{ textAlign: "center" }}>Details</th>
			  </tr>
			</thead>

            <tbody>
              {sortedPlayers.map((p) => {
                const pts = p.points || {};
                return (
				  <React.Fragment key={p.id}>
                  <tr>
                    <td>{p.name}</td>
                    <td>{p.team}</td>
                    <td style={{ textAlign: "right" }}>{pts.batting ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{pts.bowling ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{pts.fielding ?? 0}</td>
                    <td style={{ textAlign: "right" }}>{pts.general ?? 0}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {pts.total ?? 0}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button className="btn-secondary" onClick={() => toggleDetails(p.id)}>
					    {expandedPlayer === p.id ? "Hide" : "Details"}
					  </button>
                    </td>
                  </tr>
				  
				  {expandedPlayer === p.id && (
				  <tr>
				   	<td colSpan="8" style={{ background: "#f9fafb" }}>
				   	  <div className="p-2">
					    <PlayerBreakdown p={p} scoring={scoring} />
				   	  </div>
				   	</td>
				     </tr>
				   )}
				   </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MatchDetails;
