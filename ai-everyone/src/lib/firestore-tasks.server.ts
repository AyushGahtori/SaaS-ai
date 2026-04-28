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
import { resolveAgentServerUrl } from "@/lib/agent-server-url";
import {
    interpretAgentError,
    normalizeAgentExecutionResult,
    type AgentExecutionContract,
} from "@/lib/agent-error";
import { AGENT_ENDPOINTS } from "@/lib/orchestrator/langgraph/registry";

const DEFAULT_AGENT_HTTP_TIMEOUT_MS = Number(process.env.AGENT_HTTP_TIMEOUT_MS || 45000);
const AGENT_HTTP_TIMEOUT_OVERRIDES_MS: Record<string, number> = {
    "seo-agent": Number(process.env.SEO_AGENT_HTTP_TIMEOUT_MS || 120000),
};

function getAgentHttpTimeoutMs(agentId: string): number {
    const override = AGENT_HTTP_TIMEOUT_OVERRIDES_MS[agentId];
    const timeout = Number.isFinite(override) && override > 0 ? override : DEFAULT_AGENT_HTTP_TIMEOUT_MS;
    return timeout;
}

function sanitizeForFirestore(value: unknown): unknown {
    if (typeof value === "undefined") return undefined;
    if (value === null) return null;
    if (Array.isArray(value)) {
        return value.map((item) => {
            const sanitized = sanitizeForFirestore(item);
            return typeof sanitized === "undefined" ? null : sanitized;
        });
    }
    if (typeof value === "object") {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return value;

        const next: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            const sanitized = sanitizeForFirestore(item);
            if (typeof sanitized !== "undefined") {
                next[key] = sanitized;
            }
        }
        return next;
    }
    return value;
}

