import { AGENT_CATALOG } from "@/lib/agents/catalog";

export const GOOGLE_AGENT_TYPES = new Set([
    "calendar",
    "gmail",
    "meet",
    "drive",
    "tasks",
    "web_search",
]);

export interface AgentIntent {
    agent_required: string;
    action: string;
    parameters: Record<string, unknown>;
    reasoning?: string;
}

export interface ParsedIntentResult {
    intent: AgentIntent;
    conversationalText: string;
}

export interface DeterministicRouteResult {
    intent: AgentIntent;
    source: "deterministic";
}

type ParseResult = ParsedIntentResult | { error: true; fallback: string } | null;

const AGENT_ALIASES: Record<string, string> = {
    gmail: "google-agent",
    "google mail": "google-agent",
    mail: "google-agent",
    email: "google-agent",
    inbox: "google-agent",
    drive: "google-agent",
    "google drive": "google-agent",
    calendar: "google-agent",
    "google calendar": "google-agent",
    meet: "google-agent",
    "google meet": "google-agent",
    "web search": "google-agent",
    search: "google-agent",
    stara: "strata-agent",
    strata: "strata-agent",
    todo: "todo-agent",
    "to do": "todo-agent",
    reminder: "todo-agent",
    reminders: "todo-agent",
    maps: "maps-agent",
    map: "maps-agent",
    seo: "seo-agent",
    shopgenie: "shopgenie-agent",
    "shop genie": "shopgenie-agent",
    travel: "travel-halper-agent",
    trip: "travel-halper-agent",
};

function compactWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function stripCodeFence(value: string): string {
    const trimmed = value.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch?.[1]?.trim() || trimmed;
}

function extractTaggedIntent(content: string): {
    jsonCandidate: string;
    conversationalText: string;
} | null {
    const tagMatch = content.match(/<AGENT_INTENT>([\s\S]*?)<\/AGENT_INTENT>/i);
    if (!tagMatch) return null;

    return {
        jsonCandidate: tagMatch[1].trim(),
        conversationalText: content.replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/i, "").trim(),
    };
}

function extractFirstJsonObject(content: string): string | null {
    const text = stripCodeFence(content);
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = false;
            }
            continue;
        }

        if (char === "\"") {
            inString = true;
            continue;
        }

        if (char === "{") {
            if (depth === 0) start = index;
            depth += 1;
            continue;
        }

        if (char === "}") {
            if (depth === 0) continue;
            depth -= 1;
            if (depth === 0 && start >= 0) {
                return text.slice(start, index + 1);
            }
        }
    }

    return null;
}

function parseJsonCandidate(candidate: string): Record<string, unknown> | null {
    const cleaned = stripCodeFence(candidate)
        .replace(/^\uFEFF/, "")
        .trim();

    const attempts = [
        cleaned,
        cleaned.replace(/,\s*([}\]])/g, "$1"),
        extractFirstJsonObject(cleaned) || "",
    ].filter(Boolean);

    for (const attempt of attempts) {
        try {
            const parsed = JSON.parse(attempt);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const record = parsed as Record<string, unknown>;
                if (record.intent && typeof record.intent === "object" && !Array.isArray(record.intent)) {
                    return record.intent as Record<string, unknown>;
                }
                return record;
            }
        } catch {
            // Try the next recovery strategy.
        }
    }

    return null;
}

