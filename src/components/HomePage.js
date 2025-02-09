import React, { useEffect, useState } from "react";
import { auth, getAdminEmails, logOut } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const HomePage = () => {
  const [isAdmin, setIsAdmin] = useState(false); // Tracks if user is an admin
  const [user, setUser] = useState(null); // Stores authenticated user details
  const [loading, setLoading] = useState(true); // Loading state before authentication is confirmed
  const navigate = useNavigate();

  /**
   * Checks if the logged-in user is an admin by comparing their email with stored admin emails.
   * @param {object} currentUser - The currently authenticated user.
   */
  const checkAdminStatus = async (currentUser) => {
    if (!currentUser) return;
    const adminEmails = await getAdminEmails();
    setIsAdmin(adminEmails.includes(currentUser.email?.toLowerCase()));
    setLoading(false);
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

      {/* Dashboard Header */}
      <h1 className="text-2xl font-bold mb-4">{isAdmin ? "Admin Dashboard" : "User Dashboard"}</h1>

      {/* Admin-only Controls */}
      {isAdmin && (
        <div className="bg-green-100 p-3 rounded">
          <p>You have admin privileges.</p>
          <button 
            onClick={() => navigate("/create-tournament")} 
            className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
          >
            Create Tournament
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
