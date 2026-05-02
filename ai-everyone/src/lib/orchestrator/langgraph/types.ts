import type { AgentTask } from "@/lib/firestore-tasks";

export type RouteConfidence = "high" | "medium" | "low";

export type EntitySource =
    | "direct"
    | "context"
    | "heuristic"
    | "llm"
    | "none";

export type OrchestrationStatus =
    | "success"
    | "not_agent"
    | "needs_clarification"
    | "no_match_found"
    | "multiple_matches_found"
    | "retryable_agent_error"
    | "provider_error"
    | "infrastructure_error"
    | "validation_error"
    | "failed";

export interface RecentMessageContext {
    role: string;
    content: string;
    taskId?: string;
    agentId?: string;
}

export interface IndexedEntity {
    index: number;
    id: string;
    kind: string;
    agentId: string;
    action?: string;
    message_id?: string;
    thread_id?: string | null;
    subject?: string;
    sender?: string;
    name?: string;
    title?: string;
    snippet?: string;
    date?: string;
    raw?: Record<string, unknown>;
}

export interface ConversationContext {
    recent_messages: RecentMessageContext[];
    recent_agent_tasks: Array<Record<string, unknown>>;
    recent_agent_outputs: Record<string, unknown>;
    entity_index: {
        gmail_emails: IndexedEntity[];
        drive_files: IndexedEntity[];
        todo_tasks: IndexedEntity[];
        generic_items: IndexedEntity[];
    };
    agent_workspace_memory?: {
        restaurant_concierge?: {
            menu_items?: Array<{
                name?: string;
                price?: number;
                contains?: string;
                description?: string;
            }>;
            updated_at?: string | null;
            order_snapshot?: Record<string, unknown> | null;
            session_snapshot?: Record<string, unknown> | null;
        };
        shelfie_grocery?: {
            grocery_memory?: Array<{
                id?: string;
                title?: string;
                buying_date?: string;
                end_date?: string;
                notes?: string;
                items?: Array<{
                    name?: string;
                    quantity?: string;
                    purchased?: boolean;
                    finished?: boolean;
                }>;
            }>;
            updated_at?: string | null;
        };
    };
    last_agent_id?: string;
    last_action?: string;
    last_referenced_entity?: IndexedEntity | null;
}

export interface RouteDecision {
    target_agent: string | null;
    target_action: string | null;
    route_confidence: RouteConfidence;
    route_reason: string;
    parameters: Record<string, unknown>;
    is_agent_request: boolean;
}

export interface ResolvedEntities {
    message_id?: string | null;
    file_id?: string | null;
    row_index?: number | null;
    subject?: string | null;
    sender?: string | null;
    thread_id?: string | null;
    entity_source: EntitySource;
    matched_entity?: IndexedEntity | null;
    candidate_entities?: IndexedEntity[];
}

export interface ValidationState {
    is_valid: boolean;
    missing_fields: string[];
    clarification_needed: boolean;
    reason?: string;
}

export interface FailureState {
    code: OrchestrationStatus;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
}

export interface LangGraphOrchestrationState {
    user_input: string;
    normalized_input: string;
    chat_id: string;
    user_id: string;
    model?: string;
    llm_provider?: string;
    installed_agent_ids: string[];
    accessible_agent_ids: string[];
    attachments?: Array<Record<string, unknown>>;
    conversation_context: ConversationContext;
    route: RouteDecision;
    resolved_entities: ResolvedEntities;
    validation: ValidationState;
    agent_request: Record<string, unknown>;
    agent_response: Record<string, unknown> | null;
    created_task: AgentTask | null;
    final_response: string;
    status: OrchestrationStatus;
    failure: FailureState | null;
    metadata: Record<string, unknown>;
    dry_run?: boolean;
}

export interface LangGraphOrchestrationInput {
    userId: string;
    chatId: string;
    userInput: string;
    model?: string;
    llmProvider?: string;
    installedAgentIds?: string[];
    accessibleAgentIds?: string[];
    recentMessages?: RecentMessageContext[];
    attachments?: Array<Record<string, unknown>>;
    dryRun?: boolean;
}

export interface LangGraphOrchestrationResult {
    handled: boolean;
    type: "chat" | "agent_task";
    content: string;
    status: OrchestrationStatus | string;
    taskId?: string;
    agentId?: string;
    result?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    state: LangGraphOrchestrationState;
}
