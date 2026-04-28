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
import type { Chat, ChatWorkspaceType } from "@/modules/chat/types";

export interface ChatScopeInput {
    workspaceType?: ChatWorkspaceType;
    agentId?: string | null;
    agentName?: string | null;
}

export interface GetChatsOptions {
    workspaceType?: ChatWorkspaceType;
    agentId?: string | null;
}

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

const mapChatDoc = (uid: string, id: string, data: Record<string, unknown>): Chat => {
    const agentId = typeof data.agentId === "string" ? data.agentId : null;
    const agentName = typeof data.agentName === "string" ? data.agentName : null;
    const workspaceType =
        data.workspaceType === "agent" || agentId ? "agent" : "global";

    return {
        id,
        userId: uid,
        title: typeof data.title === "string" ? data.title : "New Chat",
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
        agentId,
        agentName,
        workspaceType,
    };
};

const matchesChatOptions = (chat: Chat, options?: GetChatsOptions): boolean => {
    if (!options) return true;
    if (options.workspaceType === "global") {
        return chat.workspaceType !== "agent" && !chat.agentId;
    }
    if (options.workspaceType === "agent") {
        if (!options.agentId) return chat.workspaceType === "agent";
        return chat.workspaceType === "agent" && chat.agentId === options.agentId;
    }
    if (typeof options.agentId === "string") return chat.agentId === options.agentId;
    return true;
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
    title: string,
    scope?: ChatScopeInput
): Promise<Chat> {
    const workspaceType: ChatWorkspaceType =
        scope?.workspaceType || (scope?.agentId ? "agent" : "global");
    const payload: Record<string, unknown> = {
        title,
        workspaceType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    if (workspaceType === "agent") {
        payload.agentId = scope?.agentId || null;
        payload.agentName = scope?.agentName || null;
    }

    const docRef = await addDoc(chatsCol(uid), {
        ...payload,
    });

    const now = new Date().toISOString();
    return {
        id: docRef.id,
        userId: uid,
        title,
        createdAt: now,
        updatedAt: now,
        workspaceType,
        agentId: workspaceType === "agent" ? scope?.agentId || null : null,
        agentName: workspaceType === "agent" ? scope?.agentName || null : null,
    };
}

/**
 * Get all chats for the given user, ordered by most-recently-updated first.
 */
export async function getChats(uid: string, options?: GetChatsOptions): Promise<Chat[]> {
    const q = query(chatsCol(uid), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map((d) => mapChatDoc(uid, d.id, d.data()))
        .filter((chat) => matchesChatOptions(chat, options));
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
    return mapChatDoc(uid, snapshot.id, data);
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
