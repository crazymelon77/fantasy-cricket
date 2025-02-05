import React, { useState } from "react";
import { signInWithGoogle, logOut, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

const Auth = () => {
  const [user, setUser] = useState(null);

  // Listen for authentication state changes
  onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
  });

  return (
    <div className="p-4 max-w-sm mx-auto text-center">
      <h2 className="text-xl font-bold">Silly Point - Login</h2>

      {user ? (
        <div>
          <p>Welcome, {user.displayName}!</p>
          <img src={user.photoURL} alt="User Avatar" className="w-16 h-16 rounded-full mx-auto my-2"/>
          <button
            onClick={logOut}
            className="mt-4 p-2 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          className="mt-4 p-2 bg-blue-500 text-white rounded"
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
};

export default Auth;
