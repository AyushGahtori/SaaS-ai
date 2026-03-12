// Firestore utility functions for the Agents Marketplace.
// Handles CRUD for the "agents" collection and user installedAgents management.

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    increment,
    arrayUnion,
    arrayRemove,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Agent type definitions
// ---------------------------------------------------------------------------

export interface Agent {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    category: string;
    installCount: number;
    rating: number;
    createdAt: Timestamp | string;
    isFeatured: boolean;
    trendingScore: number;
    tags?: string[];
}

// ---------------------------------------------------------------------------
// Agents Collection — CRUD
// Collection: "agents"
// ---------------------------------------------------------------------------

/**
 * Fetch all agents from the "agents" Firestore collection.
 * Returns an array of Agent objects, each with their document ID included.
 */
export async function getAllAgents(): Promise<Agent[]> {
    const snapshot = await getDocs(collection(db, "agents"));
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Agent[];
}

/**
 * Fetch a single agent by Firestore document ID.
 * Returns null if the agent does not exist.
 */
export async function getAgentById(agentId: string): Promise<Agent | null> {
    const snapshot = await getDoc(doc(db, "agents", agentId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Agent;
}

/**
 * Fetch all featured agents (isFeatured === true).
 * Used for the hero / banner section of the marketplace.
 */
export async function getFeaturedAgents(): Promise<Agent[]> {
    const q = query(
        collection(db, "agents"),
        where("isFeatured", "==", true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Agent[];
}

/**
 * Fetch trending agents sorted by trendingScore descending.
 * @param count Maximum number of agents to return (defaults to 10).
 *
 * Trending formula (stored on each agent, updated on install):
 *   trendingScore = installsLast7Days * 2 + rating * 10
 */
export async function getTrendingAgents(count: number = 10): Promise<Agent[]> {
    const q = query(
        collection(db, "agents"),
        orderBy("trendingScore", "desc"),
        firestoreLimit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Agent[];
}

/**
 * Seed / upsert an agent document.
 * Used by the seed script to populate initial agents.
 * The document ID is the agentId passed in.
 */
export async function upsertAgent(agentId: string, data: Omit<Agent, "id">): Promise<void> {
    await setDoc(doc(db, "agents", agentId), data);
}

/**
 * Atomically increment an agent's installCount by 1.
 * Called after a user successfully installs an agent.
 */
export async function incrementInstallCount(agentId: string): Promise<void> {
    await updateDoc(doc(db, "agents", agentId), {
        installCount: increment(1),
    });
}

/**
 * Atomically decrement an agent's installCount by 1 (minimum 0 guard is
 * handled at the product level — not enforced here at DB level).
 * Called after a user uninstalls an agent.
 */
export async function decrementInstallCount(agentId: string): Promise<void> {
    await updateDoc(doc(db, "agents", agentId), {
        installCount: increment(-1),
    });
}

// ---------------------------------------------------------------------------
// User installedAgents — Collection: "users"
// Each user document stores an installedAgents string array.
// ---------------------------------------------------------------------------

/**
 * Add an agentId to a user's installedAgents array (atomic arrayUnion).
 * If the agent is already installed this is a no-op.
 */
export async function installAgentForUser(uid: string, agentId: string): Promise<void> {
    await updateDoc(doc(db, "users", uid), {
        installedAgents: arrayUnion(agentId),
    });
}

/**
 * Remove an agentId from a user's installedAgents array (atomic arrayRemove).
 * If the agent is not installed this is a no-op.
 */
export async function uninstallAgentForUser(uid: string, agentId: string): Promise<void> {
    await updateDoc(doc(db, "users", uid), {
        installedAgents: arrayRemove(agentId),
    });
}

/**
 * Fetch the list of installed agent IDs for a user.
 * Returns an empty array if the user document doesn't exist or has no installed agents.
 */
export async function getUserInstalledAgents(uid: string): Promise<string[]> {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) return [];
    const data = snapshot.data();
    return (data?.installedAgents as string[]) || [];
}
