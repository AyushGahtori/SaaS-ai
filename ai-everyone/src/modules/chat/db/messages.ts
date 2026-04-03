/**
 * Firestore CRUD operations for the "messages" sub-collection.
 *
 * Firestore path: users/{uid}/chats/{chatId}/messages/{messageId}
 *
 * Adapted from Chatbot-UI's db/messages.ts — replaces Supabase calls
 * with Firestore operations using the existing `db` instance.
 */

import {
    collection,
    doc,
    addDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatAttachment, ChatMessage, MessageRole } from "@/modules/chat/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reference to a chat's messages sub-collection. */
const messagesCol = (uid: string, chatId: string) =>
    collection(db, "users", uid, "chats", chatId, "messages");

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
 * Create a new message in a chat.
 * Returns the full ChatMessage object with its generated Firestore ID.
 *
 * For agent messages, pass optional taskId and agentId to link the
 * message to its agentTask document.
 */
export async function createMessage(
    uid: string,
    chatId: string,
    role: MessageRole,
    content: string,
    taskId?: string,
    agentId?: string,
    isVoice?: boolean,
    attachments: ChatAttachment[] = []
): Promise<ChatMessage> {
    // Never persist raw file bytes in chat messages.
    const normalizedAttachments = attachments.map((item) => ({
        id: item.id,
        source: item.source,
        name: item.name,
        mimeType: item.mimeType,
        ...(typeof item.size === "number" ? { size: item.size } : {}),
        ...(item.driveFileId ? { driveFileId: item.driveFileId } : {}),
        ...(item.webViewLink ? { webViewLink: item.webViewLink } : {}),
        ...(item.storagePath ? { storagePath: item.storagePath } : {}),
    }));

    const messageData: Record<string, unknown> = {
        role,
        content,
        createdAt: serverTimestamp(),
    };

    // Store optional metadata if present
    if (taskId) messageData.taskId = taskId;
    if (agentId) messageData.agentId = agentId;
    if (isVoice) messageData.isVoice = isVoice;
    if (normalizedAttachments.length > 0) {
        messageData.attachments = normalizedAttachments;
    }

    const docRef = await addDoc(messagesCol(uid, chatId), messageData);

    return {
        id: docRef.id,
        chatId,
        role,
        content,
        createdAt: new Date().toISOString(),
        ...(taskId && { taskId }),
        ...(agentId && { agentId }),
        ...(isVoice && { isVoice }),
        ...(normalizedAttachments.length > 0 && { attachments: normalizedAttachments }),
    };
}

/**
 * Get all messages for a given chat, ordered oldest-first.
 */
export async function getMessages(
    uid: string,
    chatId: string
): Promise<ChatMessage[]> {
    const q = query(messagesCol(uid, chatId), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            chatId,
            role: data.role as MessageRole,
            content: data.content ?? "",
            createdAt: toISO(data.createdAt),
            ...(data.taskId && { taskId: data.taskId }),
            ...(data.agentId && { agentId: data.agentId }),
            ...(data.isVoice && { isVoice: data.isVoice }),
            ...(Array.isArray(data.attachments) && { attachments: data.attachments as ChatAttachment[] }),
        };
    });
}

/**
 * Delete ALL messages in a chat.
 * Call this before deleting the parent chat document.
 */
export async function deleteMessages(
    uid: string,
    chatId: string
): Promise<void> {
    const snapshot = await getDocs(messagesCol(uid, chatId));
    const deletions = snapshot.docs.map((d) =>
        deleteDoc(doc(db, "users", uid, "chats", chatId, "messages", d.id))
    );
    await Promise.all(deletions);
}
