/**
 * Server-side Firestore operations for the "agentTasks" collection.
 * Uses Firebase Admin SDK, bypassing security rules.
 * DO NOT import this file into Client Components.
 *
 * Also handles direct agent execution for local development,
 * bypassing the Cloud Function trigger (which can't reach localhost).
 */

import { v4 as uuidv4 } from "uuid";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { AgentTask } from "./firestore-tasks";

// ---------------------------------------------------------------------------
// Agent routing map — maps agentId to its API endpoint path.
// Must match the routes defined in each agent's FastAPI server.
// ---------------------------------------------------------------------------

const AGENT_ROUTES: Record<string, string> = {
    "teams-agent": "/teams/action",
    // "email-agent": "/email/action",
};

/**
 * Create a new agent task in Firestore (server-side only).
 * Called from the /api/chat route when the parent LLM emits an agent intent.
 */
export async function createAgentTask(data: {
    userId: string;
    chatId: string;
    agentId: string;
    parentLLMRequest: Record<string, unknown>;
    agentInput: Record<string, unknown>;
}): Promise<AgentTask> {
    const taskId = uuidv4();

    const taskDoc: Omit<AgentTask, "createdAt"> & { createdAt: FieldValue } = {
        taskId,
        userId: data.userId,
        chatId: data.chatId,
        agentId: data.agentId,
        status: "queued",
        parentLLMRequest: data.parentLLMRequest,
        agentInput: data.agentInput,
        agentOutput: null,
        startedAt: null,
        finishedAt: null,
        retryCount: 0,
        createdAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection("agentTasks").doc(taskId).set(taskDoc);

    return {
        ...taskDoc,
        createdAt: new Date().toISOString(),
    } as AgentTask;
}

// ---------------------------------------------------------------------------
// Direct Agent Execution (local dev — bypasses Cloud Function)
// ---------------------------------------------------------------------------

/**
 * Execute an agent task by calling its FastAPI server directly.
 *
 * This replaces the Cloud Function trigger for local development:
 *  1. Updates status → "running"
 *  2. POSTs to the Python agent server
 *  3. Updates status → "success" or "failed" with agentOutput
 *
 * Called as a fire-and-forget from the API route so the response
 * is returned immediately while the task runs in the background.
 */
export async function executeAgentTask(task: AgentTask): Promise<void> {
    const taskRef = adminDb.collection("agentTasks").doc(task.taskId);

    // ── 1. Validate agent route ───────────────────────────────────────
    const agentRoute = AGENT_ROUTES[task.agentId];
    if (!agentRoute) {
        console.error(`[executeAgentTask] Unknown agent: ${task.agentId}`);
        await taskRef.update({
            status: "failed",
            agentOutput: { error: `Unknown agent: ${task.agentId}` },
            finishedAt: FieldValue.serverTimestamp(),
        });
        return;
    }

    // ── 2. Update status to "running" ─────────────────────────────────
    await taskRef.update({
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
    });

    // ── 3. Call the agent's FastAPI server ─────────────────────────────
    const agentServerUrl =
        process.env.AGENT_SERVER_URL || "http://host.docker.internal:8100";
    const agentUrl = `${agentServerUrl}${agentRoute}`;

    console.log(`[executeAgentTask] Calling agent at ${agentUrl}`);

    try {
        const response = await fetch(agentUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: task.taskId,
                userId: task.userId,
                agentId: task.agentId,
                ...task.agentInput,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `[executeAgentTask] Agent returned ${response.status}`,
                errorText
            );
            await taskRef.update({
                status: "failed",
                agentOutput: {
                    error: `Agent returned status ${response.status}: ${errorText}`,
                },
                finishedAt: FieldValue.serverTimestamp(),
                retryCount: (task.retryCount || 0) + 1,
            });
            return;
        }

        const result = await response.json();
        console.log(`[executeAgentTask] Agent result`, result);

        // ── 4. Update task with result ────────────────────────────────
        if (result.status === "success" || result.status === "action_required") {
            await taskRef.update({
                status: result.status,
                agentOutput: result,
                finishedAt: result.status === "success" ? FieldValue.serverTimestamp() : null, // leave unfinished if action_required
            });
        } else {
            await taskRef.update({
                status: "failed",
                agentOutput: result,
                finishedAt: FieldValue.serverTimestamp(),
                retryCount: (task.retryCount || 0) + 1,
            });
        }
    } catch (error: unknown) {
        console.error(`[executeAgentTask] Error calling agent`, error);

        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        const isConnectionError =
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("fetch failed");

        await taskRef.update({
            status: "failed",
            agentOutput: {
                error: isConnectionError
                    ? `Cannot connect to agent server at ${agentServerUrl}. Is the agent running?`
                    : `Agent execution error: ${errorMessage}`,
            },
            finishedAt: FieldValue.serverTimestamp(),
            retryCount: (task.retryCount || 0) + 1,
        });
    }
}
