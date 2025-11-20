import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIs9DfwUvB9lNXt6tCg0hfkjrDA7-UMLs",
  authDomain: "fcric-d32e9.firebaseapp.com",
  projectId: "fcric-d32e9",
  storageBucket: "fcric-d32e9.firebasestorage.app",
  messagingSenderId: "598708395031",
  appId: "1:598708395031:web:8c095c8dea302c5e5c5052",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const boosters = {
  captain: {
    name: "Captain",
    description: "2x all points",
    rules: [
      { condition: { stat: "always", op: "true" },
        effects: [{ metric: "total", type: "multiplier", value: 2 }] },
    ],
  },
  wicketkeeper: {
    name: "Wicketkeeper",
    description: "2x fielding points",
    rules: [
      { condition: { stat: "always", op: "true" },
        effects: [{ metric: "fielding", type: "multiplier", value: 2 }] },
    ],
  },
  powerHitter: {
    name: "Power Hitter",
    description: "2x 4s and 6s; if none, -1 per ball faced",
    rules: [
      { condition: { stat: "sixesPlusFours", op: ">", value: 0 },
        effects: [
          { metric: "fours", type: "multiplier", value: 2 },
          { metric: "sixes", type: "multiplier", value: 2 },
        ] },
      { condition: { stat: "sixesPlusFours", op: "==", value: 0 },
        effects: [{ metric: "ballsFaced", type: "offset", value: -1 }] },
    ],
  },
  anchor: {
    name: "Anchor",
    description: "+1 per ball faced and 2x milestones; if none, -1 per ball faced",
    rules: [
      { condition: { stat: "milestones", op: ">", value: 0 },
        effects: [
          { metric: "ballsFaced", type: "offset", value: 1 },
          { metric: "milestones", type: "multiplier", value: 2 },
        ] },
      { condition: { stat: "milestones", op: "==", value: 0 },
        effects: [{ metric: "ballsFaced", type: "offset", value: -1 }] },
    ],
  },
  busyRunner: {
    name: "Busy Runner",
    description: "2x runs excluding 4s and 6s",
    rules: [
      { condition: { stat: "runsWithoutBoundaries", op: ">", value: 0 },
        effects: [{ metric: "runs", type: "multiplier", value: 2 }] },
    ],
  },
  strikeBowler: {
    name: "Strike Bowler",
    description: "0 for runs conceded/wides/noballs if ≥3 wickets; else 2x per-run penalty",
    rules: [
      { condition: { stat: "wickets", op: ">=", value: 3 },
        effects: [
          { metric: "runsConceded", type: "multiplier", value: 0 },
          { metric: "wides", type: "multiplier", value: 0 },
          { metric: "noBalls", type: "multiplier", value: 0 },
        ] },
      { condition: { stat: "wickets", op: "<", value: 3 },
        effects: [{ metric: "runsConceded", type: "multiplier", value: 2 }] },
    ],
  },
  goldenArm: {
    name: "Golden Arm",
    description: "2x wickets; if 0 wickets, 2x runs conceded",
    rules: [
      { condition: { stat: "wickets", op: ">", value: 0 },
        effects: [{ metric: "wickets", type: "multiplier", value: 2 }] },
      { condition: { stat: "wickets", op: "==", value: 0 },
        effects: [{ metric: "runsConceded", type: "multiplier", value: 2 }] },
    ],
  },
  choker: {
    name: "Choker",
    description: "+1 per ball bowled if runs ≤ 50% of balls; penalty -1 per run conceded",
    rules: [
      { condition: { stat: "runsConcededToBallsRatio", op: "<=", value: 0.5 },
        effects: [{ metric: "ballsBowled", type: "offset", value: 1 }] },
      { condition: { stat: "always", op: "true" },
        effects: [{ metric: "runsConceded", type: "offset", value: -1 }] },
    ],
  },
};

async function seedBoosters() {
  for (const [id, data] of Object.entries(boosters)) {
    await setDoc(doc(db, "boosters", id), data);
    console.log(`✅ Seeded booster: ${id}`);
  }
  console.log("🎯 All boosters added successfully!");
}

seedBoosters().catch(console.error);
