import { getAgentCatalogEntry } from "@/lib/agents/catalog";
import { resolveWorkspaceIntakeWithLlm } from "@/lib/agents/workspace-intake";
import { getAgentWorkspacePrompt } from "@/lib/agents/workspace-prompts";
import { loadConversationContext } from "@/lib/orchestrator/langgraph/context";
import {
    chooseActionForAgent,
    enrichParameters,
    getActionCapability,
    getAgentCapability,
    type AgentCapability,
} from "@/lib/orchestrator/langgraph/registry";
import { resolveContextualEntities, formatEntityChoices } from "@/lib/orchestrator/langgraph/resolver";
import {
    compactString,
    getNumericRequestCount,
    normalizeForMatch,
    normalizeInput,
} from "@/lib/orchestrator/langgraph/text";
import type {
    ConversationContext,
    LangGraphOrchestrationState,
    RecentMessageContext,
    ResolvedEntities,
    RouteDecision,
    ValidationState,
} from "@/lib/orchestrator/langgraph/types";

interface WorkspaceRouteInput {
    userId: string;
    chatId: string;
    agentId: string;
    userInput: string;
    model?: string;
    llmProvider?: string;
    installedAgentIds: string[];
    accessibleAgentIds: string[];
    recentMessages?: RecentMessageContext[];
    attachments?: Array<Record<string, unknown>>;
}

export interface WorkspaceRouteSuccess {
    ok: true;
    agentId: string;
    agentName: string;
    action: string;
    route: RouteDecision;
    resolvedEntities: ResolvedEntities;
    validation: ValidationState;
    agentRequest: Record<string, unknown>;
    conversationContext: ConversationContext;
    reason: string;
}

export interface WorkspaceRouteBlocked {
    ok: false;
    status: "needs_clarification" | "validation_error" | "out_of_scope";
    content: string;
    meta?: Record<string, unknown>;
}

export type WorkspaceRouteResult = WorkspaceRouteSuccess | WorkspaceRouteBlocked;

function isPresent(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function getLatestTravelPlan(context: ConversationContext): { planMarkdown: string; threadId?: string } | null {
    for (const task of context.recent_agent_tasks) {
        if (asString(task.agentId) !== "travel-halper-agent") continue;

        const output = asRecord(task.output);
        if (asString(output.type) !== "travel_plan_result") continue;

        const result = asRecord(output.result);
        const planMarkdown = asString(result.planMarkdown);
        if (!planMarkdown) continue;

        const threadId = asString(result.threadId);
        return threadId ? { planMarkdown, threadId } : { planMarkdown };
    }

    const recentOutput = asRecord(context.recent_agent_outputs["travel-halper-agent"]);
    const result = asRecord(recentOutput.result);
    const planMarkdown = asString(result.planMarkdown);
    if (!planMarkdown) return null;

    const threadId = asString(result.threadId);
    return threadId ? { planMarkdown, threadId } : { planMarkdown };
}

function googleIntent(agentType: string, action: string, text: string, reason: string): RouteDecision {
    const count = getNumericRequestCount(text);
    const parameters: Record<string, unknown> = {
        agent_type: agentType,
        parameters: text,
        strict_resolution: true,
    };

    if (count && count > 0) {
        const limit = String(Math.min(count, 20));
        parameters.limit = limit;
        parameters.count = limit;
        parameters.maxResults = limit;
        parameters.pageSize = limit;
    }

    return {
        target_agent: "google-agent",
        target_action: action,
        route_confidence: "high",
        route_reason: reason,
        parameters,
        is_agent_request: true,
    };
}

function inferGmailAction(lower: string): string {
    if (/\b(mark|archive)\b.*\b(read|seen)\b/.test(lower)) return "mark_as_read";
    if (/\b(reply|respond)\b/.test(lower)) return "reply_email";
    if (/\b(search|find)\b/.test(lower)) return "search_emails";
    if (/\b(send|compose|mail|email)\b/.test(lower) && /\b(to|@)\b/.test(lower)) return "send_email";
    if (/\b(summarize|summarise|summary|read|open)\b/.test(lower) && getNumericRequestCount(lower) === null) return "read_email";
    return "list_emails";
}

function inferDriveAction(lower: string): string {
    if (/\b(search|find)\b/.test(lower)) return "search_files";
    if (/\b(read|summarize|summarise|summary|open)\b/.test(lower) && getNumericRequestCount(lower) === null) return "read_file";
    if (/\bpdf|pdfs\b/.test(lower)) return "list_pdf_files";
    return "list_files";
}

function extractSymbol(text: string): string | undefined {
    const companySymbols: Record<string, string> = {
        apple: "AAPL",
        microsoft: "MSFT",
        google: "GOOGL",
        alphabet: "GOOGL",
        amazon: "AMZN",
        tesla: "TSLA",
        meta: "META",
        facebook: "META",
        nvidia: "NVDA",
    };
    const lower = normalizeForMatch(text);
    for (const [name, symbol] of Object.entries(companySymbols)) {
        if (new RegExp(`\\b${name}\\b`).test(lower)) return symbol;
    }
    return text.match(/\b[A-Z]{2,5}\b/)?.[0];
}

function extractUrl(text: string): string | undefined {
    return text.match(/https?:\/\/[^\s)]+/i)?.[0];
}

