export type InterpretedTaskStatus = "failed" | "needs_input" | "action_required";

export interface PatternInterpretationInput {
    agentId: string;
    rawError: string;
}

export interface PatternInterpretationResult {
    status: InterpretedTaskStatus;
    userMessage: string;
    rootCause: string;
    suggestedAction?: string;
    suggestedInputs?: string[];
    code?: string;
}

function containsAny(value: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(value));
}

function parseMissingFieldHints(error: string): string[] {
    const normalized = error.trim();
    if (!normalized) return [];

    const many = normalized.match(/missing[_\s-]?fields?\s*[:=]\s*([a-z0-9_,\s-]+)/i);
    if (many?.[1]) {
        return many[1]
            .split(/[,\s]+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((item) => item !== "and" && item !== "or");
    }

    const single = normalized.match(/missing\s+(?:required\s+)?(?:field|parameter)\s*[:=]?\s*([a-z0-9_-]+)/i);
    if (single?.[1]) return [single[1].trim()];

    return [];
}

export function interpretErrorWithPatterns(
    input: PatternInterpretationInput
): PatternInterpretationResult | null {
    const error = input.rawError.trim();
    const lower = error.toLowerCase();

    if (!error) return null;

    if (
        containsAny(lower, [
            /missing[_\s-]?fields?/i,
            /missing required/i,
            /required parameter/i,
            /needs input/i,
        ])
    ) {
        const missingHints = parseMissingFieldHints(error);
        const isDriveLike =
            input.agentId === "google-agent" &&
            (lower.includes("drive") || lower.includes("file") || lower.includes("document"));
        const missingLine =
            missingHints.length > 0
                ? `Missing detail(s): ${missingHints.join(", ")}.`
                : "One key detail is still missing.";

        return {
            status: "needs_input",
            userMessage: isDriveLike
                ? `${missingLine} Please share the exact file name (and folder if you know it). If you want, I can list the next Drive batch so you can pick the right file.`
                : `${missingLine} Share that value and I will retry immediately.`,
            rootCause: "Missing required inputs.",
            suggestedAction: isDriveLike
                ? "Provide exact file name, or ask me to list the next Drive batch."
                : "Provide the missing field(s), then I will retry right away.",
            suggestedInputs: missingHints.length > 0 ? missingHints : undefined,
            code: "MISSING_INPUTS",
        };
    }

    if (containsAny(lower, [/http 401/i, /unauthenticated/i, /invalid credentials/i])) {
        return {
            status: "action_required",
            userMessage:
                "Authentication expired or is missing for this agent. Please reconnect/sign in, then retry.",
            rootCause: "Authentication required.",
            suggestedAction: "Reconnect the required account and retry.",
            code: "AUTH_REQUIRED",
        };
    }

    if (containsAny(lower, [/http 403/i, /forbidden/i, /access denied/i])) {
        return {
            status: "action_required",
            userMessage:
                "This action is blocked by access permissions. Please install/connect the required agent or grant access, then retry.",
            rootCause: "Insufficient permissions.",
            suggestedAction: "Install/connect agent access and retry.",
            code: "ACCESS_DENIED",
        };
    }

    if (containsAny(lower, [/http 402/i, /payment required/i])) {
        const isStrata = input.agentId === "strata-agent";
        return {
            status: "needs_input",
            userMessage: isStrata
                ? "The financial data provider rejected this request due to plan or billing limits (HTTP 402). Please provide a supported ticker (for example AAPL, TSLA, MSFT) or update the API plan."
                : "This request was rejected by the provider due to plan or billing limits (HTTP 402). Please adjust the request or provider plan and retry.",
            rootCause: "Upstream provider plan or billing limitation.",
            suggestedAction: isStrata
                ? "Provide a supported ticker or update FMP plan."
                : "Adjust request or upgrade provider plan.",
            suggestedInputs: isStrata ? ["symbol"] : undefined,
            code: "PROVIDER_PLAN_LIMIT",
        };
    }

    if (
        containsAny(lower, [
            /econnrefused/i,
            /fetch failed/i,
            /timed out/i,
            /connection reset/i,
            /name or service not known/i,
        ])
    ) {
        return {
            status: "failed",
            userMessage:
                "I could not reach the agent service right now. Please try again in a moment.",
            rootCause: "Service or network connectivity issue.",
            suggestedAction: "Retry shortly. If this keeps happening, check service health.",
            code: "SERVICE_UNREACHABLE",
        };
    }

    if (containsAny(lower, [/http 404/i, /not found/i, /could not find/i])) {
        const isDriveLike =
            input.agentId === "google-agent" &&
            (lower.includes("drive") || lower.includes("file") || lower.includes("document"));
        return {
            status: "needs_input",
            userMessage: isDriveLike
                ? "I could not find that file yet. Share the exact file name (for example class 10th.pdf) or ask me to show the next Drive batch and I will continue from there."
                : "I could not find the exact target yet. Please provide a more specific name, id, or path so I can fetch the correct item.",
            rootCause: "Requested target was not found.",
            suggestedAction: isDriveLike
                ? "Provide the exact file name or continue with the next batch."
                : "Provide a precise identifier and retry.",
            suggestedInputs: isDriveLike ? ["file_name"] : ["target_identifier"],
            code: "TARGET_NOT_FOUND",
        };
    }

    return null;
}
