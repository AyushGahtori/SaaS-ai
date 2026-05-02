import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createAgentTask, executeAgentTaskAndReadBack } from "@/lib/firestore-tasks.server";
import {
    getAccessibleAgentIds,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import {
    getAgentCatalogEntry,
    getInstallHintForAgent,
} from "@/lib/agents/catalog";
import { getMarketplaceAgentById } from "@/lib/agents/marketplace";
import { loadConversationContext } from "./context";
import {
    getActionCapability,
    getAgentCapability,
    deterministicRoute,
} from "./registry";
import { formatEntityChoices, resolveContextualEntities } from "./resolver";
import { compactString, normalizeForMatch, normalizeInput } from "./text";
import type {
    FailureState,
    LangGraphOrchestrationInput,
    LangGraphOrchestrationResult,
    LangGraphOrchestrationState,
    ValidationState,
} from "./types";

const emptyValidation: ValidationState = {
    is_valid: false,
    missing_fields: [],
    clarification_needed: false,
};

function makeInitialState(input: LangGraphOrchestrationInput): LangGraphOrchestrationState {
    return {
        user_input: input.userInput,
        normalized_input: "",
        chat_id: input.chatId,
        user_id: input.userId,
        model: input.model,
        llm_provider: input.llmProvider,
        installed_agent_ids: input.installedAgentIds || [],
        accessible_agent_ids: input.accessibleAgentIds || [],
        attachments: input.attachments || [],
        conversation_context: {
            recent_messages: input.recentMessages || [],
            recent_agent_tasks: [],
            recent_agent_outputs: {},
            entity_index: {
                gmail_emails: [],
                drive_files: [],
                todo_tasks: [],
                generic_items: [],
            },
            last_referenced_entity: null,
        },
        route: {
            target_agent: null,
            target_action: null,
            route_confidence: "low",
            route_reason: "",
            parameters: {},
            is_agent_request: false,
        },
        resolved_entities: {
            entity_source: "none",
            message_id: null,
            row_index: null,
            subject: null,
            sender: null,
            thread_id: null,
            matched_entity: null,
            candidate_entities: [],
        },
        validation: emptyValidation,
        agent_request: {},
        agent_response: null,
        created_task: null,
        final_response: "",
        status: "not_agent",
        failure: null,
        metadata: {},
        dry_run: input.dryRun,
    };
}

function failure(
    code: FailureState["code"],
    message: string,
    retryable = false,
    details?: Record<string, unknown>
): FailureState {
    return { code, message, retryable, details };
}

function isPresent(value: unknown): boolean {
    if (value === null || typeof value === "undefined") return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function firstAttachmentPayload(attachments?: Array<Record<string, unknown>>): Record<string, unknown> {
    const attachment = attachments?.find((item) => asString(item.dataBase64));
    if (!attachment) return {};

    const dataBase64 = asString(attachment.dataBase64);
    const mimeType = asString(attachment.mimeType);
    const name = asString(attachment.name);
    const payload: Record<string, unknown> = {
        file_data_url: dataBase64,
        file_name: name,
        file_type: mimeType,
    };

    if (mimeType.startsWith("image/")) payload.image_base64 = dataBase64;
    if (mimeType.startsWith("audio/")) payload.audio_base64 = dataBase64;
    if (mimeType.includes("csv") || name.toLowerCase().endsWith(".csv")) payload.csv = dataBase64;

    return payload;
}

function inferAgentErrorStatus(
    rawStatus: string,
    result: Record<string, unknown> | undefined
): FailureState | null {
    if (
        rawStatus === "queued" ||
        rawStatus === "running" ||
        rawStatus === "success" ||
        rawStatus === "partial_success" ||
        rawStatus === "action_required" ||
        rawStatus === "needs_input"
    ) {
        return null;
    }

    const text = compactString(result?.error || result?.summary || result?.message || "", 900).toLowerCase();
    if (text.includes("timed out") || text.includes("timeout") || text.includes("temporarily") || text.includes("429") || text.includes("503") || text.includes("504")) {
        return failure("retryable_agent_error", "The selected agent hit a retryable runtime issue. Please retry in a moment.", true);
    }
    if (text.includes("access denied") || text.includes("provider connection") || text.includes("auth") || text.includes("token")) {
        return failure("provider_error", "The selected agent needs a valid provider connection before it can run.", false);
    }
    if (text.includes("cannot connect") || text.includes("econnrefused") || text.includes("fetch failed")) {
        return failure("infrastructure_error", "The agent runtime could not be reached. Please check the EC2 agent service health.", true);
    }
    return failure("failed", "The selected agent returned a failure.", false);
}

async function buildUnavailableAgentMeta(agentId: string): Promise<Record<string, unknown> | undefined> {
    const marketplaceItem = await getMarketplaceAgentById(agentId);
    if (!marketplaceItem) return undefined;
    return {
        kind: "agent_install_suggestion",
        suggestion: {
            id: marketplaceItem.id,
            name: marketplaceItem.name,
            description: marketplaceItem.description,
            iconUrl: marketplaceItem.iconUrl,
            category: marketplaceItem.category,
            installCount: marketplaceItem.installCount,
            rating: marketplaceItem.rating,
            requiresConnection: marketplaceItem.requiresConnection,
            bundleId: marketplaceItem.bundleId,
            kind: marketplaceItem.kind,
        },
    };
}

function buildClarificationForValidation(state: LangGraphOrchestrationState): string {
    const route = state.route;
    const agentName = route.target_agent
        ? getAgentCatalogEntry(route.target_agent)?.name || route.target_agent
        : "the selected agent";

    if (state.status === "multiple_matches_found") {
        return [
            "I found more than one matching item. Which one should I use?",
            formatEntityChoices(state.resolved_entities.candidate_entities || []),
        ]
            .filter(Boolean)
            .join("\n");
    }

    if (state.status === "no_match_found") {
        const action = route.target_action || "this action";
        if (route.target_agent === "google-agent" && route.parameters.agent_type === "gmail") {
            const rows = state.conversation_context.entity_index.gmail_emails;
            if (rows.length > 0) {
                return [
                    "I could not match that email reference to the recent Gmail list. Please choose one of these rows:",
                    formatEntityChoices(rows),
                ].join("\n");
            }
            return "I need a Gmail message from a recent list before I can read or summarize a follow-up email. Ask me to retrieve recent emails first, or provide the exact email subject.";
        }
        return `I could not find the target needed for ${action}. Please provide the exact item or identifier.`;
    }

    if (state.validation.missing_fields.length > 0) {
        return `I can use ${agentName}, but I need: ${state.validation.missing_fields.join(", ")}.`;
    }

    if (state.failure?.message) return state.failure.message;
    return `I need one more detail before I can use ${agentName}.`;
}

function buildAgentRequest(state: LangGraphOrchestrationState): Record<string, unknown> {
    const params = {
        ...state.route.parameters,
        ...firstAttachmentPayload(state.attachments),
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
        conversation_context: state.conversation_context,
        resolved_entities: state.resolved_entities,
        orchestration: {
            engine: "langgraph",
            route: state.route,
            validation: state.validation,
        },
        ...(state.attachments && state.attachments.length > 0 ? { attachments: state.attachments } : {}),
    };
}

function shouldInlineGmailSummaryResponse(state: LangGraphOrchestrationState): boolean {
    if (state.route.target_agent !== "google-agent") return false;
    if (state.route.target_action !== "read_email") return false;
    if (String(state.route.parameters.agent_type || "").trim().toLowerCase() !== "gmail") return false;
    return /\b(summarize|summarise|summary|summery)\b/i.test(state.user_input);
}

function buildInlineAgentFinalResponse(state: LangGraphOrchestrationState): string {
    const summary = compactString(
        state.agent_response?.summary ||
        state.agent_response?.message ||
        state.agent_response?.error ||
        "",
        4000
    );

    if (summary) return summary;

    const action = state.route.target_action || "request";
    if (state.agent_response?.status === "needs_input") {
        return `I need one more detail before I can ${action.replace(/_/g, " ")}.`;
    }
    return `I completed the ${action.replace(/_/g, " ")} request.`;
}

function detectWrongAgentMismatch(state: LangGraphOrchestrationState): FailureState | null {
    const lower = normalizeForMatch(state.user_input);
    const agentId = state.route.target_agent;
    const explicitAgent = state.route.parameters.explicit_agent_mention;

    if (
        agentId === "google-agent" &&
        !explicitAgent &&
        /\b(fundraising|fundraise|funds?|investors?|seed investors?|vc|venture capital|pitch deck|term sheet|outreach email)\b/.test(lower)
    ) {
        return failure(
            "validation_error",
            "This is an investor/fundraising workflow, so I will not run Gmail for it. Please use Fund Agent for investor search and outreach."
        );
    }

    if (
        agentId === "shopgenie-agent" &&
        /\b(gtm|go to market|go-to-market|positioning|audience|channels?|market plan|company url)\b/.test(lower)
    ) {
        return failure(
            "validation_error",
            "This is a go-to-market strategy request, so I will not run ShopGenie for it. Please use Smart GTM Agent."
        );
    }

    if (
        agentId !== "emergency-response-agent" &&
        /\b(heart attack|stroke|chest pain|can't breathe|cannot breathe|severe injury|emergency|sos|ambulance|unconscious)\b/.test(lower)
    ) {
        return failure(
            "validation_error",
            "This looks like an emergency request, so I will not route it to a generic agent. Use Emergency Response Agent for emergency triage."
        );
    }

    return null;
}

const StateAnnotation = Annotation.Root({
    user_input: Annotation<string>(),
    normalized_input: Annotation<string>(),
    chat_id: Annotation<string>(),
    user_id: Annotation<string>(),
    model: Annotation<string | undefined>(),
    llm_provider: Annotation<string | undefined>(),
    installed_agent_ids: Annotation<string[]>(),
    accessible_agent_ids: Annotation<string[]>(),
    attachments: Annotation<Array<Record<string, unknown>> | undefined>(),
    conversation_context: Annotation<LangGraphOrchestrationState["conversation_context"]>(),
    route: Annotation<LangGraphOrchestrationState["route"]>(),
    resolved_entities: Annotation<LangGraphOrchestrationState["resolved_entities"]>(),
    validation: Annotation<ValidationState>(),
    agent_request: Annotation<Record<string, unknown>>(),
    agent_response: Annotation<Record<string, unknown> | null>(),
    created_task: Annotation<LangGraphOrchestrationState["created_task"]>(),
    final_response: Annotation<string>(),
    status: Annotation<LangGraphOrchestrationState["status"]>(),
    failure: Annotation<FailureState | null>(),
    metadata: Annotation<Record<string, unknown>>(),
    dry_run: Annotation<boolean | undefined>(),
});

type GraphState = typeof StateAnnotation.State;

async function inputNode(state: GraphState): Promise<Partial<GraphState>> {
    return {
        normalized_input: normalizeInput(state.user_input),
    };
}

async function contextLoaderNode(state: GraphState): Promise<Partial<GraphState>> {
    const [installedAgentIds, accessibleAgentIds, conversationContext] = await Promise.all([
        state.installed_agent_ids.length > 0
            ? Promise.resolve(state.installed_agent_ids)
            : getInstalledAgentIds(state.user_id),
        state.accessible_agent_ids.length > 0
            ? Promise.resolve(state.accessible_agent_ids)
            : getAccessibleAgentIds(state.user_id),
        loadConversationContext({
            userId: state.user_id,
            chatId: state.chat_id,
            recentMessages: state.conversation_context.recent_messages,
        }),
    ]);

    return {
        installed_agent_ids: installedAgentIds,
        accessible_agent_ids: accessibleAgentIds,
        conversation_context: conversationContext,
    };
}

async function deterministicRouterNode(state: GraphState): Promise<Partial<GraphState>> {
    const route = deterministicRoute(
        state.normalized_input || state.user_input,
        state.conversation_context
    );
    const attachmentPayload = firstAttachmentPayload(state.attachments);
    const routeWithAttachments = Object.keys(attachmentPayload).length
        ? {
            ...route,
            parameters: {
                ...route.parameters,
                ...attachmentPayload,
            },
        }
        : route;
    console.info("[LangGraphRoute]", {
        chatId: state.chat_id,
        userId: state.user_id,
        userInput: compactString(state.user_input, 500),
        targetAgent: routeWithAttachments.target_agent,
        targetAction: routeWithAttachments.target_action,
        confidence: routeWithAttachments.route_confidence,
        reason: routeWithAttachments.route_reason,
        explicitAgentMention: routeWithAttachments.parameters.explicit_agent_mention || null,
        correctionAgentMention: routeWithAttachments.parameters.correction_agent_mention || null,
    });
    return {
        route: routeWithAttachments,
        status: routeWithAttachments.is_agent_request ? "success" : "not_agent",
    };
}

async function entityResolverNode(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.route.is_agent_request) return {};
    const resolved = resolveContextualEntities(state);
    return {
        resolved_entities: resolved,
        route: {
            ...state.route,
            parameters: {
                ...state.route.parameters,
                ...(resolved.message_id
                    ? {
                        message_id: resolved.message_id,
                        row_index: resolved.row_index,
                    }
                    : {}),
            },
        },
    };
}

async function validationNode(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.route.is_agent_request || !state.route.target_agent || !state.route.target_action) {
        return {
            status: "not_agent",
            validation: {
                is_valid: false,
                missing_fields: [],
                clarification_needed: false,
                reason: "No deterministic agent route matched.",
            },
        };
    }

    const agent = getAgentCapability(state.route.target_agent);
    if (!agent) {
        return {
            status: "validation_error",
            validation: {
                is_valid: false,
                missing_fields: ["supported agent"],
                clarification_needed: true,
                reason: `Unknown agent: ${state.route.target_agent}`,
            },
            failure: failure("validation_error", `I could not find a registered agent named ${state.route.target_agent}.`),
        };
    }

    if (!state.installed_agent_ids.includes(agent.id)) {
        return {
            status: "needs_clarification",
            validation: {
                is_valid: false,
                missing_fields: ["agent installation"],
                clarification_needed: true,
                reason: "Agent is not installed.",
            },
            failure: failure("validation_error", getInstallHintForAgent(agent.id)),
            metadata: {
                ...state.metadata,
                install_meta: await buildUnavailableAgentMeta(agent.id),
            },
        };
    }

    if (!state.accessible_agent_ids.includes(agent.id)) {
        return {
            status: "needs_clarification",
            validation: {
                is_valid: false,
                missing_fields: ["provider connection"],
                clarification_needed: true,
                reason: "Agent is installed but not accessible.",
            },
            failure: failure("provider_error", getInstallHintForAgent(agent.id)),
            metadata: {
                ...state.metadata,
                install_meta: await buildUnavailableAgentMeta(agent.id),
            },
        };
    }

    const action = getActionCapability(agent.id, state.route.target_action);
    if (!action) {
        return {
            status: "validation_error",
            validation: {
                is_valid: false,
                missing_fields: ["supported action"],
                clarification_needed: true,
                reason: `${agent.id} does not support ${state.route.target_action}.`,
            },
            failure: failure("validation_error", `${agent.name} does not support action "${state.route.target_action}".`),
        };
    }

    const mismatchFailure = detectWrongAgentMismatch(state as LangGraphOrchestrationState);
    if (mismatchFailure) {
        return {
            status: "validation_error",
            validation: {
                is_valid: false,
                missing_fields: ["correct_agent"],
                clarification_needed: true,
                reason: mismatchFailure.message,
            },
            failure: mismatchFailure,
        };
    }

    if (
        agent.id === "google-agent" &&
        state.route.parameters.agent_type === "gmail" &&
        ["read_email", "mark_as_read", "reply_email"].includes(action.name)
    ) {
        const candidates = state.resolved_entities.candidate_entities || [];
        if (!state.resolved_entities.message_id && candidates.length > 1) {
            return {
                status: "multiple_matches_found",
                validation: {
                    is_valid: false,
                    missing_fields: ["message_id"],
                    clarification_needed: true,
                    reason: "Multiple Gmail rows matched the reference.",
                },
            };
        }

        if (!state.resolved_entities.message_id) {
            return {
                status: "no_match_found",
                validation: {
                    is_valid: false,
                    missing_fields: ["message_id"],
                    clarification_needed: true,
                    reason: "No deterministic Gmail row matched the reference.",
                },
            };
        }
    }

    const missingFields = action.required.filter((field) => !isPresent(state.route.parameters[field]));
    if (missingFields.length > 0) {
        return {
            status: "needs_clarification",
            validation: {
                is_valid: false,
                missing_fields: missingFields,
                clarification_needed: true,
                reason: "Required parameters are missing.",
            },
        };
    }

    const validation = {
        is_valid: true,
        missing_fields: [],
        clarification_needed: false,
        reason: "Capability and required parameters validated.",
    };

    return {
        status: "success",
        validation,
        agent_request: buildAgentRequest({
            ...(state as LangGraphOrchestrationState),
            validation,
        }),
    };
}

function afterValidation(state: GraphState): "agentExecution" | "response" {
    if (state.validation.is_valid && state.status === "success") return "agentExecution";
    return "response";
}

async function agentExecutionNode(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.route.target_agent || !state.route.target_action) return {};

    const agentName = getAgentCatalogEntry(state.route.target_agent)?.name || state.route.target_agent;
    const agentRequest = state.agent_request.action ? state.agent_request : buildAgentRequest(state as LangGraphOrchestrationState);

    if (state.dry_run) {
        return {
            agent_request: agentRequest,
            agent_response: {
                status: "success",
                summary: `[dry-run] ${agentName} would run ${state.route.target_action}.`,
                result: {
                    route: state.route,
                    resolved_entities: state.resolved_entities,
                    agent_request: agentRequest,
                },
            },
            status: "success",
        };
    }

    try {
        const parentLLMRequest: Record<string, unknown> = {
            agent_required: state.route.target_agent,
            action: state.route.target_action,
            parameters: state.route.parameters,
            reasoning: state.route.route_reason,
            routing_source: "langgraph",
            route: state.route,
            resolved_entities: state.resolved_entities,
        };

        const task = await createAgentTask({
            userId: state.user_id,
            chatId: state.chat_id,
            agentId: state.route.target_agent,
            parentLLMRequest,
            agentInput: agentRequest,
            flow: {
                orchestration: "langgraph",
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
            },
        });

        const { status: refreshedStatus, agentOutput: refreshedOutputMaybe } =
            await executeAgentTaskAndReadBack(task);
        const refreshedOutput =
            refreshedOutputMaybe || {
                status: "failed",
                summary: "The agent finished without a usable response.",
                error: "AGENT_OUTPUT_MISSING",
            };

        if (shouldInlineGmailSummaryResponse(state as LangGraphOrchestrationState)) {
            return {
                created_task: {
                    ...task,
                    status: refreshedStatus as typeof task.status,
                    agentOutput: refreshedOutput,
                },
                agent_response: refreshedOutput,
                status: refreshedStatus === "failed" ? "failed" : "success",
                failure: null,
                metadata: {
                    ...state.metadata,
                    render_as_chat: true,
                    inline_agent_task: true,
                },
            };
        }

        return {
            created_task: {
                ...task,
                status: refreshedStatus as typeof task.status,
                agentOutput: refreshedOutput,
            },
            agent_response: refreshedOutput,
            status: refreshedStatus === "failed" ? "failed" : "success",
            failure: null,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown orchestration execution error.";
        return {
            status: "infrastructure_error",
            failure: failure(
                "infrastructure_error",
                `The orchestration layer could not create or dispatch the agent task: ${message}`,
                true
            ),
            agent_response: {
                status: "failed",
                error: message,
            },
        };
    }
}

async function failureClassifierNode(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.validation.is_valid || !state.agent_response) return {};
    if (state.failure) return {};

    const rawStatus =
        (typeof state.created_task?.status === "string" ? state.created_task.status : "") ||
        (typeof state.agent_response.status === "string" ? state.agent_response.status : "");
    const agentFailure = inferAgentErrorStatus(rawStatus, state.agent_response);
    if (!agentFailure) return {};

    return {
        status: agentFailure.code,
        failure: agentFailure,
    };
}

