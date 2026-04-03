/**
 * Firestore CRUD for the "agentTasks" top-level collection.
 *
 * This file provides both:
 *   - Server-side functions (using Admin SDK) for creating tasks from API routes
 *   - Client-side functions (using Firebase JS SDK) for reading/listening to tasks
 *
 * Firestore path: agentTasks/{taskId}
 */



// ── Client-side (Firebase JS SDK) ───────────────────────────────────────────
// Used by the frontend for real-time listeners on task status.

import {
    doc,
    onSnapshot,
    type FirestoreError,
    type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus =
    | "queued"
    | "running"
    | "success"
    | "failed"
    | "action_required"
    | "needs_input";

export interface AgentTask {
    taskId: string;
    userId: string;
    chatId: string;
    agentId: string;
    status: TaskStatus;
    type?: string;
    flow?: Record<string, unknown>;
    parentLLMRequest: Record<string, unknown>;
    agentInput: Record<string, unknown>;
    agentOutput: Record<string, unknown> | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    retryCount: number;
}

function getErrorField(
    error: unknown,
    field: "code" | "name" | "message"
): string {
    if (!error || typeof error !== "object") return "";
    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" ? value.toLowerCase() : "";
}

function isIgnorableAbortLikeError(error: unknown): boolean {
    const code = getErrorField(error, "code");
    const name = getErrorField(error, "name");
    const message = getErrorField(error, "message");

    return (
        code === "aborted" ||
        code === "cancelled" ||
        name === "aborterror" ||
        message.includes("user aborted") ||
        message.includes("signal is aborted")
    );
}

// ---------------------------------------------------------------------------
// Client-side: Real-time listener (Firebase JS SDK)
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates on an agent task.
 * Returns an unsubscribe function.
 */
export function subscribeToTask(
    taskId: string,
    callback: (task: AgentTask | null) => void
): Unsubscribe {
    const taskRef = doc(db, "agentTasks", taskId);

    return onSnapshot(
        taskRef,
        (snapshot) => {
            if (!snapshot.exists()) {
                callback(null);
                return;
            }
            const data = snapshot.data();
            callback({
                taskId: data.taskId,
                userId: data.userId,
                chatId: data.chatId,
                agentId: data.agentId,
                status: data.status,
                type: data.type,
                flow: data.flow,
                parentLLMRequest: data.parentLLMRequest || {},
                agentInput: data.agentInput || {},
                agentOutput: data.agentOutput || null,
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
                startedAt: data.startedAt?.toDate?.()?.toISOString?.() || null,
                finishedAt: data.finishedAt?.toDate?.()?.toISOString?.() || null,
                retryCount: data.retryCount || 0,
            } as AgentTask);
        },
        (error: FirestoreError) => {
            if (isIgnorableAbortLikeError(error)) return;
            console.error(`[subscribeToTask] listener failed for task ${taskId}:`, error);
            callback(null);
        }
    );
}
