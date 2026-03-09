// Firebase Authentication utility functions
// Provides signUp, signIn, signInWithGoogle, and logOut operations.
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserProfile, getUserProfile } from "@/lib/firestore";

// Google auth provider instance (reusable).
const googleProvider = new GoogleAuthProvider();

/**
 * Sign up a new user with email and password.
 * Also sets the displayName on the Firebase Auth profile and
 * creates a corresponding document in the Firestore "users" collection.
 */
export async function signUpWithEmail(
    name: string,
    email: string,
    password: string
) {
    const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
    );
    // Set the display name on the Firebase Auth user profile.
    await updateProfile(userCredential.user, { displayName: name });

    // Create a user profile document in Firestore.
    await createUserProfile(userCredential.user.uid, {
        name,
        email,
        image: userCredential.user.photoURL || null,
        createdAt: new Date().toISOString(),
    });

    return userCredential.user;
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
    );
    return userCredential.user;
}

/**
 * Sign in (or sign up) using Google OAuth popup.
 * If this is the user's first time signing in with Google,
 * a Firestore user profile document is created automatically.
 */
export async function signInWithGoogle() {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const user = userCredential.user;

    // Check if a Firestore profile already exists for this user.
    const existingProfile = await getUserProfile(user.uid);
    if (!existingProfile) {
        // First-time Google sign-in — create a Firestore profile.
        await createUserProfile(user.uid, {
            name: user.displayName || "User",
            email: user.email || "",
            image: user.photoURL || null,
            createdAt: new Date().toISOString(),
        });
    }

    return user;
}

/**
 * Sign out the current user.
 */
export async function logOut() {
    await signOut(auth);
}
