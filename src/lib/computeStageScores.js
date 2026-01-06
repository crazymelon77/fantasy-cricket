// src/lib/computeStageScores.js
import { doc, getDoc, getDocs, setDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { scorePlayer } from "./scoring";

// ----------------- Booster helpers -----------------
const getOverride = (overrides, key, fallback) => {
  if (!overrides) return fallback;
  return Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;
};

const getMetricValue = (metric, points, stats) => {
  if (!metric) return 0;
  const m = String(metric);

  // points buckets
  if (m in (points || {})) return Number(points[m] ?? 0) || 0;
  if (m === "total") return Number(points?.total ?? 0) || 0;

  // raw stats
  return Number(stats?.[m] ?? 0) || 0;
};

const evalCondition = (condition, points, stats, overrides, ruleIdx) => {
  if (!condition) return true;
  const metric = condition.metric;
  const op = condition.op || condition.operator || condition.comparator || ">=";
  const raw = getMetricValue(metric, points, stats);
  const thresh = Number(
    getOverride(overrides, `rules[${ruleIdx}].condition.value`, condition.value)
  );

  switch (op) {
    case ">":
      return raw > thresh;
    case ">=":
      return raw >= thresh;
    case "<":
      return raw < thresh;
    case "<=":
      return raw <= thresh;
    case "==":
      return raw === thresh;
    case "!=":
      return raw !== thresh;
    default:
      return raw >= thresh;
  }
};

const applyBooster = (booster, overrides, basePoints, stats) => {
  if (!booster || !booster.rules || !Array.isArray(booster.rules)) {
    return { delta: 0, applied: false };
  }

  // NOTE: boosters are per-manager, so we don't mutate stats docs.
  // We only compute an adjustment (delta) to add on top of base points.
  let delta = 0;
  let applied = false;

  const points = {
    batting: Number(basePoints?.batting ?? 0) || 0,
    bowling: Number(basePoints?.bowling ?? 0) || 0,
    fielding: Number(basePoints?.fielding ?? 0) || 0,
    general: Number(basePoints?.general ?? 0) || 0,
    total: Number(basePoints?.total ?? 0) || 0,
  };

  booster.rules.forEach((rule, ri) => {
    if (!evalCondition(rule.condition, points, stats, overrides, ri)) return;
    const effects = Array.isArray(rule.effects) ? rule.effects : [];

    effects.forEach((eff, ei) => {
      const metricKey = `rules[${ri}].effects[${ei}].metric`;
      const typeKey = `rules[${ri}].effects[${ei}].type`;
      const valKey = `rules[${ri}].effects[${ei}].value`;

      const metric = getOverride(overrides, metricKey, eff.metric);
      const type = getOverride(overrides, typeKey, eff.type);
      const value = Number(getOverride(overrides, valKey, eff.value));

      if (!metric || !(metric in points) || !Number.isFinite(value)) return;
      const before = points[metric];

      if (type === "multiplier") {
        points[metric] = before * value;
      } else if (type === "additive") {
        points[metric] = before + value;
      } else if (type === "set") {
        points[metric] = value;
      } else {
        // unknown type -> ignore
        return;
      }

      const change = points[metric] - before;
      if (change !== 0) {
        applied = true;
        delta += change;
        // keep total coherent if a booster targets a non-total bucket
        if (metric !== "total") points.total += change;
      }
    });
  });

  // Ensure whole-number points (keeps leaderboard neat)
  delta = Math.round(delta);
  return { delta, applied };
};


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
  const playerPointsBreakdownMap = {};
  const playerRawStatsMap = {};  
  statsSnapTotals.forEach((d) => {
    const data = d.data() || {};
    const pts = data?.points?.total ?? 0;
    playerPointsMapTotals[d.id] = Number.isFinite(pts) ? pts : 0;
    playerPointsBreakdownMap[d.id] =
      data?.points || {
        batting: 0,
        bowling: 0,
        fielding: 0,
        general: 0,
        total: playerPointsMapTotals[d.id],
      };
    playerRawStatsMap[d.id] = data;	
  });

  // -------------- Load boosters (if enabled on stage) --------------
  const stageData = stageSnap.data() || {};
  const boostersEnabledOnStage =
    !!stageData.enableBoosters && Array.isArray(stageData.boostersEnabled);

  let boosterById = {};
  let boosterOverridesById = {};
  if (boostersEnabledOnStage && stageData.boostersEnabled.length > 0) {
    const boostersSnap = await getDocs(collection(db, "boosters"));
    boostersSnap.forEach((b) => {
      boosterById[b.id] = { id: b.id, ...(b.data() || {}) };
    });

    const overridesSnap = await getDocs(collection(stageRef, "boosters"));
    overridesSnap.forEach((b) => {
      boosterOverridesById[b.id] = (b.data() || {}).overrides || {};
    });
  }  
  const xisColRefTotals = collection(db, "tournaments", tId, "stages", sId, "matches", mId, "11s");
  const xisSnapTotals = await getDocs(xisColRefTotals);
  
  const writesAfterTotals = [];
  xisSnapTotals.forEach((xiDoc) => {
    const xi = xiDoc.data() || {};
    const team = Array.isArray(xi.team) ? xi.team : [];

    const baseTotal = team.reduce(
      (sum, pid) => sum + (playerPointsMapTotals[pid] ?? 0),
      0
    );

    // Booster adjustments are per-manager (XI doc), so compute them here.
    let boosterDeltaTotal = 0;
    const boosterEffects = {};

    if (boostersEnabledOnStage && stageData.boostersEnabled.length > 0) {
      const assigned = xi.boosters || {};

      team.forEach((pid) => {
        const boosterId = assigned?.[pid];
        if (!boosterId || boosterId === "none") return;

        // Ignore boosters that are not enabled for this stage
        if (!stageData.boostersEnabled.includes(boosterId)) return;

        const booster = boosterById[boosterId];
        if (!booster) return;

        const overrides = boosterOverridesById[boosterId] || {};
        const basePoints =
          playerPointsBreakdownMap[pid] || {
            batting: 0,
            bowling: 0,
            fielding: 0,
            general: 0,
            total: playerPointsMapTotals[pid] ?? 0,
          };
        const rawStats = playerRawStatsMap[pid] || {};

        const { delta, applied } = applyBooster(booster, overrides, basePoints, rawStats);
        if (!applied || !delta) return;

        boosterDeltaTotal += delta;
        boosterEffects[pid] = {
          boosterId,
          boosterName: booster.name || boosterId,
          delta,
        };
      });
    }

    const newTotal = Math.round(baseTotal + boosterDeltaTotal);

    // write match total (+ booster info for UI)
    const payload = { totalPoints: newTotal };
    if (boostersEnabledOnStage && stageData.boostersEnabled.length > 0) {
      payload.boosterPoints = Math.round(boosterDeltaTotal);
      payload.boosterEffects = boosterEffects;
    }

    writesAfterTotals.push(
      setDoc(doc(xisColRefTotals, xiDoc.id), payload, { merge: true })
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
