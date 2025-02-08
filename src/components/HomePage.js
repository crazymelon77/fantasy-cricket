import React, { useEffect, useState } from "react";
import { auth, getAdminEmails, logOut } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const HomePage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async (currentUser) => {
      if (!currentUser) return;
      const adminEmails = await getAdminEmails();
      const isUserAdmin = adminEmails.includes(currentUser.email?.toLowerCase());
      setIsAdmin(isUserAdmin);
      setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser?.email);

      if (!currentUser) {
        setLoading(false);
        navigate("/auth");
        return;
      }

      setUser(currentUser);
      await checkAdminStatus(currentUser);
    });

    return () => unsubscribe();
  }, [navigate]);

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

      <h1 className="text-2xl font-bold mb-4">
        {isAdmin ? "Admin Dashboard" : "User Dashboard"}
      </h1>

      {isAdmin && (
        <div className="admin-controls bg-green-100 p-3 rounded">
          <p>You have admin privileges.</p>
          <button
            onClick={() => navigate("/create-tournament")}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Create Tournament
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