function defaultRoute(agentId: string, action: string, text: string, reason: string): RouteDecision {
    return {
        target_agent: agentId,
        target_action: action,
        route_confidence: "high",
        route_reason: reason,
        parameters: enrichParameters(agentId, action, text, {
            prompt: text,
            parameters: text,
            query: text,
            raw_user_input: text,
            workspace_locked_agent: agentId,
        }),
        is_agent_request: true,
    };
}

function chooseGoogleRoute(text: string, lower: string): RouteDecision {
    if (/\b(drive|docs?|documents?|files?|folder|folders|pdf|pdfs)\b/.test(lower)) {
        return googleIntent("drive", inferDriveAction(lower), text, "Google Workspace route locked to Drive.");
    }
    if (/\b(calendar|agenda|events?)\b/.test(lower)) {
        return googleIntent(
            "calendar",
            /\b(create|schedule|add|book)\b/.test(lower) ? "create_event" : "list_events",
            text,
            "Google Workspace route locked to Calendar."
        );
    }
    if (/\b(meet|meeting link|video call)\b/.test(lower)) {
        return googleIntent("meet", "create_meet", text, "Google Workspace route locked to Meet.");
    }
    if (/\b(task|tasks|remind)\b/.test(lower)) {
        return googleIntent(
            "tasks",
            /\b(add|create|remind)\b/.test(lower) ? "create_task" : "list_tasks",
            text,
            "Google Workspace route locked to Tasks."
        );
    }
    return googleIntent("gmail", inferGmailAction(lower), text, "Google Workspace route locked to Gmail.");
}

function googleAgentTypeForAction(action: string): string {
    if (["list_files", "list_pdf_files", "read_file", "search_files"].includes(action)) return "drive";
    if (["list_events", "create_event"].includes(action)) return "calendar";
    if (action === "create_meet") return "meet";
    if (["list_tasks", "create_task"].includes(action)) return "tasks";
    if (action === "web_search") return "web_search";
    return "gmail";
}

