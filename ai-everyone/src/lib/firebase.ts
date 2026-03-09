// Firebase app initialization
// Initializes Firebase using environment variables and exports shared instances.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration — all values are read from environment variables.
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once (avoid re-initialization in hot-reload / SSR).
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firebase Auth instance — used across all auth operations.
export const auth = getAuth(app);

// Firestore instance — used across all database operations.
export const db = getFirestore(app);

export default app;