async function responseNode(state: GraphState): Promise<Partial<GraphState>> {
    if (state.status === "not_agent") {
        return { final_response: "" };
    }

    if (state.metadata.render_as_chat === true && state.agent_response) {
        return {
            final_response: buildInlineAgentFinalResponse(state as LangGraphOrchestrationState),
        };
    }

    if (state.failure && state.status !== "success" && !state.created_task) {
        return { final_response: state.failure.message };
    }

    if (!state.validation.is_valid) {
        return {
            final_response: buildClarificationForValidation(state as LangGraphOrchestrationState),
        };
    }

    const agentName = state.route.target_agent
        ? getAgentCatalogEntry(state.route.target_agent)?.name || state.route.target_agent
        : "Agent";
    const content =
        `Delegating to ${agentName}.\n\n` +
        `Action: ${state.route.target_action}` +
        (state.route.route_reason ? `\n\nReasoning: ${state.route.route_reason}` : "");

    return { final_response: content };
}

async function persistenceNode(state: GraphState): Promise<Partial<GraphState>> {
    const taskId = state.created_task?.taskId;
    if (!taskId || state.dry_run) return {};

    try {
        await adminDb.collection("agentTasks").doc(taskId).set(
            {
                flow: {
                    orchestration: "langgraph",
                    status: state.status,
                    route: state.route,
                    resolved_entities: state.resolved_entities,
                    validation: state.validation,
                    failure: state.failure,
                    updatedAt: new Date().toISOString(),
                },
            },
            { merge: true }
        );
    } catch (error) {
        console.error("[LangGraphPersistence] failed to persist task flow:", error);
    }
    return {};
}

