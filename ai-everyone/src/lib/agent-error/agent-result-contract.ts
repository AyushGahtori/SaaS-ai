export type AgentExecutionStatus =
    | "success"
    | "needs_input"
    | "action_required"
    | "failed"
    | "partial_success";

export interface AgentExecutionContract {
    status: AgentExecutionStatus;
    summary: string | null;
    error: string | null;
    error_code?: string | null;
    error_context?: Record<string, unknown> | null;
    recommended_next_actions?: string[];
    ui_payload?: Record<string, unknown> | null;
    internal_payload?: Record<string, unknown> | null;
    [key: string]: unknown;
}
