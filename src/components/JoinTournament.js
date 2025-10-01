import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const JoinTournament = () => 
{
	const { id } = useParams(); // tournament id from route
	const navigate = useNavigate();
	const [tournament, setTournament] = useState(null);
	const [loading, setLoading] = useState(true);

	const [selectedPlayers, setSelectedPlayers] = useState([]);
	const [budgetLeft, setBudgetLeft] = useState(tournament?.maxBudget || 0);

	const togglePlayer = (player) => 
	{
		const exists = selectedPlayers.find((p) => p.playerName === player.playerName);

		if (exists) 
		{
			// remove player
			setSelectedPlayers(selectedPlayers.filter((p) => p.playerName !== player.playerName));
			setBudgetLeft(budgetLeft + player.value);
		} 
		else 
		{
			// add player if budget allows
			if (budgetLeft < player.value) 
			{
				alert("Not enough points left!");
				return;
			}
			setSelectedPlayers([...selectedPlayers, player]);
			setBudgetLeft(budgetLeft - player.value);
		}
	};


	useEffect(() => {
		const fetchTournament = async () => {
			try {
				const ref = doc(db, "tournaments", id);
				const snap = await getDoc(ref);
				if (!snap.exists()) {
					alert("Tournament not found");
					navigate("/");
					return;
				}
				setTournament({ id: snap.id, ...snap.data() });
			} catch (err) {
				console.error("Error fetching tournament:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchTournament();
	}, [id, navigate]);

	useEffect(() => {
		if (tournament?.maxBudget) {
		setBudgetLeft(tournament.maxBudget);
		}
	}, [tournament]);



	if (loading) return <div className="p-4">Loading...</div>;
	if (!tournament) return null;

	return (
    <div className="p-6 overflow-y-auto" style={{ maxHeight: "100vh" }}>
      <h1 className="text-2xl font-bold mb-2">{tournament.name}</h1>
      <p className="mb-4">Budget: {tournament.maxBudget}</p>
	  
		<p className="mb-4 font-semibold">Budget left: {budgetLeft} points</p>

		<h2 className="text-lg font-bold mb-2">Selected Players</h2>
		{selectedPlayers.length === 0 ? (
			<p className="mb-6">No players selected yet.</p>
		) : (
			<ul className="list-disc ml-5 mb-6">
			{selectedPlayers.map((p, i) => (
				<li key={i}>
				{p.playerName} — {p.role} — {p.value} points
			  </li>
			))
		}
		  </ul>
		)
	}

	  

		{/* Teams & Players */}
		<h2 className="text-xl font-bold mb-2">Teams & Players</h2>
		{tournament.teams?.map((team, idx) => (
		  <div key={idx} className="mb-6 border p-2 rounded">
			<h3 className="font-semibold mb-2">{team.name || `Team ${idx + 1}`}</h3>
			<table
			  className="w-full border-separate border border-gray-300"
			  style={{ borderSpacing: "0" }}
			>
			  <thead className="bg-gray-100">
				<tr>
				  <th className="border border-gray-300 px-2 py-2 text-left">Player</th>
				  <th className="border border-gray-300 px-2 py-2 text-left">Role</th>
				  <th className="border border-gray-300 px-2 py-2 text-left">Points</th>
				  <th className="border border-gray-300 px-2 py-1 text-left">Action</th>

				</tr>
			  </thead>
			  <tbody>
				  {team.players?.map((p, i) => {
					const isSelected = selectedPlayers.some((sp) => sp.playerName === p.playerName);
					return (
					  <tr key={i} className="hover:bg-gray-50">
						<td className="border border-gray-300 px-2 py-1">{p.playerName}</td>
						<td className="border border-gray-300 px-2 py-1">{p.role}</td>
						<td className="border border-gray-300 px-2 py-1">{p.value} points</td>
						<td className="border border-gray-300 px-2 py-1">
						  {isSelected ? (
							<button
							  onClick={() => togglePlayer(p)}
							  className="bg-red-500 text-white px-2 py-1 rounded"
							>
							  Remove
							</button>
						  ) : (
							<button
							  onClick={() => togglePlayer(p)}
							  className="bg-green-500 text-white px-2 py-1 rounded"
							>
							  Add
							</button>
						  )}
						</td>
					  </tr>
					);
				  })}
			  </tbody>

			</table>
		  </div>
		))}

      {/* Stages */}
      <h2 className="text-xl font-bold mb-2">Stages</h2>
      {tournament.stages?.map((stage, idx) => (
        <div key={idx} className="mb-4 border p-2 rounded">
          <h3 className="font-semibold">
            {stage.name} (Subs Allowed: {stage.subsAllowed})
          </h3>
          <ul className="list-disc ml-5">
			{stage.matches?.map((m, i) => {
			  const matchDate = m.matchDate?.toDate
				? m.matchDate.toDate()
				: new Date(m.matchDate);
			  const cutoffDate = m.cutoffDate?.toDate
				? m.cutoffDate.toDate()
				: new Date(m.cutoff);

			  const formatDate = (d) =>
				d.toLocaleDateString("en-GB", {
				  day: "2-digit",
				  month: "short",
				  year: "numeric"
				}) +
				" @ " +
				d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

			  return (
				<li key={i}>
				  Match {i + 1}: {m.team1} vs {m.team2} – {formatDate(matchDate)}{" "}
				  <span className="text-sm text-gray-600">
					[Sub cutoff: {formatDate(cutoffDate)}]
				  </span>
				</li>
			  );
			})}          </ul>
        </div>
      ))}
    </div>
  );
};

export default JoinTournament;
