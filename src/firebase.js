import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";

// Firebase project configuration (from Firebase Console)
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
export const auth = getAuth(app); // Firebase Authentication instance
export const googleProvider = new GoogleAuthProvider(); // Google Sign-In Provider
export const db = getFirestore(app); // Firestore Database Instance

/**
 * Fetches the list of admin emails from Firestore.
 * @returns {Promise<string[]>} - A list of admin emails.
 */
export const getAdminEmails = async () => {
  try {
    const adminCollection = collection(db, "admins");
    const adminSnapshot = await getDocs(adminCollection);
    return adminSnapshot.docs.map(doc => doc.data().email?.toLowerCase()).filter(Boolean);
  } catch (error) {
    console.error("Error fetching admin emails:", error);
    return [];
  }
};

/**
 * Handles Google sign-in using a popup.
 * @returns {Promise<object>} - The authenticated user's details.
 */
export const signInWithGoogle = async () => {
  try {
    await auth.signOut(); // Ensure a fresh session before signing in
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

/**
 * Logs out the current user and clears session data.
 */
export const logOut = async () => {
  try {
    await auth.signOut();
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.location.href = "/auth"; // Redirect to login page
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};

/**
 * Adds a new tournament to Firestore.
 * @param {string} name - The name of the tournament.
 * @param {number} maxBudget - The maximum budget for fantasy teams.
 * @returns {Promise<string>} - The ID of the created tournament document.
 */
export const addTournament = async (name, maxBudget) => {
  try {
    const docRef = await addDoc(collection(db, "tournaments"), {
      name,
      maxBudget,
      stages: [], // Placeholder for tournament stages
      active: false, // Default state
    });
    return docRef.id; // Return the new tournament ID
  } catch (error) {
    console.error("Error adding tournament:", error);
    throw error;
  }
};

/**
 * Fetches all tournaments from Firestore.
 * @returns {Promise<Array>} - A list of tournament objects.
 */
export const getTournaments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "tournaments"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return [];
  }
};
