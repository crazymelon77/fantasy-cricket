import React, { useEffect, useState } from "react";
import { auth, getAdminEmails, logOut, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";

const HomePage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [userTeams, setUserTeams] = useState({});
  const navigate = useNavigate();

  /** Fetch active tournaments */
  const fetchTournaments = async () => {
    try {
		const querySnapshot = await getDocs(collection(db, "tournaments"));
		const allTournaments = querySnapshot.docs.map(doc => ({
		  id: doc.id,
		  ...doc.data()
		}));

		setTournaments(allTournaments);

    } catch (error) {
      console.error("Error fetching tournaments:", error);
    }
  };

  /** Fetch user teams */
  const fetchUserTeams = async (uid) => {
    try {
      const userTeamsRef = doc(db, "user_teams", uid);
      const userTeamsSnap = await getDoc(userTeamsRef);
      if (userTeamsSnap.exists()) {
        setUserTeams(userTeamsSnap.data()); // expected: { [tournamentId]: teamData }
      } else {
        setUserTeams({});
      }
    } catch (error) {
      console.error("Error fetching user teams:", error);
    }
  };

  /** Check admin status */
  const checkAdminStatus = async (currentUser) => {
    if (!currentUser) return;
    const adminEmails = await getAdminEmails();
    setIsAdmin(adminEmails.includes(currentUser.email?.toLowerCase()));
  };

  /** Auth state listener */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setLoading(false);
        navigate("/auth");
        return;
      }

      setUser(currentUser);
      await checkAdminStatus(currentUser);
      await fetchTournaments();
      await fetchUserTeams(currentUser.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  /** Logout */
  const handleLogout = async () => {
    await logOut();
  };

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="home-container p-4">
      {/* User Profile */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <img
            src={user.photoURL}
            alt="Profile"
            className="w-12 h-12 rounded-full mr-3"
          />
          <div>
            <h2 className="text-xl font-bold">{user.displayName}</h2>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {/* Active Tournaments */}
		<h2 className="text-2xl font-bold mb-4">Active Tournaments</h2>
		{tournaments.filter(t => t.active).length === 0 ? (
		  <p>No active tournaments available.</p>
		) : (
		  <div className="tournament-list">
			{tournaments
			  .filter(t => t.active)
			  .map(tournament => {
				const hasJoined = !!userTeams[tournament.id];
				return (
				  <div
					key={tournament.id}
					className="p-2 border-b flex justify-between items-center"
				  >
					<span>{tournament.name}</span>
					<div className="flex space-x-2">
					  <button
						onClick={() =>
						  navigate(
							hasJoined
							  ? `/tournament/${tournament.id}/team`
							  : `/tournament/${tournament.id}`
						  )
						}
						className="bg-indigo-500 text-white px-3 py-1 rounded"
					  >
						{hasJoined ? "View / Update Team" : "Join"}
					  </button>
					  {isAdmin && (
						<button
						  onClick={() => navigate(`/edit-tournament/${tournament.id}`)}
						  className="bg-blue-500 text-white px-3 py-1 rounded"
						>
						  Edit
						</button>
					  )}
					</div>
				  </div>
				);
			  })}
		  </div>
		)}

		{/* Admin Dashboard */}
		{isAdmin && (
		  <div className="bg-green-100 p-3 rounded mt-6">
			<h2 className="text-xl font-bold mb-2">Admin Dashboard</h2>
			<p>You have admin privileges.</p>
			<button
			  onClick={() => navigate("/create-tournament")}
			  className="bg-green-500 text-white px-4 py-2 rounded mb-4"
			>
			  Create Tournament
			</button>

			{/* Inactive Tournaments */}
			{tournaments.filter(t => !t.active).length > 0 && (
			  <div className="mt-4">
				<h3 className="text-lg font-bold mb-2">Inactive Tournaments</h3>
				<div className="tournament-list">
				  {tournaments
					.filter(t => !t.active)
					.map(tournament => (
					  <div
						key={tournament.id}
						className="p-2 border-b flex justify-between items-center"
					  >
						<span>{tournament.name}</span>
						<button
						  onClick={() => navigate(`/edit-tournament/${tournament.id}`)}
						  className="bg-blue-500 text-white px-3 py-1 rounded"
						>
						  Edit
						</button>
						
						<button
						  onClick={async () => {
							if (window.confirm("Are you sure you want to delete this tournament?")) {
							  await deleteDoc(doc(db, "tournaments", tournament.id));
							  // refresh state after delete
							  setTournaments((prev) =>
								prev.filter((t) => t.id !== tournament.id)
							  );
							}
						  }}
						  className="bg-red-500 text-white px-3 py-1 rounded"
						>
						  Delete
						</button>

						
						
						
					  </div>
					))}
				</div>
			  </div>
			)}
		  </div>
		)}
    </div>
  );
};

export default HomePage;
