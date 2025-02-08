import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIs9DfwUvB9lNXt6tCg0hfkjrDA7-UMLs",
  authDomain: "fcric-d32e9.firebaseapp.com",
  projectId: "fcric-d32e9",
  storageBucket: "fcric-d32e9.firebasestorage.app",
  messagingSenderId: "598708395031",
  appId: "1:598708395031:web:8c095c8dea302c5e5c5052"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const getAdminEmails = async () => {
  try {
    const adminCollection = collection(db, "admins");
    const adminSnapshot = await getDocs(adminCollection);
    const adminEmails = adminSnapshot.docs.map(doc => doc.data().email?.toLowerCase()).filter(Boolean);
    console.log("Fetched admin emails:", adminEmails);
    return adminEmails;
  } catch (error) {
    console.error("Error fetching admin emails:", error);
    return [];
  }
};

export const signInWithGoogle = async () => {
  try {
    // Force clear auth state before signing in
    await auth.signOut();
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await auth.signOut();
    // Clear any cached data
    window.sessionStorage.clear();
    window.localStorage.clear();
    // Force a complete page refresh
    window.location.href = '/auth';
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};