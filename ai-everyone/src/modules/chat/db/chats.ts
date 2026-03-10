/**
 * Firestore CRUD operations for the "chats" sub-collection.
 *
 * Firestore path: users/{uid}/chats/{chatId}
 *
 * Adapted from Chatbot-UI's db/chats.ts — replaces Supabase calls
 * with Firestore operations using the existing `db` instance.
 */

import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Chat } from "@/modules/chat/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reference to a user's chats collection. */
const chatsCol = (uid: string) => collection(db, "users", uid, "chats");

/** Reference to a specific chat document. */
const chatDoc = (uid: string, chatId: string) =>
    doc(db, "users", uid, "chats", chatId);

/** Convert a Firestore Timestamp field to an ISO string (fallback-safe). */
const toISO = (val: unknown): string => {
    if (val instanceof Timestamp) return val.toDate().toISOString();
    if (typeof val === "string") return val;
    return new Date().toISOString();
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new chat for the given user.
 * Returns the full Chat object with its generated Firestore ID.
 */
export async function createChat(
    uid: string,
    title: string
): Promise<Chat> {
    const docRef = await addDoc(chatsCol(uid), {
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    const now = new Date().toISOString();
    return {
        id: docRef.id,
        userId: uid,
        title,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Get all chats for the given user, ordered by most-recently-updated first.
 */
export async function getChats(uid: string): Promise<Chat[]> {
    const q = query(chatsCol(uid), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            userId: uid,
            title: data.title ?? "New Chat",
            createdAt: toISO(data.createdAt),
            updatedAt: toISO(data.updatedAt),
        };
    });
}

/**
 * Get a single chat by its ID.
 * Returns null if the document does not exist.
 */
export async function getChatById(
    uid: string,
    chatId: string
): Promise<Chat | null> {
    const snapshot = await getDoc(chatDoc(uid, chatId));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
        id: snapshot.id,
        userId: uid,
        title: data.title ?? "New Chat",
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
    };
}

/**
 * Update a chat document (e.g. rename or touch updatedAt).
 */
export async function updateChat(
    uid: string,
    chatId: string,
    data: Partial<Pick<Chat, "title">>
): Promise<void> {
    await updateDoc(chatDoc(uid, chatId), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a chat document.
 * Note: Firestore does NOT automatically delete sub-collections.
 * The caller should also call deleteMessages() before this.
 */
export async function deleteChat(
    uid: string,
    chatId: string
): Promise<void> {
    await deleteDoc(chatDoc(uid, chatId));
}
