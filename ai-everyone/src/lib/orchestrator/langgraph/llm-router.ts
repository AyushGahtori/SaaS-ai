import {
    AGENT_CATALOG,
    getAgentCatalogEntry,
    getInstallHintForAgent,
} from "@/lib/agents/catalog";
import { generateModelJson } from "@/lib/llm/server-model";
import {
    enrichParameters,
    getActionCapability,
    getAgentCapability,
} from "./registry";
import { compactString, getNumericRequestCount } from "./text";
import type {
    ConversationContext,
    OrchestrationStatus,
    RouteConfidence,
    RouteDecision,
} from "./types";

type ParentRouteDecision =
    | {
        decision: "direct_chat";
        responseStatus: "not_agent";
        assistantResponse: "";
        route: RouteDecision;
    }
    | {
        decision: "respond";
        responseStatus: OrchestrationStatus;
        assistantResponse: string;
        route: RouteDecision;
    }
    | {
        decision: "agent_request";
        responseStatus: "success";
        assistantResponse: "";
        route: RouteDecision;
    };

export interface ParentRepairDecision {
    decision: "retry" | "ask_user" | "respond";
    responseStatus: OrchestrationStatus;
    assistantResponse: string;
    route?: RouteDecision;
}

interface ParentRouterInput {
    userInput: string;
    model?: string;
    llmProvider?: string;
    installedAgentIds: string[];
    accessibleAgentIds: string[];
    conversationContext: ConversationContext;
}

interface ParentRepairInput extends ParentRouterInput {
    currentRoute: RouteDecision;
    agentResponse: Record<string, unknown> | null;
    validationError?: string;
    attempt: number;
}

const GOOGLE_ACTION_AGENT_TYPE: Record<string, string> = {
    list_emails: "gmail",
    search_emails: "gmail",
    read_email: "gmail",
    send_email: "gmail",
    reply_email: "gmail",
    mark_as_read: "gmail",
    list_files: "drive",
    list_pdf_files: "drive",
    search_files: "drive",
    read_file: "drive",
    list_events: "calendar",
    create_event: "calendar",
    create_meet: "meet",
    list_tasks: "tasks",
    create_task: "tasks",
    web_search: "web_search",
};

const GOOGLE_LIMIT_FIELDS = ["limit", "count", "maxResults", "pageSize"] as const;

function noRoute(reason = "No parent LLM route selected."): RouteDecision {
    return {
        target_agent: null,
        target_action: null,
        route_confidence: "low",
        route_reason: reason,
        parameters: {},
        is_agent_request: false,
    };
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => asString(item)).filter(Boolean);
}

function toConfidence(value: unknown): RouteConfidence {
    if (value === "high" || value === "medium" || value === "low") return value;
    return "medium";
}

function toResponseStatus(value: unknown): OrchestrationStatus {
    const raw = asString(value);
    if (
        raw === "success" ||
        raw === "not_agent" ||
        raw === "needs_clarification" ||
        raw === "no_match_found" ||
        raw === "multiple_matches_found" ||
        raw === "retryable_agent_error" ||
        raw === "provider_error" ||
        raw === "infrastructure_error" ||
        raw === "validation_error" ||
        raw === "failed"
    ) {
        return raw;
    }
    return "failed";
}

function clampCandidateAgentIds(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
        if (!id || seen.has(id) || !getAgentCatalogEntry(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= 3) break;
    }
    return out;
}

function cleanGoogleLimitValue(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed > 0) return String(Math.floor(parsed));
        return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return String(Math.floor(value));
    }
    return null;
}

