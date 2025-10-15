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
    const sCompat = { ...s, runsConceded: s.runsConceded ?? s.runsGiven ?? 0 };

    const points = scorePlayer(scoring, sCompat, {
      played: !!s.played,
      won: !!s.won,
    });

    if (s.notOuts) {
      points.batting += (scoring.batting?.notOutBonus || 0) * s.notOuts;
      points.total += (scoring.batting?.notOutBonus || 0) * s.notOuts;
    }
    if (s.mom) {
      points.general += scoring.general?.manOfTheMatch || 0;
      points.total += scoring.general?.manOfTheMatch || 0;
    }
    if (s.awayTeam) {
      points.general += scoring.general?.awayTeamBonus || 0;
      points.total += scoring.general?.awayTeamBonus || 0;
    }
    if (s.maidenOvers) {
      points.bowling += (scoring.bowling?.perMaidenOver || 0) * s.maidenOvers;
      points.total += (scoring.bowling?.perMaidenOver || 0) * s.maidenOvers;
    }

    writes.push(
      setDoc(
        doc(statsCol, pid),
        {
          points,
          computedAt: Date.now(),
        },
        { merge: true }
      )
    );
  });

  await Promise.all(writes);
  
  
  // 🔽 build a { playerId -> totalPoints } map from freshly written stats
  // 🔽 totals writeback (unique names to avoid collisions)
  const matchRefTotals = doc(db, "tournaments", tId, "stages", sId, "matches", mId);
  const statsColRefTotals = collection(matchRefTotals, "stats");
  const statsSnapTotals = await getDocs(statsColRefTotals);
  
  const playerPointsMapTotals = {};
  statsSnapTotals.forEach((d) => {
    const pts = d.data()?.points?.total ?? 0;
    playerPointsMapTotals[d.id] = Number.isFinite(pts) ? pts : 0;
  });
  
  const xisColRefTotals = collection(db, "tournaments", tId, "stages", sId, "matches", mId, "11s");
  const xisSnapTotals = await getDocs(xisColRefTotals);
  
  const writesAfterTotals = [];
  xisSnapTotals.forEach((xiDoc) => {
    const xi = xiDoc.data() || {};
    const team = Array.isArray(xi.team) ? xi.team : [];
  
    const newTotal = team.reduce((sum, pid) => sum + (playerPointsMapTotals[pid] ?? 0), 0);
  
    // write match total
    writesAfterTotals.push(
      setDoc(doc(xisColRefTotals, xiDoc.id), { totalPoints: newTotal }, { merge: true })
    );
  });
  await Promise.all(writesAfterTotals);
  
  console.log(`✅ Computed player points for stage ${sId}, match ${mId}`);
  // 🔹 Mark match as scored
  await setDoc(
    doc(db, "tournaments", tId, "stages", sId, "matches", mId),
    { scored: true },
    { merge: true }
  );
  console.log(`🏁 Match ${mId} marked as scored`);
}