function sanitizeRecordForFirestore(record: Record<string, unknown>): Record<string, unknown> {
    return sanitizeForFirestore(record) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent routing map â€” maps agentId to its API endpoint path.
// Must match the routes defined in each agent's FastAPI server.
// ---------------------------------------------------------------------------

const AGENT_ROUTES: Record<string, string> = AGENT_ENDPOINTS;

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

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function asText(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function extractMermaidLabels(mermaid: string): string[] {
    const labels = Array.from(mermaid.matchAll(/[\[\(\{]([^{}\[\]\(\)]{2,120})[\]\)\}]/g))
        .map((match) => asText(match[1]).toLowerCase())
        .filter(Boolean);
    return Array.from(new Set(labels));
}

function isStructurallyEmptyMermaid(mermaid: string): boolean {
    const lines = mermaid.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return true;
    const header = lines[0].toLowerCase();
    const isFlowchart = header.startsWith("flowchart") || header.startsWith("graph");
    if (isFlowchart) {
        const hasEdge = lines.slice(1).some((line) => line.includes("-->") || line.includes("---"));
        if (!hasEdge) return true;
        const labels = extractMermaidLabels(mermaid);
        if (labels.length < 2) return true;
        if (labels.length === 1 && /^(add more details|update step|request diagram|diagram)$/.test(labels[0])) return true;
        return false;
    }
    if (header.startsWith("sequencediagram")) {
        return !lines.slice(1).some((line) => line.includes("->"));
    }
    if (header.startsWith("statediagram-v2")) {
        return !lines.slice(1).some((line) => line.includes("-->"));
    }
    if (header.startsWith("gantt")) {
        return lines.length <= 2;
    }
    return false;
}

function validateAgentSuccessOutput(task: AgentTask, result: AgentExecutionContract): { valid: true } | { valid: false; reason: string; code: string } {
    const outputResult = asRecord(result.result);
    const summary = asText(result.summary || result.message);
    const hasResultPayload = Object.keys(outputResult).length > 0;
    const route = asRecord(asRecord(task.flow).route);
    const targetAction = asText(task.agentInput?.action || route.target_action || result.action);

    if (!summary && !hasResultPayload) {
        return {
            valid: false,
            code: "EMPTY_AGENT_OUTPUT",
            reason: "The selected agent returned success without a usable payload.",
        };
    }

    if (task.agentId === "dia-helper-agent") {
        const mermaid = asText(outputResult.mermaid);
        if (isStructurallyEmptyMermaid(mermaid)) {
            return {
                valid: false,
                code: "EMPTY_DIAGRAM_OUTPUT",
                reason: "Dia Helper returned an empty or placeholder Mermaid diagram.",
            };
        }
    }

    if (task.agentId === "smart-gtm-agent") {
        const sections = Array.isArray(outputResult.sections) ? outputResult.sections : [];
        const takeaways = Array.isArray(outputResult.keyTakeaways) ? outputResult.keyTakeaways : [];
        const markdown = asText(outputResult.reportMarkdown);
        if (targetAction === "go_to_market" && sections.length === 0 && takeaways.length === 0 && !markdown) {
            return {
                valid: false,
                code: "INVALID_GTM_OUTPUT",
                reason: "Smart GTM returned success without a go-to-market report structure.",
            };
        }
    }

    if (task.agentId === "startup-fundraising-agent") {
        const investors = Array.isArray(outputResult.investors) ? outputResult.investors : [];
        const shortlist = Array.isArray(outputResult.shortlist) ? outputResult.shortlist : [];
        const sequence = Array.isArray(outputResult.sequence) ? outputResult.sequence : [];
        const nextSteps = Array.isArray(outputResult.next_steps) ? outputResult.next_steps : [];
        if (investors.length === 0 && shortlist.length === 0 && sequence.length === 0 && nextSteps.length === 0) {
            return {
                valid: false,
                code: "INVALID_FUND_OUTPUT",
                reason: "Fund Agent returned success without investor, outreach, or fundraising-plan content.",
            };
        }
    }

    return { valid: true };
}

/**
 * Create a new agent task in Firestore (server-side only).
 * Called by the LangGraph orchestrator after deterministic routing and validation.
 */
export async function createAgentTask(data: {
    userId: string;
    chatId: string;
    agentId: string;
    parentLLMRequest: Record<string, unknown>;
    agentInput: Record<string, unknown>;
    flow?: Record<string, unknown>;
}): Promise<AgentTask> {
    const taskId = uuidv4();

    const taskDoc: Omit<AgentTask, "createdAt"> & { createdAt: FieldValue } = {
        taskId,
        userId: data.userId,
        chatId: data.chatId,
        agentId: data.agentId,
        status: "queued",
        parentLLMRequest: sanitizeRecordForFirestore(data.parentLLMRequest),
        agentInput: sanitizeRecordForFirestore(data.agentInput),
        ...(data.flow ? { flow: sanitizeRecordForFirestore(data.flow) } : {}),
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
// Direct Agent Execution (local dev â€” bypasses Cloud Function)
// ---------------------------------------------------------------------------

/**
 * Execute an agent task by calling its FastAPI server directly.
 *
 * This replaces the Cloud Function trigger for local development:
 *  1. Updates status â†’ "running"
 *  2. POSTs to the Python agent server
 *  3. Updates status â†’ "success" or "failed" with agentOutput
 *
 * Called as a fire-and-forget from the API route so the response
 * is returned immediately while the task runs in the background.
 */
export async function executeAgentTask(task: AgentTask): Promise<void> {
    const taskRef = adminDb.collection("agentTasks").doc(task.taskId);

    // â”€â”€ 1. Validate agent route â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    let installedAgentIds: string[] = [];
    let accessibleAgentIds: string[] = [];
    try {
        [installedAgentIds, accessibleAgentIds] = await Promise.all([
            getInstalledAgentIds(task.userId),
            getAccessibleAgentIds(task.userId),
        ]);
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown access-check error";
        await persistInterpretedFailure({
            taskRef,
            task,
            rawError: `Agent execution setup failed: ${errorMessage}`,
            incrementRetry: true,
        });
        return;
    }

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

    // â”€â”€ 2. Update status to "running" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await taskRef.update({
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
    });

    // â”€â”€ 3. Call the agent's FastAPI server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Per-agent env override (falls back to AGENT_SERVER_URL â†’ EC2 root)
    const ENV_AGENT_URL_MAP: Record<string, string | undefined> = {
        "teams-agent": process.env.TEAMS_AGENT_URL,
        "email-agent": process.env.TEAMS_AGENT_URL,
        "calendar-agent": process.env.TEAMS_AGENT_URL,
        "todo-agent": process.env.TODO_AGENT_URL,
        "google-agent": process.env.GOOGLE_AGENT_URL,
        "notion-agent": process.env.NOTION_AGENT_URL,
        "maps-agent": process.env.MAPS_AGENT_URL,
        "emergency-response-agent": process.env.EMERGENCY_RESPONSE_AGENT_URL,
        "strata-agent": process.env.STRATA_AGENT_URL,
        "canva-agent": process.env.CANVA_AGENT_URL,
        "day-planner-agent": process.env.DAY_PLANNER_AGENT_URL,
        "discord-agent": process.env.DISCORD_AGENT_URL,
        "dropbox-agent": process.env.DROPBOX_AGENT_URL,
        "freshdesk-agent": process.env.FRESHDESK_AGENT_URL,
        "github-agent": process.env.GITHUB_AGENT_URL,
        "gitlab-agent": process.env.GITLAB_AGENT_URL,
        "greenhouse-agent": process.env.GREENHOUSE_AGENT_URL,
        "jira-agent": process.env.JIRA_AGENT_URL,
        "linkedin-agent": process.env.LINKEDIN_AGENT_URL,
        "zoom-agent": process.env.ZOOM_AGENT_URL,
        "dia-helper-agent": process.env.DIA_HELPER_AGENT_URL,
        "shopgenie-agent": process.env.SHOPGENIE_AGENT_URL,
        "career-switch-agent": process.env.CAREER_SWITCH_AGENT_URL,
        "startup-fundraising-agent": process.env.STARTUP_FUNDRAISING_AGENT_URL,
        "smart-gtm-agent": process.env.SMART_GTM_AGENT_URL,
        "seo-agent": process.env.SEO_AGENT_URL,
        "dashboard-designer-agent": process.env.DASHBOARD_DESIGNER_AGENT_URL,
        "ats-agent": process.env.ATS_AGENT_URL,
        "building-construction-agent": process.env.BUILDING_CONSTRUCTION_AGENT_URL,
        "lms-agent": process.env.LMS_AGENT_URL,
        "travel-halper-agent": process.env.TRAVEL_HALPER_AGENT_URL,
        "devika-engineer-agent": process.env.DEVIKA_ENGINEER_AGENT_URL,
        "data-analyst-agent": process.env.DATA_ANALYST_AGENT_URL,
    };
    const agentServerUrl =
        resolveAgentServerUrl(ENV_AGENT_URL_MAP[task.agentId], task.agentId);
    const agentUrl = `${agentServerUrl}${agentRoute}`;
    const executionAuth = await getAgentExecutionAuth(task.userId, task.agentId);

    console.log(`[executeAgentTask] Calling agent at ${agentUrl}`);

    try {
        const controller = new AbortController();
        const agentTimeoutMs = getAgentHttpTimeoutMs(task.agentId);
        const timeout = setTimeout(() => controller.abort(), agentTimeoutMs);
        let response: Response;
        try {
            response = await fetch(agentUrl, {
                method: "POST",
                signal: controller.signal,
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
        } finally {
            clearTimeout(timeout);
        }

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

        // â”€â”€ 4. Update task with result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (result.status === "success" || result.status === "partial_success") {
            const outputValidation = validateAgentSuccessOutput(task, result);
            if (!outputValidation.valid) {
                console.warn("[executeAgentTask] Agent output failed validation", {
                    taskId: task.taskId,
                    agentId: task.agentId,
                    action: task.agentInput?.action,
                    code: outputValidation.code,
                    reason: outputValidation.reason,
                });
                await taskRef.update({
                    status: "failed",
                    agentOutput: {
                        ...result,
                        status: "failed",
                        error_code: outputValidation.code,
                        error: outputValidation.reason,
                        summary: outputValidation.reason,
                        error_context: {
                            ...asRecord(result.error_context),
                            output_validation_failed: true,
                            original_status: result.status,
                            agent_id: task.agentId,
                            action: task.agentInput?.action || null,
                        },
                    },
                    finishedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

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
            await taskRef.update({
                status: result.status,
                agentOutput: result,
                finishedAt: null,
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
            errorMessage.includes("fetch failed") ||
            errorMessage.toLowerCase().includes("abort");
        const isAbortError = errorMessage.toLowerCase().includes("abort");

        await persistInterpretedFailure({
            taskRef,
            task,
            rawError: isAbortError
                ? `Agent request timed out after ${getAgentHttpTimeoutMs(task.agentId)}ms while waiting for ${task.agentId}.`
                : isConnectionError
                    ? `Cannot connect to agent server at ${agentServerUrl}. Is the agent running and healthy?`
                : `Agent execution error: ${errorMessage}`,
            incrementRetry: true,
        });
    }
}