function normalizeGoogleParameters(
    action: string,
    userInput: string,
    parameters: Record<string, unknown>
): Record<string, unknown> {
    const next = { ...parameters };
    const agentType = GOOGLE_ACTION_AGENT_TYPE[action];
    if (agentType) {
        next.agent_type = agentType;
    }

    const requestedCount =
        getNumericRequestCount(userInput) ??
        getNumericRequestCount(asString(next.parameters));
    const resolvedCount =
        cleanGoogleLimitValue(next.limit) ||
        cleanGoogleLimitValue(next.count) ||
        cleanGoogleLimitValue(next.maxResults) ||
        cleanGoogleLimitValue(next.pageSize) ||
        (typeof requestedCount === "number" && requestedCount > 0
            ? String(Math.min(requestedCount, 20))
            : null);

    if (resolvedCount) {
        for (const field of GOOGLE_LIMIT_FIELDS) {
            next[field] = resolvedCount;
        }
    }

    if (!asString(next.parameters)) {
        next.parameters = userInput;
    }

    if (["read_email", "reply_email", "mark_as_read"].includes(action)) {
        next.strict_resolution = true;
    }

    return next;
}

function normalizeProposedRoute(
    userInput: string,
    rawRoute: Record<string, unknown>,
    reasonFallback: string
): RouteDecision {
    const agentId =
        asString(rawRoute.agent_id) ||
        asString(rawRoute.target_agent) ||
        asString(rawRoute.agent);
    const action =
        asString(rawRoute.action) ||
        asString(rawRoute.target_action);
    const parameters = asRecord(
        rawRoute.parameters ||
        rawRoute.params ||
        rawRoute.arguments ||
        rawRoute.input
    );

    if (!agentId || !action || !getAgentCapability(agentId) || !getActionCapability(agentId, action)) {
        return noRoute(reasonFallback);
    }

    let normalizedParameters = enrichParameters(agentId, action, userInput, parameters);
    if (agentId === "google-agent") {
        normalizedParameters = normalizeGoogleParameters(action, userInput, normalizedParameters);
    }

    return {
        target_agent: agentId,
        target_action: action,
        route_confidence: toConfidence(rawRoute.confidence),
        route_reason: asString(rawRoute.reasoning) || reasonFallback,
        parameters: normalizedParameters,
        is_agent_request: true,
    };
}

function buildRecentContext(context: ConversationContext): Record<string, unknown> {
    const recentAgentOutputs = Object.fromEntries(
        Object.entries(context.recent_agent_outputs || {})
            .slice(0, 8)
            .map(([key, value]) => {
                const output = asRecord(value);
                const result = asRecord(output.result);
                const resultPreview =
                    typeof result === "object" && Object.keys(result).length > 0
                        ? compactString(JSON.stringify(result), 320)
                        : null;
                const emails = Array.isArray(output.emails) ? output.emails.length : undefined;
                const files = Array.isArray(output.files) ? output.files.length : undefined;

                return [
                    key,
                    {
                        status: asString(output.status) || null,
                        action: asString(output.action) || null,
                        type: asString(output.type) || null,
                        summary: compactString(output.summary, 220),
                        ...(typeof emails === "number" ? { email_count: emails } : {}),
                        ...(typeof files === "number" ? { file_count: files } : {}),
                        ...(resultPreview ? { result_preview: resultPreview } : {}),
                    },
                ];
            })
    );

    return {
        recent_messages: context.recent_messages.slice(-10).map((message) => ({
            role: message.role,
            content: compactString(message.content, 220),
            taskId: message.taskId || null,
            agentId: message.agentId || null,
        })),
        entity_index: {
            gmail_emails: context.entity_index.gmail_emails.slice(0, 10).map((item) => ({
                index: item.index,
                message_id: item.message_id || item.id,
                sender: item.sender || null,
                subject: item.subject || null,
                snippet: compactString(item.snippet, 160),
            })),
            drive_files: context.entity_index.drive_files.slice(0, 10).map((item) => ({
                index: item.index,
                file_id: item.id,
                name: item.name || item.title || null,
                type: item.snippet || null,
            })),
            todo_tasks: context.entity_index.todo_tasks.slice(0, 10).map((item) => ({
                index: item.index,
                id: item.id,
                title: item.title || item.name || null,
                date: item.date || null,
            })),
        },
        recent_agent_outputs: recentAgentOutputs,
        last_agent_id: context.last_agent_id || null,
        last_action: context.last_action || null,
        last_referenced_entity: context.last_referenced_entity || null,
    };
}

