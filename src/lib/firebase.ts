import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAQ_AKSnBgljWkdp5G-QaNooi7HF5qxSnQ",
  authDomain: "chunktapp.firebaseapp.com",
  projectId: "chunktapp",
  storageBucket: "chunktapp.firebasestorage.app",
  messagingSenderId: "314007461631",
  appId: "1:314007461631:web:eb1f97bd5a0fdf932f76ca",
  measurementId: "G-NYK6PV28L6"
};

const app = initializeApp(firebaseConfig);

// Force long-polling to avoid WebSocket issues.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}); 

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
    throw error;
  }
};
