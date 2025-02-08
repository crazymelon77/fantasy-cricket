import React, { useEffect, useState } from "react";
import { signInWithGoogle, logOut, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto text-center">
      {!user && (
        <button
          onClick={handleSignIn}
          className="mt-4 p-2 bg-blue-500 text-white rounded"
        >
          Sign In with Google
        </button>
      )}
    </div>
  );
};

export default Auth;