function buildCompactCatalog(input: ParentRouterInput): Array<Record<string, unknown>> {
    const installed = new Set(input.installedAgentIds);
    const accessible = new Set(input.accessibleAgentIds);

    return AGENT_CATALOG.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        tags: agent.tags.slice(0, 6),
        installed: installed.has(agent.id),
        accessible: accessible.has(agent.id),
        requiresConnection: agent.requiresConnection,
        actions: agent.actions.slice(0, 12),
        examplePrompts: agent.examplePrompts.slice(0, 2),
        installHint: getInstallHintForAgent(agent.id),
    }));
}

function buildActionManifest(agentId: string): Array<Record<string, unknown>> {
    const capability = getAgentCapability(agentId);
    if (!capability) return [];

    return (Object.values(capability.actions) as Array<{
        name: string;
        required: string[];
        optional: string[];
        entityType?: string;
    }>).map((action) => ({
        name: action.name,
        required: action.required,
        optional: action.optional,
        entityType: action.entityType || null,
        googleAgentType:
            agentId === "google-agent" ? GOOGLE_ACTION_AGENT_TYPE[action.name] || null : null,
    }));
}

function buildDetailedManifest(
    agentId: string,
    input: ParentRouterInput
): Record<string, unknown> {
    const catalog = getAgentCatalogEntry(agentId);
    const capability = getAgentCapability(agentId);

    return {
        id: agentId,
        name: catalog?.name || agentId,
        description: catalog?.description || "",
        provider: catalog?.provider || "internal",
        requiresConnection: catalog?.requiresConnection || false,
        installed: input.installedAgentIds.includes(agentId),
        accessible: input.accessibleAgentIds.includes(agentId),
        installHint: getInstallHintForAgent(agentId),
        defaultAction: capability?.defaultAction || null,
        examplePrompts: catalog?.examplePrompts || [],
        actions: buildActionManifest(agentId),
        executionRules:
            agentId === "google-agent"
                ? [
                    "For Gmail and Drive list actions, set limit/count/maxResults/pageSize as whole-number strings like \"5\".",
                    "Never send 5.0 for Google limits. Use \"5\".",
                    "For Gmail read/reply/mark actions, include message_id when a recent entity match is available.",
                    "Use only these Google agent_type values: gmail, drive, calendar, meet, tasks, web_search.",
                ]
                : [
                    "Use only actions and fields present in this manifest.",
                    "If a required field is genuinely missing, ask the user for that field instead of inventing it.",
                ],
    };
}

