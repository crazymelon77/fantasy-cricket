import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";

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
export const db = getFirestore(app); // ✅ Firestore instance

// ✅ Fetch list of admin emails
export const getAdminEmails = async () => {
  try {
    //console.log("Fetching admins from Firestore...");
    const adminCollection = collection(db, "admins");
    const adminSnapshot = await getDocs(adminCollection);
    const adminEmails = adminSnapshot.docs.map(doc => doc.data().email?.toLowerCase()).filter(Boolean);
    //console.log("Fetched Admin Emails:", adminEmails); // ✅ Debug log
    return adminEmails;
  } catch (error) {
    console.error("Error fetching admin emails:", error);
    return [];
  }
};


// ✅ Add a new tournament to Firestore
export const addTournament = async (name, maxBudget) => {
  try {
    const docRef = await addDoc(collection(db, "tournaments"), {
      name,
      maxBudget,
      stages: [], // Placeholder for now
      active: false, // Default state
    });
    console.log("Tournament added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding tournament:", error);
    throw error;
  }
};

// ✅ Fetch all tournaments from Firestore
export const getTournaments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "tournaments"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return [];
  }
};

// ✅ Sign in with Google
export const signInWithGoogle = async () => {
  try {
    await auth.signOut(); // Force clear auth state before signing in
    const result = await signInWithPopup(auth, googleProvider);
	//console.log("Logged in user:", result.user);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

// ✅ Sign out user
export const logOut = async () => {
  try {
    await auth.signOut();
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.location.href = "/auth"; // Force refresh
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};
