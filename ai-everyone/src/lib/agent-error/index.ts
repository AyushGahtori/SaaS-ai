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

function extractMissingFieldsFromAgentResult(agentInput?: Record<string, unknown>): string[] {
    if (!agentInput || typeof agentInput !== "object") return [];
    const resultCandidate = agentInput._agentResult;
    if (!resultCandidate || typeof resultCandidate !== "object") return [];
    const resultRecord = resultCandidate as Record<string, unknown>;
    const nestedResult =
        resultRecord.result && typeof resultRecord.result === "object"
            ? (resultRecord.result as Record<string, unknown>)
            : null;
    const missing = nestedResult?.missing_fields;
    if (!Array.isArray(missing)) return [];
    return missing.map((value) => String(value).trim()).filter(Boolean);
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
                : "One critical detail is still missing.";
        const fallback = isDriveLike
            ? `Hey, the agent could not complete this yet because the target Drive file is still unclear. ${missingLine} Please share the exact file name (for example class 10th.pdf). If you want, I can list the next Drive batch right now so you can pick it quickly.`
            : `Hey, the agent could not complete this request yet. ${missingLine} Please share one specific value (for example name/id/date/path), and I will retry immediately.`;

        return {
            status: "needs_input",
            error: fallback,
            rawError,
            summary: fallback,
            rootCause: "Unknown failure.",
            suggestedAction: isDriveLike
                ? "Please provide the exact file name. Or ask me to list recent Drive files and then choose one."
                : "Provide one specific missing detail so I can retry.",
            suggestedInputs:
                missingFields.length > 0
                    ? missingFields
                    : isDriveLike
                        ? ["file_name"]
                        : ["specific_identifier"],
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