async function callParentJson(params: {
    model?: string;
    llmProvider?: string;
    prompt: string;
}): Promise<Record<string, unknown> | null> {
    const first = await generateModelJson({
        model: params.model,
        llmProvider: params.llmProvider,
        messages: [{ role: "user", content: params.prompt }],
        temperature: 0,
    }).catch((error) => {
        console.warn("[ParentRouter] JSON generation failed", {
            model: params.model,
            provider: params.llmProvider,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    });

    if (first?.parsed) return first.parsed;

    const repairPrompt = [
        params.prompt,
        "Your previous response was not valid JSON for this controller.",
        "Return ONLY a single valid JSON object now. No markdown, no prose.",
        first?.text ? `Previous invalid response:\n${first.text}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");

    const second = await generateModelJson({
        model: params.model,
        llmProvider: params.llmProvider,
        messages: [{ role: "user", content: repairPrompt }],
        temperature: 0,
    }).catch((error) => {
        console.warn("[ParentRouter] JSON repair generation failed", {
            model: params.model,
            provider: params.llmProvider,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    });

    return second?.parsed || null;
}

async function selectCandidateAgentIds(
    input: ParentRouterInput
): Promise<string[] | null> {
    const prompt = [
        "You are Pian's parent orchestration controller.",
        "Your job in this step is only to decide whether the request should stay as direct chat or be delegated to one or more candidate agents.",
        "Rules:",
        "1. Use direct_chat for normal conversation, explanation, brainstorming, or general knowledge that does not need external accounts, live user data, or a specialist agent workflow.",
        "2. Use agent_request for actions, account data retrieval, connected-app work, or internal specialist workflows.",
        "3. You may shortlist an unavailable agent if that is the correct product capability; the next step will explain install or connection requirements.",
        "4. Return at most 3 candidate agent ids from the catalog.",
        "5. Never invent agent ids.",
        "Return ONLY JSON with this shape:",
        '{"decision":"direct_chat|agent_request","candidate_agent_ids":["agent-id"],"reasoning":"..."}',
        `User request:\n${input.userInput}`,
        `Recent context:\n${JSON.stringify(buildRecentContext(input.conversationContext), null, 2)}`,
        `Compact agent catalog:\n${JSON.stringify(buildCompactCatalog(input), null, 2)}`,
    ].join("\n\n");

    const parsed = await callParentJson({
        model: input.model,
        llmProvider: input.llmProvider,
        prompt,
    });
    if (!parsed) return null;

    if (asString(parsed.decision) === "direct_chat") {
        return [];
    }

    return clampCandidateAgentIds(asStringArray(parsed.candidate_agent_ids));
}

export async function routeWithParentLlm(
    input: ParentRouterInput
): Promise<ParentRouteDecision | null> {
    const candidateAgentIds = await selectCandidateAgentIds(input);
    if (candidateAgentIds === null) return null;
    if (candidateAgentIds.length === 0) {
        return {
            decision: "direct_chat",
            responseStatus: "not_agent",
            assistantResponse: "",
            route: noRoute("Parent LLM selected direct chat."),
        };
    }

    const prompt = [
        "You are Pian's parent orchestration controller.",
        "In this step, you must either prepare exactly one agent request or respond to the user yourself.",
        "Rules:",
        "1. Never invent agents, actions, or parameter names outside the provided manifests.",
        "2. If the best capability is not installed or not accessible, do not prepare a broken request. Respond politely with what the user needs to install or connect.",
        "3. If one specific detail is missing or ambiguous, ask only for that detail.",
        "4. If the recent context already resolves the target clearly, use that context instead of asking again.",
        "5. For Google list actions, limit/count/maxResults/pageSize must be whole-number strings like \"5\".",
        "6. Never mention JSON, validation, backend prompts, task cards, or internal errors.",
        "Return ONLY JSON with this shape:",
        '{"decision":"direct_chat|agent_request|respond","response_status":"not_agent|needs_clarification|validation_error|provider_error|infrastructure_error|failed","assistant_response":"...","route":{"agent_id":"...","action":"...","confidence":"high|medium|low","reasoning":"...","parameters":{}}}',
        `User request:\n${input.userInput}`,
        `Recent context:\n${JSON.stringify(buildRecentContext(input.conversationContext), null, 2)}`,
        `Detailed candidate manifests:\n${JSON.stringify(candidateAgentIds.map((id) => buildDetailedManifest(id, input)), null, 2)}`,
    ].join("\n\n");

    const parsed = await callParentJson({
        model: input.model,
        llmProvider: input.llmProvider,
        prompt,
    });
    if (!parsed) return null;

    const decision = asString(parsed.decision);
    if (decision === "direct_chat") {
        return {
            decision: "direct_chat",
            responseStatus: "not_agent",
            assistantResponse: "",
            route: noRoute("Parent LLM selected direct chat after detailed review."),
        };
    }

    if (decision === "respond") {
        return {
            decision: "respond",
            responseStatus: toResponseStatus(parsed.response_status || "failed"),
            assistantResponse:
                asString(parsed.assistant_response) ||
                "I could not route that request cleanly right now. Please try again.",
            route: noRoute("Parent LLM decided to respond without delegating."),
        };
    }

    const route = normalizeProposedRoute(
        input.userInput,
        asRecord(parsed.route),
        asString(parsed.reasoning) || "Parent LLM prepared an agent request."
    );

    if (!route.is_agent_request || !route.target_agent || !route.target_action) {
        return {
            decision: "respond",
            responseStatus: "validation_error",
            assistantResponse:
                asString(parsed.assistant_response) ||
                "I need one more detail before I can send that to an agent.",
            route: noRoute("Parent LLM route was invalid after normalization."),
        };
    }

    return {
        decision: "agent_request",
        responseStatus: "success",
        assistantResponse: "",
        route,
    };
}

export async function repairRouteWithParentLlm(
    input: ParentRepairInput
): Promise<ParentRepairDecision | null> {
    const agentId = input.currentRoute.target_agent;
    const action = input.currentRoute.target_action;
    if (!agentId || !action) return null;

    const prompt = [
        "You are Pian's parent orchestration repair controller.",
        "A previous agent preparation or execution did not complete cleanly.",
        "Decide one of three outcomes:",
        "1. retry: you can fix the payload yourself without asking the user again.",
        "2. ask_user: a real missing or ambiguous user detail is required.",
        "3. respond: the environment, permissions, provider, timeout, or service health issue should be explained to the user without retrying.",
        "Rules:",
        "1. Retry only when the fix is internal and concrete.",
        "2. Never mention payload JSON, cards, backend prompts, or validation internals.",
        "3. If the issue is installation, authentication, permissions, rate limit, timeout, or server connectivity, do not retry with the same request. Explain it politely.",
        "4. For Google list actions, limit/count/maxResults/pageSize must be whole-number strings like \"5\".",
        "Return ONLY JSON with this shape:",
        '{"decision":"retry|ask_user|respond","response_status":"needs_clarification|validation_error|provider_error|infrastructure_error|retryable_agent_error|failed","assistant_response":"...","route":{"agent_id":"...","action":"...","confidence":"high|medium|low","reasoning":"...","parameters":{}}}',
        `Attempt number: ${input.attempt}`,
        `Original user request:\n${input.userInput}`,
        `Current route:\n${JSON.stringify(input.currentRoute, null, 2)}`,
        input.validationError ? `Validation error:\n${input.validationError}` : "",
        `Agent response:\n${JSON.stringify(input.agentResponse || {}, null, 2)}`,
        `Detailed manifest:\n${JSON.stringify(buildDetailedManifest(agentId, input), null, 2)}`,
        `Recent context:\n${JSON.stringify(buildRecentContext(input.conversationContext), null, 2)}`,
    ]
        .filter(Boolean)
        .join("\n\n");

    const parsed = await callParentJson({
        model: input.model,
        llmProvider: input.llmProvider,
        prompt,
    });
    if (!parsed) return null;

    const decision = asString(parsed.decision);
    if (decision === "retry") {
        const route = normalizeProposedRoute(
            input.userInput,
            asRecord(parsed.route),
            asString(parsed.reasoning) || "Parent LLM repaired the route."
        );
        if (!route.is_agent_request) {
            return {
                decision: "ask_user",
                responseStatus: "needs_clarification",
                assistantResponse:
                    asString(parsed.assistant_response) ||
                    "I need one more detail before I can retry that.",
            };
        }
        return {
            decision: "retry",
            responseStatus: "retryable_agent_error",
            assistantResponse: "",
            route,
        };
    }

    if (decision === "ask_user") {
        return {
            decision: "ask_user",
            responseStatus: toResponseStatus(parsed.response_status || "needs_clarification"),
            assistantResponse:
                asString(parsed.assistant_response) ||
                "I need one more detail before I can continue.",
        };
    }

    return {
        decision: "respond",
        responseStatus: toResponseStatus(parsed.response_status || "failed"),
        assistantResponse:
            asString(parsed.assistant_response) ||
            "I could not complete that request right now. Please try again.",
    };
}
