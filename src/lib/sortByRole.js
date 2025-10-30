// src/lib/sortByRole.js
export const sortByRole = (players, resolvePlayer) => {
  const order = { Batsman: 1, "All Rounder": 2, Bowler: 3 };
  return [...(players || [])].sort((a, b) => {
    const ra = order[resolvePlayer(a.playerId)?.role] ?? 99;
    const rb = order[resolvePlayer(b.playerId)?.role] ?? 99;
    return ra - rb;
  });
};
