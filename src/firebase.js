import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Firebase configuration from your Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyBIs9DfwUvB9lNXt6tCg0hfkjrDA7-UMLs",
  authDomain: "fcric-d32e9.firebaseapp.com",
  projectId: "fcric-d32e9",
  storageBucket: "fcric-d32e9.firebasestorage.app",
  messagingSenderId: "598708395031",
  appId: "1:598708395031:web:8c095c8dea302c5e5c5052"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user; // Returns user details
  } catch (error) {
    console.error("Google Sign-In Error:", error);
  }
};

// Sign out
export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};