function chooseWorkspaceRoute(agentId: string, text: string, context: ConversationContext): RouteDecision {
    const lower = normalizeForMatch(text);

    if (agentId === "google-agent") return chooseGoogleRoute(text, lower);

    if (agentId === "strata-agent") {
        const action = /\b(workspace|open)\b/.test(lower)
            ? "open_workspace"
            : /\b(dashboard|snapshot)\b/.test(lower)
                ? "dashboard"
                : /\b(trend|forecast)\b/.test(lower)
                    ? "trends"
                    : /\b(category|categories|breakdown)\b/.test(lower)
                        ? "categories"
                        : /\b(insight|why|explain|detail|details|price|process|data|stock)\b/.test(lower)
                            ? "ask"
                            : "ask";
        const params = enrichParameters(agentId, action, text, {
            prompt: text,
            parameters: text,
            question: text,
            ...(extractSymbol(text) ? { symbol: extractSymbol(text) } : {}),
        });
        return {
            target_agent: agentId,
            target_action: action,
            route_confidence: "high",
            route_reason: "Workspace locked to Stara Agent.",
            parameters: params,
            is_agent_request: true,
        };
    }

    if (agentId === "startup-fundraising-agent") {
        const action = /\b(term sheet|safe|valuation cap|pro rata)\b/.test(lower)
            ? "term_sheet_guidance"
            : /\b(track|update|follow up|pipeline|conversation)\b/.test(lower)
                ? "track_conversation"
                : /\b(outreach|email|message|draft|sequence)\b/.test(lower)
                    ? "plan_outreach"
                    : /\b(investor|investors|vc|funds?)\b/.test(lower) && /\b(find|search|list|identify)\b/.test(lower)
                        ? "search_investors"
                        : "generate_fundraising_plan";
        return defaultRoute(agentId, action, text, "Workspace locked to Fund Agent.");
    }

    if (agentId === "smart-gtm-agent") {
        const action =
            /\b(channel|channels|distribution|partnership|partner)\b/.test(lower) &&
            !/\b(go to market|go-to-market|gtm)\b/.test(lower)
                ? "channel"
                : /\b(gtm|go to market|go-to-market|positioning|audience|market plan|company url)\b/.test(lower)
                    ? "go_to_market"
                    : "research_company";
        return defaultRoute(agentId, action, text, "Workspace locked to Smart GTM Agent.");
    }

    if (agentId === "dia-helper-agent") {
        const hasExistingDiagram = context.last_agent_id === agentId;
        const action =
            hasExistingDiagram && /\b(update|edit|change|add|more detail|details|revise|try again)\b/.test(lower)
                ? "update_diagram"
                : "generate_diagram";
        return defaultRoute(agentId, action, text, "Workspace locked to Dia Helper.");
    }

    if (agentId === "emergency-response-agent") {
        return defaultRoute(agentId, "assess_emergency", text, "Workspace locked to Emergency Response Agent.");
    }

    const action = chooseActionForAgent(agentId, lower);
    return defaultRoute(agentId, action, text, `Workspace locked to ${getAgentCatalogEntry(agentId)?.name || agentId}.`);
}

function detectExplicitOtherAgentRequest(agentId: string, lower: string): string | null {
    const mentions: Array<[string, RegExp]> = [
        ["google-agent", /\b(gmail|google workspace|google agent)\b/],
        ["startup-fundraising-agent", /\b(funds? agent|fundraising agent|investor agent)\b/],
        ["smart-gtm-agent", /\b(smart gtm agent|gtm agent|go[-\s]?to[-\s]?market agent)\b/],
        ["shopgenie-agent", /\b(shopgenie agent|shop genie agent)\b/],
        ["dia-helper-agent", /\b(dia helper|diagram helper)\b/],
        ["emergency-response-agent", /\b(emergency agent|emergency response agent)\b/],
        ["strata-agent", /\b(stara agent|strata agent)\b/],
        ["dashboard-designer-agent", /\bdashboard designer\b/],
        ["seo-agent", /\bseo agent\b/],
        ["cyber-soc-agent", /\b(cyber soc agent|cyber soc|soc agent|cybersoc)\b/],
        ["shelfie-grocery-agent", /\b(shelfie grocery agent|shelfie agent|shelfie|grocery agent)\b/],
    ];

    for (const [mentionedAgentId, pattern] of mentions) {
        if (mentionedAgentId !== agentId && pattern.test(lower)) {
            return mentionedAgentId;
        }
    }
    return null;
}

