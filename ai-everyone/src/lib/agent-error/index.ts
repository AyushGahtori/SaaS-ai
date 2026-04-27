import {
    interpretErrorWithPatterns,
    type InterpretedTaskStatus,
    type PatternInterpretationResult,
} from "./error-patterns";
import { interpretErrorWithLlm } from "./llm-error-explainer";

export { normalizeAgentExecutionResult } from "./normalize-agent-result";
export type {
    AgentExecutionContract,
    AgentExecutionStatus,
} from "./agent-result-contract";

export interface AgentErrorInterpretInput {
    agentId: string;
    rawError: string;
    agentInput?: Record<string, unknown>;
}

export interface AgentErrorInterpretation {
    status: InterpretedTaskStatus;
    error: string;
    rawError: string;
    summary: string;
    rootCause: string;
    suggestedAction?: string;
    suggestedInputs?: string[];
    interpreted: true;
    code?: string;
}

function toStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
}

function uniqueNonPlaceholderInputs(values: string[]): string[] {
    const seen = new Set<string>();
    const placeholders = new Set([
        "specific_identifier",
        "identifier",
        "unknown",
        "missing",
        "value",
    ]);

    return values.filter((value) => {
        const normalized = value.toLowerCase().trim();
        if (!normalized || placeholders.has(normalized) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
}

function extractMissingFieldsFromAgentResult(agentInput?: Record<string, unknown>): string[] {
    if (!agentInput || typeof agentInput !== "object") return [];
    const resultCandidate = agentInput._agentResult;
    if (!resultCandidate || typeof resultCandidate !== "object") return [];
    const resultRecord = resultCandidate as Record<string, unknown>;
    const nestedResult =
        resultRecord.result && typeof resultRecord.result === "object"
            ? (resultRecord.result as Record<string, unknown>)
            : null;
    const uiPayload =
        resultRecord.ui_payload && typeof resultRecord.ui_payload === "object"
            ? (resultRecord.ui_payload as Record<string, unknown>)
            : null;

    return uniqueNonPlaceholderInputs([
        ...toStringList(resultRecord.suggestedInputs),
        ...toStringList(resultRecord.suggested_inputs),
        ...toStringList(uiPayload?.suggestedInputs),
        ...toStringList(nestedResult?.suggestedInputs),
        ...toStringList(nestedResult?.suggested_inputs),
        ...toStringList(nestedResult?.missing_fields),
    ]);
}

function toOutput(
    agentId: string,
    rawError: string,
    interpretation: PatternInterpretationResult | null,
    agentInput?: Record<string, unknown>
): AgentErrorInterpretation {
    if (!interpretation) {
        const lowerError = rawError.toLowerCase();
        const missingFields = extractMissingFieldsFromAgentResult(agentInput);
        const action =
            typeof agentInput?.action === "string" ? agentInput.action.toLowerCase() : "";
        const isDriveLike =
            agentId === "google-agent" &&
            (lowerError.includes("file") ||
                lowerError.includes("drive") ||
                lowerError.includes("document") ||
                action.includes("summarize") ||
                action.includes("read"));

        const missingLine =
            missingFields.length > 0
                ? `Missing detail(s): ${missingFields.join(", ")}.`
                : "The agent did not name the missing field clearly.";
        const actionLabel =
            typeof agentInput?.action === "string" && agentInput.action.trim()
                ? ` for "${agentInput.action.trim()}"`
                : "";
        const fallback = isDriveLike
            ? `Hey, the agent could not complete this yet because the target Drive file is still unclear. ${missingLine} Please share the exact file name (for example class 10th.pdf). If you want, I can list the next Drive batch right now so you can pick it quickly.`
            : missingFields.length > 0
                ? `I can retry the agent${actionLabel}, but I need: ${missingFields.join(", ")}. Share those detail(s) and I will run it again.`
                : `The agent could not finish this attempt${actionLabel}, and it did not return a clear missing field. Please share the exact target or goal in one sentence, and I will retry with that context.`;

        return {
            status: "needs_input",
            error: fallback,
            rawError,
            summary: fallback,
            rootCause: "Unknown failure.",
            suggestedAction: isDriveLike
                ? "Please provide the exact file name. Or ask me to list recent Drive files and then choose one."
                : missingFields.length > 0
                    ? `Provide: ${missingFields.join(", ")}.`
                    : "Restate the exact target or goal so I can retry with the right context.",
            suggestedInputs:
                missingFields.length > 0
                    ? missingFields
                    : isDriveLike
                        ? ["file_name"]
                        : undefined,
            interpreted: true,
            code: "UNCLASSIFIED",
        };
    }

    return {
        status: interpretation.status,
        error: interpretation.userMessage,
        rawError,
        summary: interpretation.userMessage,
        rootCause: interpretation.rootCause,
        suggestedAction: interpretation.suggestedAction,
        suggestedInputs: interpretation.suggestedInputs,
        interpreted: true,
        code: interpretation.code,
    };
}

export async function interpretAgentError(
    input: AgentErrorInterpretInput
): Promise<AgentErrorInterpretation> {
    const rawError = input.rawError.trim();
    const byPattern = interpretErrorWithPatterns({
        agentId: input.agentId,
        rawError,
    });

    if (byPattern) {
        return toOutput(input.agentId, rawError, byPattern, input.agentInput);
    }

    const byLlm = await interpretErrorWithLlm({
        agentId: input.agentId,
        rawError,
        agentInput: input.agentInput,
    });

    if (byLlm) {
        return toOutput(
            input.agentId,
            rawError,
            {
                status: byLlm.status,
                userMessage: byLlm.userMessage,
                rootCause: byLlm.rootCause,
                suggestedAction: byLlm.suggestedAction,
                suggestedInputs: byLlm.suggestedInputs,
                code: byLlm.code,
            },
            input.agentInput
        );
    }

    return toOutput(input.agentId, rawError, null, input.agentInput);
}