function normalizeAgentName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[_\-.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function fuzzyMatchAgent(rawAgent: string) {
    const normalized = normalizeAgentName(rawAgent);
    const alias = AGENT_ALIASES[normalized];
    if (alias) return AGENT_CATALOG.find((agent) => agent.id === alias);

    return AGENT_CATALOG.find((agent) => {
        const id = normalizeAgentName(agent.id);
        const name = normalizeAgentName(agent.name);
        return (
            normalized === id ||
            normalized === id.replace(/\s+/g, "") ||
            normalized.includes(id.replace(/\s+/g, "")) ||
            name === normalized ||
            name.includes(normalized)
        );
    });
}

function normalizeAgentIntent(parsed: Record<string, unknown>): AgentIntent | null {
    const rawAgent =
        parsed.agent_required ??
        parsed.agent ??
        parsed.agent_id ??
        parsed.agentId ??
        parsed.tool ??
        parsed.service;
    const rawAction = parsed.action ?? parsed.operation ?? parsed.intent_action;
    const action = typeof rawAction === "string" ? rawAction.trim() : "";
    if (!action) return null;

    const matchedAgent = fuzzyMatchAgent(String(rawAgent || ""));
    if (!matchedAgent) return null;

    const intent: AgentIntent = {
        agent_required: matchedAgent.id,
        action,
        parameters: {},
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : undefined,
    };

    const rawParameters =
        parsed.parameters ??
        parsed.params ??
        parsed.input ??
        parsed.arguments ??
        parsed.args;
    if (typeof rawParameters === "string") {
        intent.parameters = { parameters: rawParameters };
    } else if (rawParameters && typeof rawParameters === "object" && !Array.isArray(rawParameters)) {
        intent.parameters = { ...(rawParameters as Record<string, unknown>) };
    } else if (typeof rawParameters !== "undefined" && rawParameters !== null) {
        intent.parameters = { parameters: String(rawParameters) };
    }

    if (typeof parsed.agent_type === "string" && !intent.parameters.agent_type) {
        intent.parameters.agent_type = parsed.agent_type;
    }
    if (typeof parsed.service === "string" && !intent.parameters.agent_type) {
        intent.parameters.agent_type = parsed.service;
    }

    return normalizeGoogleIntent(intent);
}

function inferGoogleAgentType(intent: AgentIntent): string {
    const currentAgentType =
        typeof intent.parameters.agent_type === "string"
            ? intent.parameters.agent_type.toLowerCase().trim()
            : "";
    if (GOOGLE_AGENT_TYPES.has(currentAgentType)) return currentAgentType;

    const actionLower = intent.action.toLowerCase().trim();
    if (GOOGLE_AGENT_TYPES.has(actionLower)) return actionLower;

    const paramsText = String(intent.parameters.parameters || intent.parameters.query || "").toLowerCase();
    if (/\b(gmail|emails?|mails?|messages?|mail|inbox)\b/.test(paramsText)) return "gmail";
    if (/\b(drive|file|files|docs?|documents?)\b/.test(paramsText)) return "drive";
    if (/\b(calendar|event|schedule|agenda)\b/.test(paramsText)) return "calendar";
    if (/\b(meet|meeting|video call)\b/.test(paramsText)) return "meet";
    if (/\b(task|tasks|todo|to-do|remind)\b/.test(paramsText)) return "tasks";
    if (/\b(search|web|internet|lookup|look up)\b/.test(paramsText)) return "web_search";
    return "";
}

function inferGmailAction(message: string): string {
    const lower = message.toLowerCase();
    const hasNumericList = getNumericRequestCount(lower) !== null;

    if (/\b(mark|archive|read)\b.*\b(read|seen)\b/.test(lower)) return "mark_as_read";
    if (/\b(reply|respond)\b/.test(lower)) return "reply_email";
    if (/\b(search|find)\b/.test(lower)) return "search_emails";
    if (/\b(send|compose|mail|email)\b/.test(lower) && /\b(to|again|this person|that person|him|her|them|@)\b/.test(lower)) {
        return "send_email";
    }
    if (/\b(summarize|summarise|summary)\b/.test(lower) && hasNumericList) {
        return "summarize_inbox";
    }
    if (/\b(summarize|summarise|summary|read|open)\b/.test(lower) && !hasNumericList) {
        return "read_email";
    }
    return "list_emails";
}

function inferDriveAction(message: string): string {
    const lower = message.toLowerCase();
    if (/\b(search|find)\b/.test(lower)) return "search_files";
    if (/\b(read|summarize|summarise|summary|open)\b/.test(lower) && getNumericRequestCount(lower) === null) {
        return "read_file";
    }
    if (/\bpdf|pdfs\b/.test(lower) && /\b(list|show|get|retrieve|latest|recent|last)\b/.test(lower)) {
        return "list_pdf_files";
    }
    return "list_files";
}

function normalizeGoogleIntent(intent: AgentIntent): AgentIntent {
    if (intent.agent_required !== "google-agent") return intent;

    const normalized: AgentIntent = {
        ...intent,
        parameters: { ...intent.parameters },
    };
    const agentType = inferGoogleAgentType(normalized);
    if (agentType) normalized.parameters.agent_type = agentType;

    const details = String(normalized.parameters.parameters || normalized.parameters.query || "").trim();
    const actionLower = normalized.action.toLowerCase().trim();
    if (agentType === "gmail") {
        normalized.action = inferGmailAction(`${actionLower} ${details}`);
    } else if (agentType === "drive") {
        normalized.action = inferDriveAction(`${actionLower} ${details}`);
    }

    return normalized;
}

export function parseModelAgentIntent(content: string): ParseResult {
    const tagged = extractTaggedIntent(content);
    const jsonCandidate = tagged?.jsonCandidate || extractFirstJsonObject(content);

    if (!jsonCandidate) {
        return null;
    }

    const parsed = parseJsonCandidate(jsonCandidate);
    if (!parsed) {
        return {
            error: true,
            fallback: "I could not read the agent routing payload. Please rephrase the request once.",
        };
    }

    const normalizedIntent = normalizeAgentIntent(parsed);
    if (!normalizedIntent) {
        return {
            error: true,
            fallback: "I could not match that request to a supported agent.",
        };
    }

    if (
        normalizedIntent.agent_required === "google-agent" &&
        (typeof normalizedIntent.parameters.agent_type !== "string" ||
            !GOOGLE_AGENT_TYPES.has(normalizedIntent.parameters.agent_type.toLowerCase().trim()))
    ) {
        return {
            error: true,
            fallback:
                "I could not determine which Google service to use. Please mention Gmail, Drive, Calendar, Meet, Tasks, or Web Search.",
        };
    }

    return {
        intent: normalizedIntent,
        conversationalText: tagged ? tagged.conversationalText : content.replace(jsonCandidate, "").trim(),
    };
}

export function getNumericRequestCount(text: string): number | null {
    const lower = text.toLowerCase();

    if (/\b(all|every)\s+(emails?|mails?|files?|documents?|docs?|messages?)\b/.test(lower)) {
        return 999;
    }

    const patterns = [
        /\b(?:last|latest|recent|show|list|retrieve|get|fetch|read)\s+(\d{1,4})\s+(?:emails?|mails?|files?|documents?|docs?|messages?)\b/,
        /\b(\d{1,4})\s+(?:latest\s+|recent\s+|last\s+)?(?:emails?|mails?|files?|documents?|docs?|messages?)\b/,
        /\b(?:top|first)\s+(\d{1,4})\s+(?:emails?|mails?|files?|documents?|docs?|messages?)\b/,
    ];

    for (const pattern of patterns) {
        const match = lower.match(pattern);
        if (!match?.[1]) continue;
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return null;
}

export function getGoogleIntentLimitViolation(intent: AgentIntent, userMessage: string): string | null {
    if (intent.agent_required !== "google-agent") return null;

    const rawAgentType = intent.parameters.agent_type;
    const agentType = typeof rawAgentType === "string" ? rawAgentType.toLowerCase() : "";
    if (agentType !== "gmail" && agentType !== "drive") return null;

    const requestedCount =
        getNumericRequestCount(userMessage) ??
        getNumericRequestCount(String(intent.parameters.parameters || ""));
    if (requestedCount && requestedCount > 20) {
        const itemLabel = agentType === "gmail" ? "emails" : "files";
        return `I currently cannot display more than 20 ${itemLabel} at once. Please ask for 20 or fewer.`;
    }

    return null;
}

function normalizeGoogleLimitValue(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return String(Math.floor(value));
    return null;
}

export function normalizeGoogleExecutionPayload(intent: AgentIntent, userMessage: string): AgentIntent {
    if (intent.agent_required !== "google-agent") return intent;

    const normalized = normalizeGoogleIntent({
        ...intent,
        parameters: { ...intent.parameters },
    });

    const rawAgentType = normalized.parameters.agent_type;
    const agentType = typeof rawAgentType === "string" ? rawAgentType.toLowerCase().trim() : "";
    if (agentType !== "gmail" && agentType !== "drive") {
        return normalized;
    }

    const requestedCount =
        getNumericRequestCount(userMessage) ??
        getNumericRequestCount(String(normalized.parameters.parameters || ""));
    const existingLimit =
        normalizeGoogleLimitValue(normalized.parameters.limit) ||
        normalizeGoogleLimitValue(normalized.parameters.count) ||
        normalizeGoogleLimitValue(normalized.parameters.maxResults) ||
        normalizeGoogleLimitValue(normalized.parameters.pageSize);
    const resolvedLimit =
        existingLimit ||
        (typeof requestedCount === "number" && requestedCount > 0 ? String(requestedCount) : null);

    if (resolvedLimit) {
        normalized.parameters.limit = resolvedLimit;
        normalized.parameters.count = resolvedLimit;
        normalized.parameters.maxResults = resolvedLimit;
        normalized.parameters.pageSize = resolvedLimit;
    }

    const existingDetails =
        typeof normalized.parameters.parameters === "string" && normalized.parameters.parameters.trim()
            ? normalized.parameters.parameters.trim()
            : "";
    if (!existingDetails) {
        normalized.parameters.parameters = userMessage;
    }

    return normalized;
}

function hasAny(lower: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(lower));
}

function googleIntent(
    agentType: "gmail" | "drive" | "calendar" | "meet" | "tasks" | "web_search",
    action: string,
    userMessage: string,
    reasoning: string
): AgentIntent {
    const requestedCount = getNumericRequestCount(userMessage);
    const parameters: Record<string, unknown> = {
        agent_type: agentType,
        parameters: userMessage,
    };

    if (requestedCount && requestedCount > 0) {
        const limit = String(Math.min(requestedCount, 20));
        parameters.limit = limit;
        parameters.count = limit;
        parameters.maxResults = limit;
        parameters.pageSize = limit;
    }

    return {
        agent_required: "google-agent",
        action,
        parameters,
        reasoning,
    };
}

function simpleIntent(
    agentId: string,
    action: string,
    parameters: Record<string, unknown>,
    reasoning: string
): AgentIntent {
    return {
        agent_required: agentId,
        action,
        parameters,
        reasoning,
    };
}

export function resolveDeterministicAgentIntent(userMessage: string): DeterministicRouteResult | null {
    const text = compactWhitespace(userMessage);
    const lower = text.toLowerCase();
    if (!text) return null;

    const mentionsGmail = /\b(gmail|email|emails|mail|mails|inbox|message|messages)\b/.test(lower);
    if (mentionsGmail) {
        return {
            source: "deterministic",
            intent: googleIntent("gmail", inferGmailAction(text), text, "Matched a Gmail/email request."),
        };
    }

    const mentionsDrive = /\b(google drive|drive|docs?|documents?|files?|folder|folders|pdf|pdfs)\b/.test(lower);
    const likelyDriveAction = hasAny(lower, [
        /\b(list|show|get|retrieve|fetch|find|search|read|summarize|summarise|open)\b/,
        /\b(last|latest|recent)\b/,
    ]);
    if (mentionsDrive && likelyDriveAction) {
        return {
            source: "deterministic",
            intent: googleIntent("drive", inferDriveAction(text), text, "Matched a Google Drive/file request."),
        };
    }

    if (/\b(google calendar|calendar|agenda|events?)\b/.test(lower)) {
        const action = /\b(create|schedule|add|book)\b/.test(lower)
            ? "create_event"
            : "list_events";
        return {
            source: "deterministic",
            intent: googleIntent("calendar", action, text, "Matched a Google Calendar request."),
        };
    }

    if (/\b(google meet|meet link|meeting link|video call)\b/.test(lower)) {
        return {
            source: "deterministic",
            intent: googleIntent("meet", "create_meet", text, "Matched a Google Meet request."),
        };
    }

    if (/\b(google tasks|tasks)\b/.test(lower)) {
        const action = /\b(add|create|remind)\b/.test(lower) ? "create_task" : "list_tasks";
        return {
            source: "deterministic",
            intent: googleIntent("tasks", action, text, "Matched a Google Tasks request."),
        };
    }

    if (/\b(remind me|to-do|todo|task|daily plan|weekly overview|plan my day)\b/.test(lower)) {
        const action = /\b(weekly|week overview)\b/.test(lower)
            ? "get_weekly_overview"
            : /\b(today|daily|plan my day|my plan)\b/.test(lower)
                ? "get_daily_plan"
                : /\b(list|show|what)\b/.test(lower)
                    ? "list_tasks"
                    : "add_task";
        return {
            source: "deterministic",
            intent: simpleIntent("todo-agent", action, { title: text, prompt: text }, "Matched a task/reminder request."),
        };
    }

    if (/\b(map|maps|directions|route|near me|nearby|distance|coffee shops?|restaurants?)\b/.test(lower)) {
        const action = /\b(direction|route|from .+ to )\b/.test(lower)
            ? "get_directions"
            : /\b(distance|how far|travel time)\b/.test(lower)
                ? "distance_matrix"
                : "search_places";
        return {
            source: "deterministic",
            intent: simpleIntent("maps-agent", action, { query: text, parameters: text }, "Matched a Maps request."),
        };
    }

    if (/\b(chest pain|breathing|can't breathe|cannot breathe|severe injury|emergency|sos|ambulance)\b/.test(lower)) {
        return {
            source: "deterministic",
            intent: simpleIntent(
                "emergency-response-agent",
                "assess_emergency",
                { description: text },
                "Matched an emergency/medical safety request."
            ),
        };
    }

    if (/\b(stara|strata)\b/.test(lower)) {
        return {
            source: "deterministic",
            intent: simpleIntent("strata-agent", "ask", { prompt: text }, "Matched Stara/Strata."),
        };
    }

    if (/\bseo\b/.test(lower)) {
        const action = /\b(audit)\b/.test(lower)
            ? "audit"
            : /\b(optimize|optimise)\b/.test(lower)
                ? "optimize_article"
                : "generate_brief";
        return {
            source: "deterministic",
            intent: simpleIntent("seo-agent", action, { prompt: text, keyword: text }, "Matched an SEO request."),
        };
    }

    if (/\b(shopgenie|shop genie|buy|best .+ under|compare .+ (phones|laptops|headphones|products))\b/.test(lower)) {
        return {
            source: "deterministic",
            intent: simpleIntent(
                "shopgenie-agent",
                "recommend_product",
                { prompt: text, query: text },
                "Matched a shopping/product recommendation request."
            ),
        };
    }

    if (/\b(plan a trip|travel|flights?|hotels?|itinerary)\b/.test(lower)) {
        return {
            source: "deterministic",
            intent: simpleIntent("travel-halper-agent", "plan_trip", { prompt: text }, "Matched a travel planning request."),
        };
    }

    return null;
}
