import type {
    AgentExecutionContract,
    AgentExecutionStatus,
} from "@/lib/agent-error/agent-result-contract";

const VALID_STATUSES = new Set<AgentExecutionStatus>([
    "success",
    "needs_input",
    "action_required",
    "failed",
    "partial_success",
]);

function toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function toStringOrNull(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    return null;
}

export function normalizeAgentExecutionResult(raw: unknown): AgentExecutionContract {
    const record = toRecord(raw);
    const statusCandidate = toStringOrNull(record.status);
    const status = VALID_STATUSES.has(statusCandidate as AgentExecutionStatus)
        ? (statusCandidate as AgentExecutionStatus)
        : "failed";
    const summary = toStringOrNull(record.summary) ?? toStringOrNull(record.message);
    const error = toStringOrNull(record.error);

    const contract: AgentExecutionContract = {
        ...record,
        status,
        summary,
        error,
        error_code: toStringOrNull(record.error_code),
        error_context:
            record.error_context && typeof record.error_context === "object"
                ? (record.error_context as Record<string, unknown>)
                : null,
        recommended_next_actions: Array.isArray(record.recommended_next_actions)
            ? record.recommended_next_actions.map((item) => String(item)).filter(Boolean)
            : [],
        ui_payload:
            record.ui_payload && typeof record.ui_payload === "object"
                ? (record.ui_payload as Record<string, unknown>)
                : null,
        internal_payload:
            record.internal_payload && typeof record.internal_payload === "object"
                ? (record.internal_payload as Record<string, unknown>)
                : {
                      raw_result: record,
                  },
    };

    if (!summary && !error && status === "failed") {
        contract.error = "The agent returned an unexpected result format.";
        contract.error_code = contract.error_code || "INVALID_RESULT_SHAPE";
        contract.error_context = {
            ...(contract.error_context || {}),
            reason: "missing_summary_and_error",
        };
    }

    return contract;
}
