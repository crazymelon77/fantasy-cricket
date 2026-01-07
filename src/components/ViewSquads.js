// src/components/ViewSquads.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { sortByRole } from "../lib/sortByRole";

const ViewSquads = () => {
  const { id } = useParams(); // tournament id
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);
  const [allBoosters, setAllBoosters] = useState([]);
  // playersByStage: { [stageId]: { [playerId]: { id, playerName, role, team } } }
  const [playersByStage, setPlayersByStage] = useState({});
  // participants: [{ uid, label, squadsByStage }]
  const [participants, setParticipants] = useState([]);
  const [expandedManagers, setExpandedManagers] = useState({}); // { [uid]: true/false }
  const [expandedStages, setExpandedStages] = useState({}); 
  // structure: { [managerUid]: { [stageId]: true/false } }

  const resolveBoosterName = (boosterId) => {
    if (!boosterId || boosterId === "none") return "—";
    return allBoosters.find((b) => b.id === boosterId)?.name || boosterId;
  };

  const resolvePlayer = (stageId, playerId) =>
    playersByStage[stageId]?.[playerId];

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // 🔹 Tournament
        const tourRef = doc(db, "tournaments", id);
        const tourSnap = await getDoc(tourRef);
        if (!tourSnap.exists()) {
          alert("Tournament not found");
          navigate("/");
          return;
        }
        setTournament({ id: tourSnap.id, ...tourSnap.data() });

        // 🔹 Stages (ordered)
        const stageSnap = await getDocs(
          query(collection(tourRef, "stages"), orderBy("order", "asc"))
        );
        const stageList = stageSnap.docs.map((s) => ({
          id: s.id,
          ...s.data(),
        }));
        setStages(stageList);

        // 🔹 Boosters (global list)
        const boostersSnap = await getDocs(collection(db, "boosters"));
        const boostersList = boostersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllBoosters(boostersList);

        // 🔹 Players per stage
        const infoByStage = {};
        for (const stage of stageList) {
          const teamSnap = await getDocs(
            collection(tourRef, "stages", stage.id, "teams")
          );
          const stagePlayers = {};

          for (const tDoc of teamSnap.docs) {
            const teamData = tDoc.data() || {};
            const teamName = teamData.name || "";

            const playersSnap = await getDocs(
              collection(
                tourRef,
                "stages",
                stage.id,
                "teams",
                tDoc.id,
                "players"
              )
            );

            playersSnap.forEach((pDoc) => {
              const d = pDoc.data() || {};
              stagePlayers[pDoc.id] = {
                id: pDoc.id,
                playerName: d.playerName || pDoc.id,
                role: d.role || "",
                team: teamName,
              };
            });
          }

          infoByStage[stage.id] = stagePlayers;
        }
        setPlayersByStage(infoByStage);

        // 🔹 Managers / squads from user_teams
        const usersSnap = await getDocs(collection(db, "user_teams"));
        const managers = [];

        usersSnap.forEach((uDoc) => {
          const data = uDoc.data() || {};
          const rec = data[id];
          if (!rec?.joined) return;

          const label = (data.displayName || data.email || uDoc.id).replace(
            /^"|"$/g,
            ""
          );

          managers.push({
            uid: uDoc.id,
            label,
            squadsByStage: rec.stages || {}, // { [stageId]: [{ playerId, teamId }] }
          });
        });

        setParticipants(managers);
      } catch (err) {
        console.error("Error loading squads:", err);
        alert("Failed to load squads.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  const toggleManager = (uid) => {
    setExpandedManagers((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };
  
  const toggleStage = (uid, stageId) => {
    setExpandedStages(prev => {
      const current = prev[uid] || {};
      return {
        ...prev,
        [uid]: {
          ...current,
          [stageId]: !current[stageId],
        },
      };
    });
  };

  if (loading) return <div className="p-4">Loading squads…</div>;
  if (!tournament) return null;

  return (
  <div className="w-full overflow-x-auto">
    <div className="w-full overflow-y-auto" style={{ maxHeight: "90vh" }}>
      <div className="p-2 md:p-4 min-w-0">
		  {/* Header + nav buttons */}
		  <div className="flex justify-between items-center mb-4">
			<h1 className="text-2xl font-bold">
			  {tournament.name} — Squads
			</h1>
			<div className="flex gap-2 flex-wrap">
			  <button
				onClick={() => navigate(`/tournament/${id}`)}
				className="btn-add"
			  >
				View/Update Team
			  </button>
			  <button
				onClick={() => navigate(`/tournament/${id}/leaderboard`)}
				className="bg-gray-700 text-white px-4 py-2 rounded"
			  >
				Leaderboard
			  </button>
			  <button
				onClick={() => navigate("/")}
				className="bg-gray-500 text-white px-4 py-2 rounded"
			  >
				Back to Home
			  </button>
			</div>
		  </div>

		  {/* Managers table */}
		  <table className="score-table text-sm mt-2 w-full min-w-max">
			<thead className="bg-gray-100">
			  <tr>
				<th className="border px-2 py-1 text-left">Manager</th>
				<th className="border px-2 py-1 text-left">Team</th>
			  </tr>
			</thead>
			<tbody>
			  {participants.map((mgr) => (
				<React.Fragment key={mgr.uid}>
				  <tr>
					<td className="border px-2 py-1 align-top">
					  {mgr.label}
					</td>
					<td className="border px-2 py-1 align-top">
					  <button
						className="btn-secondary"
						onClick={() => toggleManager(mgr.uid)}
					  >
						{expandedManagers[mgr.uid]
						  ? "Hide Squad"
						  : "Current Squad"}
					  </button>
					</td>
				  </tr>

				  {expandedManagers[mgr.uid] && (
					<tr>
					  <td
						colSpan={2}
						className="border px-2 py-2 bg-gray-50"
					  >
						{stages.map((stage) => {
						  const stageSquad = mgr.squadsByStage?.[stage.id] || [];
						  const open = expandedStages[mgr.uid]?.[stage.id];
						  const showBoosterColumn = stage?.enableBoosters === true;

						  return (
							  <div
							    key={stage.id}
							    className={`mb-3 border border-gray-300 rounded p-2 w-full max-w-3xl mx-auto ${
							  	open ? "bg-blue-100" : "bg-white"
							    }`}
							    style={open ? { backgroundColor: "#fafafa" } : {}}
							  >

							  {/* Stage header */}
							  <div
							    className="flex flex-row items-center justify-between mb-1 w-full rounded px-2 py-1"
							    style={{
							  	whiteSpace: "nowrap",
							  	backgroundColor: "#dbeafe"   // same shade used in PlayerBreakdown
							    }}
							  >
							    <span className="font-semibold"><b>{stage.name}</b></span>
							  
							    <button
							  	className="btn-secondary"
							  	onClick={() => toggleStage(mgr.uid, stage.id)}
							  	style={{ marginLeft: "8px" }}
							    >
							  	{open ? "Collapse ▲" : "Expand ▼"}
							    </button>
							  </div>


							  {/* Stage squad table */}
							  {open && (
								stageSquad.length === 0 ? (
								  <div className="text-sm text-gray-600">
									No squad saved for this stage.
								  </div>
								) : (
								  <div className="w-full overflow-x-auto">
									<table className="score-table text-sm border border-gray-300 rounded w-full mt-2">
									  <thead className="bg-gray-100">
										<tr>
										  <th className="border px-2 py-1 text-left">Player</th>
										  <th className="border px-2 py-1 text-right">Role</th>
										  <th className="border px-2 py-1 text-right">Team</th>
                                          {showBoosterColumn && (
                                            <th className="border px-2 py-1 text-left">Booster</th>
                                          )}										  
										</tr>
									  </thead>

									  <tbody>
										{sortByRole(
										  stageSquad,
										  (playerId) => resolvePlayer(stage.id, playerId)
										).map((sel) => {
										  const p = resolvePlayer(stage.id, sel.playerId);
										  if (!p) return null;
										  
										  const boosterId = sel?.boosterId ?? "none";

										  return (
											<tr key={sel.playerId}>
											  <td className="border px-2 py-1">{p.playerName}</td>
											  <td className="border px-2 py-1 text-right">{p.role}</td>
											  <td className="border px-2 py-1 text-right">{p.team}</td>
                                              {showBoosterColumn && (
                                                <td className="border px-2 py-1">
                                                  {resolveBoosterName(boosterId)}
                                                </td>
                                              )}											  
											</tr>
										  );
										})}
									  </tbody>
									</table>
								  </div>
								)
							  )}
							</div>
						  );
						})}
					  </td>
					</tr>
				  )}
				</React.Fragment>
			  ))}
			</tbody>
		  </table>
		</div>
	  </div>
	</div>
  );
};

export default ViewSquads;