function detectOutOfScope(agent: AgentCapability, text: string): WorkspaceRouteBlocked | null {
    const lower = normalizeForMatch(text);
    const explicitOtherAgent = detectExplicitOtherAgentRequest(agent.id, lower);
    if (explicitOtherAgent) {
        const otherName = getAgentCatalogEntry(explicitOtherAgent)?.name || explicitOtherAgent;
        return {
            ok: false,
            status: "out_of_scope",
            content: `This chat is locked to ${agent.name}. Open the ${otherName} workspace to use that agent.`,
        };
    }

    if (
        agent.id !== "emergency-response-agent" &&
        /\b(heart attack|stroke|chest pain|can't breathe|cannot breathe|severe injury|emergency|sos|ambulance|unconscious)\b/.test(lower)
    ) {
        return {
            ok: false,
            status: "out_of_scope",
            content: `This chat is locked to ${agent.name}. Emergency requests should use the Emergency Response Agent workspace.`,
        };
    }

    if (
        agent.id !== "google-agent" &&
        /\b(gmail|inbox|last emails?|latest emails?|last mails?|latest mails?|read my emails?|retrieve my emails?)\b/.test(lower)
    ) {
        return {
            ok: false,
            status: "out_of_scope",
            content: `This chat is locked to ${agent.name}. Email inbox work belongs in the Google Workspace Agent workspace.`,
        };
    }

    return null;
}

function buildState(input: {
    userId: string;
    chatId: string;
    userInput: string;
    model?: string;
    llmProvider?: string;
    installedAgentIds: string[];
    accessibleAgentIds: string[];
    attachments?: Array<Record<string, unknown>>;
    conversationContext: ConversationContext;
    route: RouteDecision;
    resolvedEntities: ResolvedEntities;
    validation: ValidationState;
}): LangGraphOrchestrationState {
    return {
        user_input: input.userInput,
        normalized_input: normalizeInput(input.userInput),
        chat_id: input.chatId,
        user_id: input.userId,
        model: input.model,
        llm_provider: input.llmProvider,
        installed_agent_ids: input.installedAgentIds,
        accessible_agent_ids: input.accessibleAgentIds,
        attachments: input.attachments,
        conversation_context: input.conversationContext,
        route: input.route,
        resolved_entities: input.resolvedEntities,
        validation: input.validation,
        agent_request: {},
        agent_response: null,
        created_task: null,
        final_response: "",
        status: "success",
        failure: null,
        metadata: {},
    };
}

function buildAgentRequest(state: LangGraphOrchestrationState): Record<string, unknown> {
    const params = {
        ...state.route.parameters,
        ...(state.resolved_entities.message_id
            ? {
                message_id: state.resolved_entities.message_id,
                row_index: state.resolved_entities.row_index,
            }
            : {}),
    };

    return {
        action: state.route.target_action,
        ...params,
        llm_provider: state.llm_provider,
        model: state.model,
        workspace_prompt: getAgentWorkspacePrompt(state.route.target_agent || ""),
        conversation_context: state.conversation_context,
        resolved_entities: state.resolved_entities,
        orchestration: {
            engine: "agent_workspace",
            route: state.route,
            validation: state.validation,
        },
        ...(state.attachments && state.attachments.length > 0 ? { attachments: state.attachments } : {}),
    };
}

function buildMissingFieldMessage(agentName: string, missingFields: string[]): string {
    return `I can use ${agentName}, but I need: ${missingFields.join(", ")}.`;
}

export async function resolveAgentWorkspaceRequest(
    input: WorkspaceRouteInput
): Promise<WorkspaceRouteResult> {
    const agent = getAgentCapability(input.agentId);
    if (!agent) {
        return {
            ok: false,
            status: "validation_error",
            content: "This agent is not registered in the workspace capability map.",
        };
    }

    const normalizedInput = normalizeInput(input.userInput);
    const outOfScope = detectOutOfScope(agent, normalizedInput);
    if (outOfScope) return outOfScope;

    const conversationContext = await loadConversationContext({
        userId: input.userId,
        chatId: input.chatId,
        recentMessages: input.recentMessages,
    });

    const route = chooseWorkspaceRoute(input.agentId, normalizedInput, conversationContext);
    const suggestedAction = route.target_action || agent.defaultAction;
    const intake = await resolveWorkspaceIntakeWithLlm({
        agentId: input.agentId,
        agentName: agent.name,
        action: suggestedAction,
        userInput: normalizedInput,
        context: conversationContext,
        model: input.model,
    });
    if (!intake.ok) {
        return {
            ok: false,
            status: intake.status === "out_of_scope" ? "out_of_scope" : "needs_clarification",
            content: intake.content || buildMissingFieldMessage(agent.name, intake.missingFields.map((field) => field.label)),
            meta: {
                selected_agent: input.agentId,
                selected_action: intake.action,
                missing_fields: intake.missingFields.map((field) => field.key),
                provided_fields: intake.values,
                intake_gate: "llm_structured_intake_blocked_before_agent_execution",
                validation_error: intake.validationError,
                reasoning: intake.reasoningSummary,
            },
        };
    }

    const action = intake.action;
    route.target_action = action;
    const actionCapability = getActionCapability(input.agentId, action);
    if (!actionCapability) {
        return {
            ok: false,
            status: "validation_error",
            content: `${agent.name} does not support action "${action}".`,
            meta: {
                selected_agent: input.agentId,
                selected_action: action,
            },
        };
    }
    route.parameters = {
        ...route.parameters,
        ...(intake.parameters || {}),
        intake_gate: {
            status: "complete",
            engine: "llm_structured_intake",
            values: intake.values,
            reasoning: intake.reasoningSummary,
        },
    };
    if (input.agentId === "travel-halper-agent" && action === "send_plan_email") {
        const recentPlan = getLatestTravelPlan(conversationContext);
        if (recentPlan && !isPresent(route.parameters.planMarkdown)) {
            route.parameters.planMarkdown = recentPlan.planMarkdown;
        }
        if (recentPlan?.threadId && !isPresent(route.parameters.threadId)) {
            route.parameters.threadId = recentPlan.threadId;
        }
    }
    if (input.agentId === "google-agent") {
        route.parameters.agent_type = googleAgentTypeForAction(action);
    }
    if (intake.reasoningSummary) {
        route.route_reason = `Workspace locked to ${agent.name}. ${intake.reasoningSummary}`;
    }

    const preliminaryState = buildState({
        userId: input.userId,
        chatId: input.chatId,
        userInput: normalizedInput,
        model: input.model,
        llmProvider: input.llmProvider,
        installedAgentIds: input.installedAgentIds,
        accessibleAgentIds: input.accessibleAgentIds,
        attachments: input.attachments,
        conversationContext,
        route,
        resolvedEntities: {
            entity_source: "none",
            message_id: null,
            row_index: null,
            subject: null,
            sender: null,
            thread_id: null,
            matched_entity: null,
            candidate_entities: [],
        },
        validation: {
            is_valid: false,
            missing_fields: [],
            clarification_needed: false,
        },
    });

    const resolvedEntities = resolveContextualEntities(preliminaryState);
    route.parameters = {
        ...route.parameters,
        ...(resolvedEntities.message_id
            ? {
                message_id: resolvedEntities.message_id,
                row_index: resolvedEntities.row_index,
            }
            : {}),
    };

    if (
        input.agentId === "google-agent" &&
        route.parameters.agent_type === "gmail" &&
        ["read_email", "mark_as_read", "reply_email"].includes(action)
    ) {
        const candidates = resolvedEntities.candidate_entities || [];
        if (!resolvedEntities.message_id && candidates.length > 1) {
            return {
                ok: false,
                status: "needs_clarification",
                content: `I found multiple matching emails. Which one should I use?\n${formatEntityChoices(candidates)}`,
            };
        }
        if (!resolvedEntities.message_id) {
            return {
                ok: false,
                status: "needs_clarification",
                content: "I need the exact email from the recent Google Workspace results. Try an index like \"first email\" or a sender/subject from the list.",
            };
        }
    }

    const missingFields = actionCapability.required.filter((field) => !isPresent(route.parameters[field]));
    if (missingFields.length > 0) {
        return {
            ok: false,
            status: "needs_clarification",
            content: buildMissingFieldMessage(agent.name, missingFields),
            meta: {
                selected_agent: input.agentId,
                selected_action: action,
                missing_fields: missingFields,
            },
        };
    }

    const validation: ValidationState = {
        is_valid: true,
        missing_fields: [],
        clarification_needed: false,
        reason: "Workspace agent, action, and parameters validated.",
    };

    const state = buildState({
        ...input,
        userInput: normalizedInput,
        conversationContext,
        route,
        resolvedEntities,
        validation,
    });

    const agentRequest = buildAgentRequest(state);
    const reason = compactString(route.route_reason, 240);

    return {
        ok: true,
        agentId: input.agentId,
        agentName: agent.name,
        action,
        route,
        resolvedEntities,
        validation,
        agentRequest,
        conversationContext,
        reason,
    };
}
