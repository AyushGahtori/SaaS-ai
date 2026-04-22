// Firebase Authentication utility functions
// Provides signUp, signIn, signInWithGoogle, and logOut operations.
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    updatePassword,
    updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserProfile, getUserProfile } from "@/lib/firestore";
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";

// Google auth provider instance (reusable).
const googleProvider = new GoogleAuthProvider();

/**
 * Call the server-side API to seed predefined memory skeleton documents
 * for a brand-new user. Fire-and-forget does not block sign-in flow.
 */
function seedNewUserMemory(uid: string): void {
    fetch("/api/user/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
    }).catch((err) => console.error("[AuthClient] Failed to seed user memory:", err));
}

function rethrowAsFriendlyError(error: unknown, surface: "auth_sign_in" | "auth_sign_up"): never {
    const parsed = normalizeUserFacingError(error, { surface });
    throw new Error(parsed.message);
}

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
    let userCredential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>;

    try {
        userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );
        // Set the display name on the Firebase Auth user profile.
        await updateProfile(userCredential.user, { displayName: name });
    } catch (error) {
        rethrowAsFriendlyError(error, "auth_sign_up");
    }

    try {
        // Create a user profile document in Firestore after auth succeeds.
        await createUserProfile(userCredential.user.uid, {
            name,
            email,
            image: userCredential.user.photoURL || null,
            createdAt: new Date().toISOString(),
            onboardingComplete: false,
        });

        // Seed predefined memory skeleton (fire-and-forget).
        seedNewUserMemory(userCredential.user.uid);
    } catch (error) {
        console.error("[AuthClient] Post sign-up setup failed:", error);
        throw new Error(
            "Your account was created, but we could not finish profile setup. Please sign in and try again."
        );
    }

    return userCredential.user;
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(email: string, password: string) {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );
        return userCredential.user;
    } catch (error) {
        rethrowAsFriendlyError(error, "auth_sign_in");
    }
}

/**
 * Sign in (or sign up) using Google OAuth popup.
 * If this is the user's first time signing in with Google,
 * a Firestore user profile document is created automatically.
 */
export async function signInWithGoogle() {
    try {
        const userCredential = await signInWithPopup(auth, googleProvider);
        const user = userCredential.user;

        // Check if a Firestore profile already exists for this user.
        const existingProfile = await getUserProfile(user.uid);
        if (!existingProfile) {
            // First-time Google sign-in, create a Firestore profile.
            await createUserProfile(user.uid, {
                name: user.displayName || "User",
                email: user.email || "",
                image: user.photoURL || null,
                createdAt: new Date().toISOString(),
                onboardingComplete: false,
            });

            // Seed predefined memory skeleton (fire-and-forget).
            seedNewUserMemory(user.uid);
        }

        return user;
    } catch (error) {
        rethrowAsFriendlyError(error, "auth_sign_in");
    }
}

/**
 * Sign out the current user.
 */
export async function logOut() {
    await signOut(auth);
}

/**
 * Change password for the currently signed-in email/password user.
 * Firebase requires re-authentication before sensitive credential changes.
 */
export async function changeCurrentUserPassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Authentication expired. Please sign in again.");
    }

    if (!user.email) {
        throw new Error("Password change is only available for email/password accounts.");
    }

    const hasPasswordProvider = user.providerData.some((provider) => provider.providerId === "password");
    if (!hasPasswordProvider) {
        throw new Error("This account is using social sign-in. Email password reset will be available soon.");
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
    } catch (error) {
        const code =
            typeof error === "object" &&
                error !== null &&
                "code" in error &&
                typeof (error as { code?: unknown }).code === "string"
                ? ((error as { code: string }).code || "").toLowerCase()
                : "";

        if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
            throw new Error("Current password is incorrect.");
        }

        if (code === "auth/weak-password") {
            throw new Error("New password is too weak. Use at least 8 characters with letters, numbers, and symbols.");
        }

        if (code === "auth/too-many-requests") {
            throw new Error("Too many attempts detected. Please wait a moment and try again.");
        }

        if (code === "auth/requires-recent-login" || code === "auth/user-token-expired") {
            throw new Error("Session expired. Please sign in again and retry.");
        }

        throw error instanceof Error ? error : new Error("Failed to change password.");
    }
}
