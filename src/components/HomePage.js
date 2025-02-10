import React, { useEffect, useState } from "react";
import { auth, getAdminEmails, logOut, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";

const HomePage = () => {
  const [isAdmin, setIsAdmin] = useState(false); // Tracks if user is an admin
  const [user, setUser] = useState(null); // Stores authenticated user details
  const [loading, setLoading] = useState(true); // Loading state before authentication is confirmed
  const [tournaments, setTournaments] = useState([]); // Stores active tournaments
  const navigate = useNavigate();

  /**
   * Fetches active tournaments from Firestore and updates the state.
   */
  const fetchTournaments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "tournaments"));
      const activeTournaments = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(tournament => tournament.active); // Only fetch active tournaments

      setTournaments(activeTournaments);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    }
  };

  /**
   * Checks if the logged-in user is an admin by comparing their email with stored admin emails.
   * @param {object} currentUser - The currently authenticated user.
   */
  const checkAdminStatus = async (currentUser) => {
    if (!currentUser) return;
    const adminEmails = await getAdminEmails();
    setIsAdmin(adminEmails.includes(currentUser.email?.toLowerCase()));
  };

  /**
   * Subscribes to Firebase authentication state changes.
   * Redirects unauthenticated users to the login page.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setLoading(false);
        navigate("/auth"); // Redirect to login page if not authenticated
        return;
      }

      setUser(currentUser);
      await checkAdminStatus(currentUser);
      await fetchTournaments(); // Fetch active tournaments after user login
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on component unmount
  }, [navigate]);

  /**
   * Handles user logout and redirects to login page.
   */
  const handleLogout = async () => {
    await logOut();
  };

  // Show loading message until authentication check completes
  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  // Redirect to login page if user is null
  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="home-container p-4">
      {/* User Profile Section */}
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

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      {/* Active Tournaments Section */}
      <h2 className="text-2xl font-bold mb-4">Active Tournaments</h2>
      {tournaments.length === 0 ? (
        <p>No active tournaments available.</p>
      ) : (
        <div className="tournament-list">
		  {tournaments.map(tournament => (
			<div key={tournament.id} className="p-2 border-b">
			  {tournament.name}
			</div>
		  ))}
		</div>
      )}

      {/* Admin Dashboard Section */}
      {isAdmin && (
        <div className="bg-green-100 p-3 rounded mt-6">
          <h2 className="text-xl font-bold mb-2">Admin Dashboard</h2>
          <p>You have admin privileges.</p>
          <button 
            onClick={() => navigate("/create-tournament")} 
            className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
          >
            Manage Tournaments
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