const graph = new StateGraph(StateAnnotation)
    .addNode("input", inputNode)
    .addNode("contextLoader", contextLoaderNode)
    .addNode("deterministicRouter", deterministicRouterNode)
    .addNode("entityResolver", entityResolverNode)
    .addNode("validate", validationNode)
    .addNode("agentExecution", agentExecutionNode)
    .addNode("classifyFailure", failureClassifierNode)
    .addNode("response", responseNode)
    .addNode("persistence", persistenceNode)
    .addEdge(START, "input")
    .addEdge("input", "contextLoader")
    .addEdge("contextLoader", "deterministicRouter")
    .addEdge("deterministicRouter", "entityResolver")
    .addEdge("entityResolver", "validate")
    .addConditionalEdges("validate", afterValidation, {
        agentExecution: "agentExecution",
        response: "response",
    })
    .addEdge("agentExecution", "classifyFailure")
    .addEdge("classifyFailure", "response")
    .addEdge("response", "persistence")
    .addEdge("persistence", END)
    .compile();

export async function runLangGraphOrchestration(
    input: LangGraphOrchestrationInput
): Promise<LangGraphOrchestrationResult> {
    const initialState = makeInitialState(input);
    const state = (await graph.invoke(initialState)) as LangGraphOrchestrationState;

    if (state.status === "not_agent") {
        return {
            handled: false,
            type: "chat",
            content: "",
            status: state.status,
            state,
        };
    }

    if (!state.validation.is_valid) {
        return {
            handled: true,
            type: "chat",
            content: state.final_response,
            status: state.status,
            meta: {
                kind: "orchestration_clarification",
                route: state.route,
                validation: state.validation,
                resolved_entities: state.resolved_entities,
                ...(state.metadata.install_meta && typeof state.metadata.install_meta === "object"
                    ? (state.metadata.install_meta as Record<string, unknown>)
                    : {}),
            },
            state,
        };
    }

    const task = state.created_task;
    if (!task && state.failure) {
        return {
            handled: true,
            type: "chat",
            content: state.final_response || state.failure.message,
            status: state.status,
            result: state.agent_response || undefined,
            meta: {
                kind: "orchestration_failure",
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
                failure: state.failure,
            },
            state,
        };
    }

    if (state.metadata.render_as_chat === true) {
        return {
            handled: true,
            type: "chat",
            content: state.final_response,
            status: (state.agent_response?.status as string | undefined) || state.status,
            result: state.agent_response || undefined,
            meta: {
                kind: "inline_agent_response",
                taskId: task?.taskId,
                agentId: state.route.target_agent || undefined,
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
                failure: state.failure,
            },
            state,
        };
    }

    return {
        handled: true,
        type: "agent_task",
        content: state.final_response,
        status: task?.status || (state.agent_response?.status as string | undefined) || state.status,
        taskId: task?.taskId,
        agentId: state.route.target_agent || undefined,
        result: state.agent_response || undefined,
        meta: {
            kind: "langgraph_agent_task",
            route: state.route,
            resolved_entities: state.resolved_entities,
            validation: state.validation,
            failure: state.failure,
        },
        state,
    };
}

export { graph as langGraphOrchestrator };
