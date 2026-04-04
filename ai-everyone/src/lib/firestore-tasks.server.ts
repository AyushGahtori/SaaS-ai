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
import {
    getAccessibleAgentIds,
    getAgentExecutionAuth,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import { getInstallHintForAgent } from "@/lib/agents/catalog";
import {
    interpretAgentError,
    normalizeAgentExecutionResult,
    type AgentExecutionContract,
} from "@/lib/agent-error";

// ---------------------------------------------------------------------------
// Agent routing map — maps agentId to its API endpoint path.
// Must match the routes defined in each agent's FastAPI server.
// ---------------------------------------------------------------------------

const AGENT_ROUTES: Record<string, string> = {
    "teams-agent":       "/teams/action",
    "email-agent":       "/email/action",
    "calendar-agent":    "/calendar/action",
    "todo-agent":        "/todo/action",
    "google-agent":      "/google/action",
    "notion-agent":      "/notion/action",
    "maps-agent":        "/maps/action",
    "emergency-response-agent": "/emergency/action",
    "strata-agent":      "/strata/action",
    // New integration agents
    "canva-agent":       "/canva/action",
    "day-planner-agent": "/dayplanner/action",
    "discord-agent":     "/discord/action",
    "dropbox-agent":     "/dropbox/action",
    "freshdesk-agent":   "/freshdesk/action",
    "github-agent":      "/github/action",
    "gitlab-agent":      "/gitlab/action",
    "greenhouse-agent":  "/greenhouse/action",
    "jira-agent":        "/jira/action",
    "linkedin-agent":    "/linkedin/action",
    "zoom-agent":        "/zoom/action",
};

async function persistInterpretedFailure(params: {
    taskRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
    task: AgentTask;
    rawError: string;
    originalResult?: Record<string, unknown>;
    incrementRetry?: boolean;
}): Promise<void> {
    const mergedAgentInput: Record<string, unknown> = {
        ...(params.task.agentInput || {}),
    };
    if (params.originalResult) {
        mergedAgentInput._agentResult = params.originalResult;
    }

    const interpreted = await interpretAgentError({
        agentId: params.task.agentId,
        rawError: params.rawError,
        agentInput: mergedAgentInput,
    });
    const nextStatus = interpreted.status;
    const isActionableFollowup = nextStatus === "needs_input" || nextStatus === "action_required";

    const payload: AgentExecutionContract = {
        ...interpreted,
        status: nextStatus,
        error_code: interpreted.code || "INTERPRETED_FAILURE",
        error_context: {
            raw_error: params.rawError,
            original_status:
                params.originalResult && typeof params.originalResult.status === "string"
                    ? params.originalResult.status
                    : null,
        },
        recommended_next_actions: interpreted.suggestedAction
            ? interpreted.suggestedInputs && interpreted.suggestedInputs.length > 0
                ? [interpreted.suggestedAction, `Needed input: ${interpreted.suggestedInputs.join(", ")}`]
                : [interpreted.suggestedAction]
            : [],
        ui_payload: {
            kind: "interpreted_failure",
            summary: interpreted.summary,
            suggestedAction: interpreted.suggestedAction || null,
            suggestedInputs: interpreted.suggestedInputs || [],
        },
        internal_payload: {
            rootCause: interpreted.rootCause,
            code: interpreted.code || null,
        },
        originalResult: params.originalResult || null,
    };

    await params.taskRef.update({
        status: nextStatus,
        agentOutput: payload,
        finishedAt: isActionableFollowup ? null : FieldValue.serverTimestamp(),
        retryCount: params.incrementRetry ? (params.task.retryCount || 0) + 1 : params.task.retryCount || 0,
    });
}

function extractRawErrorMessage(result: AgentExecutionContract): string {
    if (typeof result.error === "string" && result.error.trim()) {
        return result.error.trim();
    }
    if (typeof result.summary === "string" && result.summary.trim()) {
        return result.summary.trim();
    }
    if (
        result.error_context &&
        typeof result.error_context.raw_error === "string" &&
        result.error_context.raw_error.trim()
    ) {
        return result.error_context.raw_error.trim();
    }
    return "Agent execution failed.";
}

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
        await persistInterpretedFailure({
            taskRef,
            task,
            rawError: `Unknown agent: ${task.agentId}`,
            incrementRetry: false,
        });
        return;
    }

    const [installedAgentIds, accessibleAgentIds] = await Promise.all([
        getInstalledAgentIds(task.userId),
        getAccessibleAgentIds(task.userId),
    ]);

    if (!installedAgentIds.includes(task.agentId)) {
        await persistInterpretedFailure({
            taskRef,
            task,
            rawError: `Access denied. ${getInstallHintForAgent(task.agentId)}`,
            incrementRetry: false,
        });
        return;
    }

    if (!accessibleAgentIds.includes(task.agentId)) {
        await persistInterpretedFailure({
            taskRef,
            task,
            rawError: `Access denied. ${getInstallHintForAgent(task.agentId)}`,
            incrementRetry: false,
        });
        return;
    }

    // ── 2. Update status to "running" ─────────────────────────────────
    await taskRef.update({
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
    });

    // ── 3. Call the agent's FastAPI server ─────────────────────────────
    // Per-agent env override (falls back to AGENT_SERVER_URL → EC2 root)
    const ENV_AGENT_URL_MAP: Record<string, string | undefined> = {
        "teams-agent":       process.env.TEAMS_AGENT_URL,
        "email-agent":       process.env.TEAMS_AGENT_URL,
        "calendar-agent":    process.env.TEAMS_AGENT_URL,
        "todo-agent":        process.env.TODO_AGENT_URL,
        "google-agent":      process.env.GOOGLE_AGENT_URL,
        "notion-agent":      process.env.NOTION_AGENT_URL,
        "maps-agent":        process.env.MAPS_AGENT_URL,
        "emergency-response-agent": process.env.EMERGENCY_RESPONSE_AGENT_URL,
        "strata-agent":      process.env.STRATA_AGENT_URL,
        "canva-agent":       process.env.CANVA_AGENT_URL,
        "day-planner-agent": process.env.DAY_PLANNER_AGENT_URL,
        "discord-agent":     process.env.DISCORD_AGENT_URL,
        "dropbox-agent":     process.env.DROPBOX_AGENT_URL,
        "freshdesk-agent":   process.env.FRESHDESK_AGENT_URL,
        "github-agent":      process.env.GITHUB_AGENT_URL,
        "gitlab-agent":      process.env.GITLAB_AGENT_URL,
        "greenhouse-agent":  process.env.GREENHOUSE_AGENT_URL,
        "jira-agent":        process.env.JIRA_AGENT_URL,
        "linkedin-agent":    process.env.LINKEDIN_AGENT_URL,
        "zoom-agent":        process.env.ZOOM_AGENT_URL,
    };
    const agentServerUrl =
        ENV_AGENT_URL_MAP[task.agentId] ||
        process.env.AGENT_SERVER_URL ||
        "http://13.126.69.108";
    const agentUrl = `${agentServerUrl}${agentRoute}`;
    const executionAuth = await getAgentExecutionAuth(task.userId, task.agentId);

    console.log(`[executeAgentTask] Calling agent at ${agentUrl}`);

    try {
        const response = await fetch(agentUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: task.taskId,
                userId: task.userId,
                agentId: task.agentId,
                chatId: task.chatId,
                ...task.agentInput,
                ...executionAuth,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `[executeAgentTask] Agent returned ${response.status}`,
                errorText
            );
            await persistInterpretedFailure({
                taskRef,
                task,
                rawError: `Agent returned status ${response.status}: ${errorText}`,
                incrementRetry: true,
            });
            return;
        }

        const rawResult = (await response.json()) as unknown;
        const result = normalizeAgentExecutionResult(rawResult);
        console.log(`[executeAgentTask] Agent result`, result);

        // ── 4. Update task with result ────────────────────────────────
        if (result.status === "success" || result.status === "partial_success") {
            await taskRef.update({
                status: result.status,
                agentOutput: result,
                finishedAt: FieldValue.serverTimestamp(),
            });
        } else if (result.status === "action_required") {
            await taskRef.update({
                status: result.status,
                agentOutput: result,
                finishedAt: null,
            });
        } else if (result.status === "needs_input") {
            await persistInterpretedFailure({
                taskRef,
                task,
                rawError: extractRawErrorMessage(result),
                originalResult: result,
                incrementRetry: false,
            });
        } else {
            await persistInterpretedFailure({
                taskRef,
                task,
                rawError: extractRawErrorMessage(result),
                originalResult: result,
                incrementRetry: true,
            });
        }
    } catch (error: unknown) {
        console.error(`[executeAgentTask] Error calling agent`, error);

        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        const isConnectionError =
            errorMessage.includes("ECONNREFUSED") ||
            errorMessage.includes("fetch failed");

        await persistInterpretedFailure({
            taskRef,
            task,
            rawError: isConnectionError
                ? `Cannot connect to agent server at ${agentServerUrl}. Is the agent running?`
                : `Agent execution error: ${errorMessage}`,
            incrementRetry: true,
        });
    }
}
