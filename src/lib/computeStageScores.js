// src/lib/computeStageScores.js
import { doc, getDoc, getDocs, setDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { scorePlayer } from "./scoring";

export async function computeStageScores(tId, sId, mId) {
  // 1) Load stage scoring
  const stageRef = doc(db, "tournaments", tId, "stages", sId);
  const stageSnap = await getDoc(stageRef);
  if (!stageSnap.exists()) {
    console.error("Stage not found", { tId, sId });
    return;
  }
  const scoring = stageSnap.data().scoring || {};

  // 2) Load all player stats for this match
  const statsCol = collection(stageRef, "matches", mId, "stats");
  const statsSnap = await getDocs(statsCol);

  // 3) Compute + persist points on each player's stats doc
  const writes = [];
  statsSnap.forEach((d) => {
    const pid = d.id;
    const s = d.data() || {};

    // compat for scorers that read runsConceded
    const sCompat = { ...s, runsConceded: s.runsConceded ?? s.runsGiven ?? 0 };

    // base points from your scorer
    let points = scorePlayer(scoring, sCompat, {
      played: !!s.played,
      won: !!s.won,
    });

    // new tweaks
    points += (scoring.batting?.notOutBonus || 0) * (s.notOuts || 0);
    if (s.mom) points += scoring.general?.manOfTheMatch || 0;
    if (s.awayTeam) points += scoring.general?.awayTeamBonus || 0;
	
	points += (scoring.bowling?.perMaidenOver || 0) * (s.maidenOvers || 0);

    writes.push(
      setDoc(
        doc(statsCol, pid),
        { points, computedAt: Date.now() }, // 👈 saved alongside raw stats
        { merge: true }
      )
    );
  });

  await Promise.all(writes);
}
