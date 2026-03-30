// Firestore database utility functions
// Provides CRUD operations for the "users" collection (and any future collections).
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// User Profile CRUD — Collection: "users"
// Each document ID is the Firebase Auth UID.
// ---------------------------------------------------------------------------

export interface UserProfile {
    name: string;
    email: string;
    image: string | null;
    createdAt: string;
    installedAgents?: string[]; // array of agent IDs installed by this user
    [key: string]: unknown; // allow additional fields
}

/**
 * Create (or overwrite) a user profile document in Firestore.
 * The document ID is the Firebase Auth UID.
 */
export async function createUserProfile(
    uid: string,
    data: UserProfile
): Promise<void> {
    await setDoc(doc(db, "users", uid), data);
}

/**
 * Read a user profile document from Firestore.
 * Returns null if the document does not exist.
 */
export async function getUserProfile(
    uid: string
): Promise<UserProfile | null> {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) return null;
    return snapshot.data() as UserProfile;
}

/**
 * Update specific fields on a user profile document.
 */
export async function updateUserProfile(
    uid: string,
    data: Partial<UserProfile>
): Promise<void> {
    await setDoc(doc(db, "users", uid), data, { merge: true });
}

/**
 * Delete a user profile document from Firestore.
 */
export async function deleteUserProfile(uid: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid));
}

// ---------------------------------------------------------------------------
// Installed Agents — field on users/{uid}
// ---------------------------------------------------------------------------

/**
 * Add an agentId to the user's installedAgents array (atomic arrayUnion).
 * Calling this with an already-installed agentId is a safe no-op.
 */
export async function installAgentForUser(uid: string, agentId: string): Promise<void> {
    await updateDoc(doc(db, "users", uid), {
        installedAgents: arrayUnion(agentId),
    });
}

/**
 * Remove an agentId from the user's installedAgents array (atomic arrayRemove).
 * Calling this when the agent is not installed is a safe no-op.
 */
export async function uninstallAgentForUser(uid: string, agentId: string): Promise<void> {
    await updateDoc(doc(db, "users", uid), {
        installedAgents: arrayRemove(agentId),
    });
}

/**
 * Return the list of installed agent IDs for a user.
 * Returns an empty array if the user doc doesn't exist or has no installedAgents.
 */
export async function getUserInstalledAgents(uid: string): Promise<string[]> {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) return [];
    const data = snapshot.data();
    return (data?.installedAgents as string[]) ?? [];
}
