import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";

const MigratePlayers = () => {
  const [status, setStatus] = useState("Starting migration...");

  useEffect(() => {
    const migrate = async () => {
      try {
        const tournamentsSnap = await getDocs(collection(db, "tournaments"));

        for (const tDoc of tournamentsSnap.docs) {
          const tournament = tDoc.data();
          setStatus(`Migrating tournament: ${tournament.name}`);

          for (let sIdx = 0; sIdx < (tournament.stages || []).length; sIdx++) {
            const stage = tournament.stages[sIdx];
            if (!stage.teams) continue;

            for (let tIdx = 0; tIdx < stage.teams.length; tIdx++) {
              const team = stage.teams[tIdx];
              if (!team.players || team.players.length === 0) continue;

              setStatus(
                `Migrating team ${team.name} (Stage ${sIdx + 1}) in ${tournament.name}`
              );

              for (const player of team.players) {
                const playersRef = collection(
                  db,
                  "tournaments",
                  tDoc.id,
                  "stages",
                  String(sIdx),
                  "teams",
                  String(tIdx),
                  "players"
                );
                await addDoc(playersRef, {
                  playerName: player.playerName,
                  role: player.role,
                  value: player.value,
                });
              }

              // clear old array
              tournament.stages[sIdx].teams[tIdx].players = [];
            }
          }

          // update tournament without players arrays
          await updateDoc(doc(db, "tournaments", tDoc.id), {
            stages: tournament.stages,
          });
        }

        setStatus("✅ Migration complete!");
      } catch (err) {
        console.error("Migration error:", err);
        setStatus("❌ Migration failed. Check console.");
      }
    };

    migrate();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Player Migration</h1>
      <p>{status}</p>
    </div>
  );
};

export default MigratePlayers;
