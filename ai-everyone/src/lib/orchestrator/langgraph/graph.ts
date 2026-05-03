import { adminDb } from "@/lib/firebase-admin";
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
} from "./registry";
import { resolveContextualEntities, formatEntityChoices } from "./resolver";
import {
    repairRouteWithParentLlm,
    routeWithParentLlm,
} from "./llm-router";
import { compactString, normalizeInput } from "./text";
import type {
    FailureState,
    LangGraphOrchestrationInput,
    LangGraphOrchestrationResult,
    LangGraphOrchestrationState,
    ValidationState,
} from "./types";

const MAX_REPAIR_ATTEMPTS = Math.max(
    0,
    Number(process.env.PARENT_ORCHESTRATOR_REPAIR_ATTEMPTS || 2)
);

const emptyValidation: ValidationState = {
    is_valid: false,
    missing_fields: [],
    clarification_needed: false,
};

function elapsedMs(startedAt: number): number {
    return Date.now() - startedAt;
}

function previewLogText(value: unknown, maxLength = 420): string | null {
    if (typeof value !== "string") return null;
    const compact = value.replace(/\s+/g, " ").trim();
    if (!compact) return "";
    return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function orchestrationTraceId(state: LangGraphOrchestrationState): string | null {
    return typeof state.metadata.trace_id === "string" ? state.metadata.trace_id : null;
}

function orchestrationLog(
    state: LangGraphOrchestrationState,
    stage: string,
    details: Record<string, unknown> = {}
): void {
    const traceId = orchestrationTraceId(state);
    if (!traceId) return;
    console.log(`[chat:${traceId}] ${stage}`, details);
}

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
        metadata: input.traceId ? { trace_id: input.traceId } : {},
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

function inferAgentErrorStatus(
    rawStatus: string,
    result: Record<string, unknown> | undefined
): FailureState | null {
    if (
        rawStatus === "queued" ||
        rawStatus === "running" ||
        rawStatus === "success" ||
        rawStatus === "partial_success"
    ) {
        return null;
    }

    const text = compactString(result?.error || result?.summary || result?.message || "", 900).toLowerCase();
    if (
        text.includes("timed out") ||
        text.includes("timeout") ||
        text.includes("temporarily") ||
        text.includes("429") ||
        text.includes("503") ||
        text.includes("504")
    ) {
        return failure(
            "retryable_agent_error",
            "I tried that agent, but it hit a temporary runtime issue. Please try again in a moment.",
            true
        );
    }
    if (
        text.includes("access denied") ||
        text.includes("provider connection") ||
        text.includes("auth") ||
        text.includes("token")
    ) {
        return failure(
            "provider_error",
            "That agent needs a valid provider connection before it can run.",
            false
        );
    }
    if (
        text.includes("cannot connect") ||
        text.includes("econnrefused") ||
        text.includes("fetch failed")
    ) {
        return failure(
            "infrastructure_error",
            "I could not reach the agent service right now. Please try again in a moment.",
            true
        );
    }
    if (rawStatus === "needs_input") {
        return failure(
            "needs_clarification",
            compactString(result?.summary || result?.message || "", 700) ||
                "I need one more detail before I can continue.",
            false
        );
    }
    if (rawStatus === "action_required") {
        return failure(
            "provider_error",
            compactString(result?.summary || result?.message || "", 700) ||
                "This action needs an additional account or permission step before I can continue.",
            false
        );
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
        return `I can use ${agentName}, but I still need: ${state.validation.missing_fields.join(", ")}.`;
    }

    if (state.failure?.message) return state.failure.message;
    return `I need one more detail before I can use ${agentName}.`;
}

function buildAgentRequest(state: LangGraphOrchestrationState): Record<string, unknown> {
    const params = {
        ...state.route.parameters,
        ...(state.resolved_entities.message_id && !state.route.parameters.message_id
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
            engine: "parent_llm",
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

function applyEntityResolution(state: LangGraphOrchestrationState): LangGraphOrchestrationState {
    if (!state.route.is_agent_request) return state;

    const resolved = resolveContextualEntities(state);
    return {
        ...state,
        resolved_entities: resolved,
        route: {
            ...state.route,
            parameters: {
                ...state.route.parameters,
                ...(resolved.message_id && !state.route.parameters.message_id
                    ? {
                        message_id: resolved.message_id,
                        row_index: resolved.row_index,
                    }
                    : {}),
            },
        },
    };
}

async function loadStateContext(
    state: LangGraphOrchestrationState
): Promise<LangGraphOrchestrationState> {
    const startedAt = Date.now();
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

    orchestrationLog(state, "orchestrator.context.loaded", {
        durationMs: elapsedMs(startedAt),
        installedAgentCount: installedAgentIds.length,
        accessibleAgentCount: accessibleAgentIds.length,
        recentMessageCount: conversationContext.recent_messages.length,
        recentAgentTaskCount: conversationContext.recent_agent_tasks.length,
    });

    return {
        ...state,
        normalized_input: normalizeInput(state.user_input),
        installed_agent_ids: installedAgentIds,
        accessible_agent_ids: accessibleAgentIds,
        conversation_context: conversationContext,
    };
}

async function runParentRoutePlanning(
    state: LangGraphOrchestrationState
): Promise<LangGraphOrchestrationState> {
    const startedAt = Date.now();
    orchestrationLog(state, "orchestrator.route_model.started", {
        model: state.model,
        provider: state.llm_provider,
        userQuery: previewLogText(state.user_input),
    });

    const decision = await routeWithParentLlm({
        userInput: state.user_input,
        model: state.model,
        llmProvider: state.llm_provider,
        installedAgentIds: state.installed_agent_ids,
        accessibleAgentIds: state.accessible_agent_ids,
        conversationContext: state.conversation_context,
    });

    if (!decision) {
        orchestrationLog(state, "orchestrator.route_model.failed", {
            durationMs: elapsedMs(startedAt),
            reason: "No decision returned by parent route model.",
        });
        return {
            ...state,
            status: "infrastructure_error",
            failure: failure(
                "infrastructure_error",
                "I could not start the parent orchestration model right now. Please try again."
            ),
            final_response:
                "I could not start the parent orchestration model right now. Please try again.",
        };
    }

    orchestrationLog(state, "orchestrator.route_model.completed", {
        durationMs: elapsedMs(startedAt),
        decision: decision.decision,
        status: decision.responseStatus || "success",
        targetAgent: decision.route.target_agent,
        targetAction: decision.route.target_action,
        confidence: decision.route.route_confidence,
        reason: previewLogText(decision.route.route_reason),
    });

    if (decision.decision === "direct_chat") {
        return {
            ...state,
            route: decision.route,
            status: "not_agent",
        };
    }

    if (decision.decision === "respond") {
        return {
            ...state,
            route: decision.route,
            status: decision.responseStatus,
            final_response: decision.assistantResponse,
            failure:
                decision.responseStatus === "not_agent"
                    ? null
                    : failure(
                        decision.responseStatus,
                        decision.assistantResponse || "I could not complete that request right now."
                    ),
        };
    }

    return {
        ...state,
        route: decision.route,
        status: "success",
    };
}

async function validateRoute(
    state: LangGraphOrchestrationState
): Promise<LangGraphOrchestrationState> {
    const startedAt = Date.now();
    if (!state.route.is_agent_request || !state.route.target_agent || !state.route.target_action) {
        orchestrationLog(state, "orchestrator.route.validated", {
            durationMs: elapsedMs(startedAt),
            valid: false,
            status: "not_agent",
        });
        return {
            ...state,
            status: "not_agent",
            validation: {
                is_valid: false,
                missing_fields: [],
                clarification_needed: false,
                reason: "No parent-LLM agent route matched.",
            },
        };
    }

    const agent = getAgentCapability(state.route.target_agent);
    if (!agent) {
        orchestrationLog(state, "orchestrator.route.validated", {
            durationMs: elapsedMs(startedAt),
            valid: false,
            status: "validation_error",
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            reason: `Unknown agent: ${state.route.target_agent}`,
        });
        return {
            ...state,
            status: "validation_error",
            validation: {
                is_valid: false,
                missing_fields: ["supported agent"],
                clarification_needed: true,
                reason: `Unknown agent: ${state.route.target_agent}`,
            },
            failure: failure(
                "validation_error",
                `I could not find a registered agent named ${state.route.target_agent}.`
            ),
        };
    }

    if (!state.installed_agent_ids.includes(agent.id)) {
        orchestrationLog(state, "orchestrator.route.validated", {
            durationMs: elapsedMs(startedAt),
            valid: false,
            status: "needs_clarification",
            targetAgent: agent.id,
            targetAction: state.route.target_action,
            reason: "Agent is not installed.",
        });
        return {
            ...state,
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
        orchestrationLog(state, "orchestrator.route.validated", {
            durationMs: elapsedMs(startedAt),
            valid: false,
            status: "needs_clarification",
            targetAgent: agent.id,
            targetAction: state.route.target_action,
            reason: "Agent is installed but not accessible.",
        });
        return {
            ...state,
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
        orchestrationLog(state, "orchestrator.route.validated", {
            durationMs: elapsedMs(startedAt),
            valid: false,
            status: "validation_error",
            targetAgent: agent.id,
            targetAction: state.route.target_action,
            reason: `${agent.id} does not support ${state.route.target_action}.`,
        });
        return {
            ...state,
            status: "validation_error",
            validation: {
                is_valid: false,
                missing_fields: ["supported action"],
                clarification_needed: true,
                reason: `${agent.id} does not support ${state.route.target_action}.`,
            },
            failure: failure(
                "validation_error",
                `${agent.name} does not support action "${state.route.target_action}".`
            ),
        };
    }

    if (
        agent.id === "google-agent" &&
        state.route.parameters.agent_type === "gmail" &&
        ["read_email", "mark_as_read", "reply_email"].includes(action.name)
    ) {
        const candidates = state.resolved_entities.candidate_entities || [];
        if (!state.resolved_entities.message_id && candidates.length > 1) {
            orchestrationLog(state, "orchestrator.route.validated", {
                durationMs: elapsedMs(startedAt),
                valid: false,
                status: "multiple_matches_found",
                targetAgent: agent.id,
                targetAction: action.name,
                candidateCount: candidates.length,
            });
            return {
                ...state,
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
            orchestrationLog(state, "orchestrator.route.validated", {
                durationMs: elapsedMs(startedAt),
                valid: false,
                status: "no_match_found",
                targetAgent: agent.id,
                targetAction: action.name,
            });
            return {
                ...state,
                status: "no_match_found",
                validation: {
                    is_valid: false,
                    missing_fields: ["message_id"],
                    clarification_needed: true,
                    reason: "No Gmail row matched the reference.",
                },
            };
        }
    }

    const missingFields = action.required.filter((field) => !isPresent(state.route.parameters[field]));
    if (missingFields.length > 0) {
        orchestrationLog(state, "orchestrator.route.validated", {
            durationMs: elapsedMs(startedAt),
            valid: false,
            status: "needs_clarification",
            targetAgent: agent.id,
            targetAction: action.name,
            missingFields,
        });
        return {
            ...state,
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

    orchestrationLog(state, "orchestrator.route.validated", {
        durationMs: elapsedMs(startedAt),
        valid: true,
        targetAgent: agent.id,
        targetAction: action.name,
    });

    return {
        ...state,
        status: "success",
        validation,
        failure: null,
        agent_request: buildAgentRequest({
            ...state,
            validation,
        }),
    };
}

function buildRepairValidationError(state: LangGraphOrchestrationState): string {
    if (state.failure?.message) return state.failure.message;
    if (state.validation.reason) return state.validation.reason;
    if (state.validation.missing_fields.length > 0) {
        return `Missing required field(s): ${state.validation.missing_fields.join(", ")}`;
    }
    return `Validation failed with status ${state.status}.`;
}

async function repairInvalidRouteIfPossible(
    state: LangGraphOrchestrationState
): Promise<LangGraphOrchestrationState> {
    if (state.validation.is_valid || !state.route.is_agent_request) return state;

    let workingState = state;
    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
        const repair = await repairRouteWithParentLlm({
            userInput: workingState.user_input,
            model: workingState.model,
            llmProvider: workingState.llm_provider,
            installedAgentIds: workingState.installed_agent_ids,
            accessibleAgentIds: workingState.accessible_agent_ids,
            conversationContext: workingState.conversation_context,
            currentRoute: workingState.route,
            agentResponse: null,
            validationError: buildRepairValidationError(workingState),
            attempt,
        });

        if (!repair) return workingState;

        if (repair.decision === "retry" && repair.route) {
            workingState = applyEntityResolution({
                ...workingState,
                route: repair.route,
                validation: emptyValidation,
                failure: null,
                final_response: "",
                status: "success",
            });
            workingState = await validateRoute(workingState);
            if (workingState.validation.is_valid) return workingState;
            continue;
        }

        return {
            ...workingState,
            status: repair.responseStatus,
            final_response: repair.assistantResponse,
            failure: failure(
                repair.responseStatus,
                repair.assistantResponse || buildClarificationForValidation(workingState)
            ),
        };
    }

    return workingState;
}

async function executeCurrentRoute(
    state: LangGraphOrchestrationState
): Promise<LangGraphOrchestrationState> {
    if (!state.route.target_agent || !state.route.target_action) return state;

    const startedAt = Date.now();
    const agentName = getAgentCatalogEntry(state.route.target_agent)?.name || state.route.target_agent;
    const agentRequest =
        state.agent_request.action ? state.agent_request : buildAgentRequest(state);

    if (state.dry_run) {
        return {
            ...state,
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
        orchestrationLog(state, "orchestrator.agent_task.creating", {
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            actionParameters: state.route.parameters,
        });

        const parentLLMRequest: Record<string, unknown> = {
            agent_required: state.route.target_agent,
            action: state.route.target_action,
            parameters: state.route.parameters,
            reasoning: state.route.route_reason,
            routing_source: "parent_llm",
            traceId: orchestrationTraceId(state),
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
                orchestration: "parent_llm",
                traceId: orchestrationTraceId(state),
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
            },
        });

        orchestrationLog(state, "orchestrator.agent_task.created", {
            durationMs: elapsedMs(startedAt),
            taskId: task.taskId,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
        });

        const agentStartedAt = Date.now();
        orchestrationLog(state, "orchestrator.agent_call.started", {
            taskId: task.taskId,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
        });

        const { status: refreshedStatus, agentOutput: refreshedOutputMaybe } =
            await executeAgentTaskAndReadBack(task);
        const refreshedOutput =
            refreshedOutputMaybe || {
                status: "failed",
                summary: "The agent finished without a usable response.",
                error: "AGENT_OUTPUT_MISSING",
            };

        orchestrationLog(state, "orchestrator.agent_call.completed", {
            durationMs: elapsedMs(agentStartedAt),
            totalExecutionMs: elapsedMs(startedAt),
            taskId: task.taskId,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            status: refreshedStatus,
            summary: previewLogText(refreshedOutput.summary || refreshedOutput.message || refreshedOutput.error),
        });

        if (shouldInlineGmailSummaryResponse(state)) {
            return {
                ...state,
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
            ...state,
            created_task: {
                ...task,
                status: refreshedStatus as typeof task.status,
                agentOutput: refreshedOutput,
            },
            agent_response: refreshedOutput,
            status:
                refreshedStatus === "success" || refreshedStatus === "partial_success"
                    ? "success"
                    : refreshedStatus === "needs_input"
                        ? "needs_clarification"
                        : refreshedStatus === "action_required"
                            ? "provider_error"
                            : refreshedStatus === "running" || refreshedStatus === "queued"
                                ? "success"
                                : "failed",
            failure: inferAgentErrorStatus(refreshedStatus, refreshedOutput),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown orchestration execution error.";
        orchestrationLog(state, "orchestrator.agent_call.failed", {
            durationMs: elapsedMs(startedAt),
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            error: message,
        });
        return {
            ...state,
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

function deriveUserFacingAgentMessage(state: LangGraphOrchestrationState): string {
    return (
        compactString(
            state.agent_response?.summary ||
            state.agent_response?.message ||
            state.agent_response?.error ||
            "",
            1200
        ) ||
        state.failure?.message ||
        "I could not complete that request right now."
    );
}

async function executeWithRepairLoop(
    state: LangGraphOrchestrationState
): Promise<LangGraphOrchestrationState> {
    let workingState = state;

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
        workingState = {
            ...workingState,
            agent_request: buildAgentRequest(workingState),
        };
        workingState = await executeCurrentRoute(workingState);

        const rawStatus =
            (typeof workingState.created_task?.status === "string" ? workingState.created_task.status : "") ||
            (typeof workingState.agent_response?.status === "string" ? workingState.agent_response.status : "");

        if (
            rawStatus === "success" ||
            rawStatus === "partial_success" ||
            (!rawStatus && workingState.status === "success")
        ) {
            return workingState;
        }

        if (attempt >= MAX_REPAIR_ATTEMPTS) {
            return {
                ...workingState,
                final_response:
                    workingState.final_response || deriveUserFacingAgentMessage(workingState),
            };
        }

        const repair = await repairRouteWithParentLlm({
            userInput: workingState.user_input,
            model: workingState.model,
            llmProvider: workingState.llm_provider,
            installedAgentIds: workingState.installed_agent_ids,
            accessibleAgentIds: workingState.accessible_agent_ids,
            conversationContext: workingState.conversation_context,
            currentRoute: workingState.route,
            agentResponse: workingState.agent_response,
            attempt: attempt + 1,
        });

        if (!repair) {
            return {
                ...workingState,
                final_response:
                    workingState.final_response || deriveUserFacingAgentMessage(workingState),
            };
        }

        if (repair.decision === "retry" && repair.route) {
            workingState = applyEntityResolution({
                ...workingState,
                route: repair.route,
                validation: {
                    is_valid: true,
                    missing_fields: [],
                    clarification_needed: false,
                    reason: "Parent LLM repaired the route after an agent error.",
                },
                failure: null,
                final_response: "",
                status: "success",
                metadata: {
                    ...workingState.metadata,
                    repair_attempts: attempt + 1,
                },
            });
            continue;
        }

        return {
            ...workingState,
            status: repair.responseStatus,
            final_response:
                repair.assistantResponse || deriveUserFacingAgentMessage(workingState),
            failure: failure(
                repair.responseStatus,
                repair.assistantResponse || deriveUserFacingAgentMessage(workingState)
            ),
        };
    }

    return workingState;
}

async function persistTaskFlow(state: LangGraphOrchestrationState): Promise<void> {
    const taskId = state.created_task?.taskId;
    if (!taskId || state.dry_run) return;

    try {
        await adminDb.collection("agentTasks").doc(taskId).set(
            {
                flow: {
                    orchestration: "parent_llm",
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
        console.error("[ParentLlmPersistence] failed to persist task flow:", error);
    }
}

async function orchestrate(
    input: LangGraphOrchestrationInput
): Promise<LangGraphOrchestrationState> {
    const startedAt = Date.now();
    let state = makeInitialState(input);
    orchestrationLog(state, "orchestrator.started", {
        chatId: state.chat_id,
        model: state.model,
        provider: state.llm_provider,
        userQuery: previewLogText(state.user_input),
    });
    state = await loadStateContext(state);
    state = await runParentRoutePlanning(state);

    if (state.status !== "success" || !state.route.is_agent_request) {
        orchestrationLog(state, "orchestrator.completed", {
            durationMs: elapsedMs(startedAt),
            handled: state.status !== "not_agent",
            status: state.status,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            finalResponse: previewLogText(state.final_response),
        });
        return state;
    }

    state = applyEntityResolution(state);
    state = await validateRoute(state);
    state = await repairInvalidRouteIfPossible(state);

    if (!state.validation.is_valid || state.status !== "success") {
        if (!state.final_response) {
            state.final_response = buildClarificationForValidation(state);
        }
        orchestrationLog(state, "orchestrator.completed", {
            durationMs: elapsedMs(startedAt),
            handled: true,
            status: state.status,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            finalResponse: previewLogText(state.final_response),
        });
        return state;
    }

    state = await executeWithRepairLoop(state);
    await persistTaskFlow(state);

    if (state.metadata.render_as_chat === true && state.agent_response) {
        state.final_response = buildInlineAgentFinalResponse(state);
        orchestrationLog(state, "orchestrator.completed", {
            durationMs: elapsedMs(startedAt),
            handled: true,
            status: state.status,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            taskId: state.created_task?.taskId,
            finalResponse: previewLogText(state.final_response),
        });
        return state;
    }

    if (state.status !== "success") {
        if (!state.final_response) {
            state.final_response = deriveUserFacingAgentMessage(state);
        }
        orchestrationLog(state, "orchestrator.completed", {
            durationMs: elapsedMs(startedAt),
            handled: true,
            status: state.status,
            targetAgent: state.route.target_agent,
            targetAction: state.route.target_action,
            taskId: state.created_task?.taskId,
            finalResponse: previewLogText(state.final_response),
        });
        return state;
    }

    const agentName = state.route.target_agent
        ? getAgentCatalogEntry(state.route.target_agent)?.name || state.route.target_agent
        : "Agent";
    state.final_response =
        compactString(
            state.agent_response?.summary || state.agent_response?.message || "",
            1200
        ) ||
        [
            `Delegating to ${agentName}.`,
            "",
            `Action: ${state.route.target_action}`,
            state.route.route_reason ? `\nReasoning: ${state.route.route_reason}` : "",
        ]
        .join("\n")
        .trim();
    orchestrationLog(state, "orchestrator.completed", {
        durationMs: elapsedMs(startedAt),
        handled: true,
        status: state.status,
        targetAgent: state.route.target_agent,
        targetAction: state.route.target_action,
        taskId: state.created_task?.taskId,
        finalResponse: previewLogText(state.final_response),
    });
    return state;
}

export async function runLangGraphOrchestration(
    input: LangGraphOrchestrationInput
): Promise<LangGraphOrchestrationResult> {
    const state = await orchestrate(input);

    if (state.status === "not_agent") {
        return {
            handled: false,
            type: "chat",
            content: "",
            status: state.status,
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
                taskId: state.created_task?.taskId,
                agentId: state.route.target_agent || undefined,
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
                failure: state.failure,
            },
            state,
        };
    }

    if (!state.validation.is_valid || state.status !== "success") {
        return {
            handled: true,
            type: "chat",
            content: state.final_response || buildClarificationForValidation(state),
            status: state.status,
            result: state.agent_response || undefined,
            meta: {
                kind: "parent_llm_response",
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
                failure: state.failure,
                ...(state.metadata.install_meta && typeof state.metadata.install_meta === "object"
                    ? (state.metadata.install_meta as Record<string, unknown>)
                    : {}),
            },
            state,
        };
    }

    if (state.dry_run || !state.created_task) {
        return {
            handled: true,
            type: "chat",
            content: state.final_response,
            status: state.status,
            result: state.agent_response || undefined,
            meta: {
                kind: "parent_llm_dry_run",
                route: state.route,
                resolved_entities: state.resolved_entities,
                validation: state.validation,
            },
            state,
        };
    }

    return {
        handled: true,
        type: "agent_task",
        content: state.final_response,
        status:
            state.created_task.status ||
            (state.agent_response?.status as string | undefined) ||
            state.status,
        taskId: state.created_task.taskId,
        agentId: state.route.target_agent || undefined,
        result: state.agent_response || undefined,
        meta: {
            kind: "parent_llm_agent_task",
            route: state.route,
            resolved_entities: state.resolved_entities,
            validation: state.validation,
            failure: state.failure,
            repair_attempts: state.metadata.repair_attempts || 0,
        },
        state,
    };
}

export const langGraphOrchestrator = {
    invoke: async (input: LangGraphOrchestrationInput) => orchestrate(input),
};
