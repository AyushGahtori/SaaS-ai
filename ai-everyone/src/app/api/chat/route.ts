/**
 * POST /api/chat
 *
 * Authenticated streaming chat route for SnitchX.
 *
 * - Verifies the Firebase ID token from the Authorization header
 * - Streams normal Ollama text responses incrementally
 * - Buffers agent-intent responses and converts them into agent tasks
 * - Preserves the existing persona + memory pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, type Part } from "@google/genai";
import { createAgentTask, executeAgentTask } from "@/lib/firestore-tasks.server";
import { isTriggerMessage, isPersonalContextQuery } from "@/lib/memory/trigger-detector";
import { extractMemories } from "@/lib/memory/extractor";
import { processExtractedMemories } from "@/lib/memory/deduper";
import { rebuildPersona, formatPersonaForPrompt } from "@/lib/memory/persona-builder";
import { getPersona } from "@/lib/memory/memory-repository.server";
import { getTopKMemories, formatMemoriesForPrompt } from "@/lib/memory/retrieval";
import {
    AGENT_CATALOG,
    getAgentCatalogEntry,
    getInstallHintForAgent,
    getInstalledAgentRegistry,
} from "@/lib/agents/catalog";
import {
    getAccessibleAgentIds,
    getProviderConnection,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import { isGeminiModel as isGeminiChatModel } from "@/lib/model-capabilities";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    cleanupExpiredUploadedDocs,
    listRecentUploadedDocs,
    readStoredUploadedDocAsBase64,
    type UploadedDocRecord,
} from "@/lib/uploads/uploaded-docs.server";
import {
    validateAttachmentCount,
    validateAttachmentType,
    validateSingleAttachmentSize,
    validateTotalAttachmentSize,
} from "@/lib/uploads/attachment-policy";

const GOOGLE_AGENT_TYPES = new Set(["calendar", "gmail", "meet", "drive", "tasks", "web_search"]);

interface ChatRequestMessage {
    role: string;
    content: string;
}

interface ChatAttachment {
    id: string;
    source: "computer" | "drive";
    name: string;
    mimeType: string;
    size?: number;
    dataBase64?: string;
    driveFileId?: string;
    storagePath?: string;
}

interface ChatFailedAttachment {
    name: string;
    reason: string;
}

interface AgentIntent {
    agent_required: string;
    action: string;
    parameters: Record<string, unknown>;
    reasoning?: string;
}

interface ParsedIntentResult {
    intent: AgentIntent;
    conversationalText: string;
}

const GEMINI_MODEL_ALIASES: Record<string, string> = {
    "gemini-3-pro": process.env.GEMINI_MODEL_PRO || "gemini-3-pro",
    "gemini-3-flash": process.env.GEMINI_MODEL_FLASH || "gemini-3-flash",
    "gemini-3.1-flash-lite":
        process.env.GEMINI_MODEL_FLASH_LITE || "gemini-3.1-flash-lite",
    "gemini-3-flash-preview":
        process.env.GEMINI_MODEL_FLASH || "gemini-3-flash-preview",
    "gemini-3.1-pro-preview":
        process.env.GEMINI_MODEL_PRO || "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview":
        process.env.GEMINI_MODEL_FLASH_LITE || "gemini-3.1-flash-lite-preview",
};

function normalizeName(value: string): string {
    return value.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractPossibleFileNameHints(message: string): string[] {
    const lower = message.toLowerCase();
    const hints = new Set<string>();

    const withExtension = lower.match(/\b[a-z0-9 _.-]+\.(pdf|docx|doc|txt|md|csv|xlsx|pptx)\b/g) || [];
    for (const item of withExtension) hints.add(normalizeName(item));

    const quoted = lower.match(/["“](.*?)["”]/g) || [];
    for (const raw of quoted) {
        const cleaned = raw.replace(/["“”]/g, "").trim();
        if (cleaned) hints.add(normalizeName(cleaned));
    }

    const stem = lower.match(/\b(?:file|pdf|document|doc)\s+(?:named|called)\s+([a-z0-9 _.-]{2,80})\b/);
    if (stem?.[1]) hints.add(normalizeName(stem[1]));

    return Array.from(hints);
}

function isUploadFollowupMessage(message: string): boolean {
    const lower = message.toLowerCase();
    const followupSignals = [
        "that file",
        "this file",
        "uploaded file",
        "the uploaded file",
        "that pdf",
        "this pdf",
        "that document",
        "this document",
        "from earlier",
        "i uploaded",
        "previous file",
        "last file",
        "summarize the file",
        "read the file",
    ];

    if (followupSignals.some((signal) => lower.includes(signal))) return true;
    if (extractPossibleFileNameHints(message).length > 0) return true;
    return false;
}

function matchDocsByHint(message: string, docs: UploadedDocRecord[]): UploadedDocRecord[] {
    const hints = extractPossibleFileNameHints(message);
    if (hints.length === 0) return [];

    const result: UploadedDocRecord[] = [];
    for (const doc of docs) {
        const normalizedDocName = normalizeName(doc.name);
        const matched = hints.some(
            (hint) => normalizedDocName.includes(hint) || hint.includes(normalizedDocName)
        );
        if (matched) result.push(doc);
    }
    return result;
}

function isAcknowledgementOnlyMessage(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;

    const simpleAck = new Set([
        "ok",
        "okay",
        "kk",
        "got it",
        "understood",
        "cool",
        "nice",
        "thanks",
        "thank you",
        "thx",
        "done",
        "perfect",
        "great",
    ]);

    if (simpleAck.has(normalized)) return true;

    const stripped = normalized.replace(/[.!?,\s]+$/g, "");
    return simpleAck.has(stripped);
}

function buildAttachmentFailureMessage(failedAttachments: ChatFailedAttachment[]): string | null {
    if (failedAttachments.length === 0) return null;
    const lines = failedAttachments.map(
        (item) => `- ${item.name}: ${item.reason || "Could not process this file"}`
    );
    return [
        "I could not process the following file(s), so I continued with the rest:",
        ...lines,
    ].join("\n");
}

function toFriendlyAttachmentReason(rawReason: string): string {
    const lower = rawReason.toLowerCase();
    if (lower.includes("document has no pages")) {
        return "Document appears empty or unreadable.";
    }
    if (lower.includes("invalid_argument")) {
        return "Unsupported or invalid file content.";
    }
    if (lower.includes("too large")) {
        return "File is too large.";
    }
    const compact = rawReason.replace(/\s+/g, " ").trim();
    if (compact.length <= 120) return compact;
    return `${compact.slice(0, 117)}...`;
}

function buildDirectAttachmentPrompt(personaContext: string): string {
    const attachmentDirective = `You are SnitchX assistant.

Current request contains user-uploaded files. You MUST answer directly from those uploaded files and MUST NOT emit <AGENT_INTENT>.
Do not delegate to Drive/Gmail/any other agent for this turn.
Exception: if the user explicitly asks for Stara/Strata financial analysis on uploaded files, you MAY delegate to strata-agent (action: upload_report).
If some files are missing or invalid, continue with valid files and clearly mention which files were skipped.`;

    return [attachmentDirective, personaContext].filter(Boolean).join("\n\n");
}

function normalizeFailedAttachments(raw: unknown): ChatFailedAttachment[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const casted = item as Record<string, unknown>;
            const name = typeof casted.name === "string" ? casted.name.trim() : "";
            const reason =
                typeof casted.reason === "string" && casted.reason.trim()
                    ? toFriendlyAttachmentReason(casted.reason.trim())
                    : "Could not process this file";
            if (!name) return null;
            return { name, reason };
        })
        .filter((item): item is ChatFailedAttachment => Boolean(item));
}

function validateRequestAttachmentPolicy(attachments: ChatAttachment[]): void {
    validateAttachmentCount(attachments.length);

    let totalBytes = 0;
    for (const attachment of attachments) {
        const size = Number(attachment.size || 0);
        if (size > 0) {
            validateSingleAttachmentSize(size, attachment.name || "attachment");
            totalBytes += size;
        }
        validateAttachmentType(attachment.name || "attachment", attachment.mimeType);
    }

    validateTotalAttachmentSize(totalBytes);
}

function buildOrchestrationPrompt(
    installedAgentIds: string[],
    accessibleAgentIds: string[]
): string {
    const installedRegistry = getInstalledAgentRegistry(accessibleAgentIds);
    const installedSet = new Set(installedAgentIds);
    const accessibleSet = new Set(accessibleAgentIds);

    const availableAgentDescriptions = installedRegistry
        .map(
            (agent) =>
                `- **${agent.name}** (id: "${agent.id}")\n` +
                `  Description: ${agent.description}\n` +
                `  Actions: ${agent.actions.join(", ")}\n` +
                `  Example prompts: ${agent.examplePrompts.map((prompt) => `"${prompt}"`).join(", ")}`
        )
        .join("\n\n");

    const unavailableDescriptions = AGENT_CATALOG
        .filter((agent) => !accessibleSet.has(agent.id))
        .map((agent) => {
            const reason = installedSet.has(agent.id)
                ? `Installed but not connected. ${getInstallHintForAgent(agent.id)}`
                : getInstallHintForAgent(agent.id);
            return `- ${agent.name} (${agent.id}): ${reason}`;
        })
        .join("\n");

    return `You are the orchestration AI of SnitchX, an AI assistant platform.

You can either answer questions directly OR delegate tasks to specialized agents.

## Currently Available Agents
${availableAgentDescriptions || "No agents are currently available for this user."}

## Unavailable Agents
${unavailableDescriptions || "All registered agents are available right now."}

## Core Rules
1. If a request should be delegated to an AVAILABLE agent, respond with ONLY a valid JSON object wrapped inside <AGENT_INTENT> tags. Do not include any explanation before or after the tags.
2. If a request needs an UNAVAILABLE agent, do NOT emit <AGENT_INTENT>. Respond normally and tell the user to install or connect the required agent first.
3. NEVER execute actions yourself. Only delegate using <AGENT_INTENT> for available agents.
4. If you are unsure which agent is needed, ask a concise clarification question instead of emitting <AGENT_INTENT>.
5. The JSON inside <AGENT_INTENT> must be valid and parseable: no comments, no trailing commas.
6. For potential medical emergencies (chest pain, breathing issues, severe injury), prefer the emergency-response-agent first.

## Agent Formatting Rules
For the teams-agent:
- make_call: extract "contact"
- send_message: extract "contact" and "message"
- schedule_meeting: extract "title", "attendees", "date", "time", "duration", "description", and "notification_preference"
- If notification preference is missing for a meeting request, do NOT emit <AGENT_INTENT>. Ask: "Would you like to be notified via WhatsApp, SMS, Call, All, or None?"

For the todo-agent:
- add_task: extract "title" and optional "datetime" in YYYY-MM-DD HH:MM
- add_to_plan: extract "title", optional "date", optional "time", optional "description", and optional "priority"
- list_tasks: optional "status"
- list_tasks_by_date: required "datetime" in YYYY-MM-DD
- get_daily_plan: extract "date" in YYYY-MM-DD when the user asks for a day's plan
- get_weekly_overview: extract optional "startDate" in YYYY-MM-DD
- delete_task and mark_done: use "task_id" if known, otherwise "title"
- Use the todo-agent for reminders, daily planning, and "remind me" requests unless the user explicitly asks for Google Tasks.

For the google-agent:
- Return this exact JSON shape:
  {
    "agent_required": "google-agent",
    "action": "<brief action label>",
    "parameters": {
      "agent_type": "<calendar|gmail|meet|drive|tasks|web_search>",
      "parameters": "<plain text details>"
    },
    "reasoning": "<brief explanation>"
  }
- For Gmail or Drive listing requests, NEVER request or return more than 20 items at once.
- Use "gmail" when the request is about Gmail inbox, reading emails, searching emails, or summarizing emails.
- Use "drive" when the request is about files, Google Docs, Drive documents, reading docs, or summarizing docs.
- Use "calendar" for calendar events, scheduling, and agendas.
- Use "meet" for Google Meet calls or links.
- Use "tasks" for Google Tasks or reminders.
- Use "web_search" for internet lookups.

For the maps-agent:
- get_directions: extract "origin", "destination", and optional "mode"
- search_places: extract "query", optional "location", and optional "radius"
- geocode: extract either "address" or "latlng"
- distance_matrix: extract "origins", "destinations", and optional "mode"

For the emergency-response-agent:
- assess_emergency: extract "description" from symptoms or emergency statement
- activate_emergency: extract "lat", "lng", optional "description", optional "radius"
- Use this agent for medical emergency triage requests (e.g., chest pain, breathing trouble, severe injury, urgent SOS).

For the notion-agent:
- search_pages: extract "query" and optional "limit"
- get_page: extract "pageId" when known, otherwise use "query"
- create_page: extract "title", "content", and optional "parentPageId"
- append_to_page: extract "pageId" when known, otherwise use "query" plus "content"

For the canva-agent:
- list_designs: extract optional "limit" (number of designs to show)
- create_design: extract "title" and optional "type" (e.g. "presentation", "social_media")

For the day-planner-agent:
- get_daily_plan: extract "date" in YYYY-MM-DD (default: today)
- add_to_plan: extract "title", optional "date" in YYYY-MM-DD, optional "time" (HH:MM), optional "description", optional "priority" (high/medium/low), optional "duration" in minutes
- get_weekly_overview: extract optional "startDate" in YYYY-MM-DD (default: this Monday)
- NOTE: day-planner-agent is different from todo-agent — use day-planner-agent when user asks to "plan my day" or "add to my daily planner"

For the discord-agent:
- get_user_info: no parameters needed
- list_guilds: no parameters needed

For the dropbox-agent:
- search_files: extract "query" (search term) and optional "limit"
- create_folder: extract "path" (e.g. "/NewFolder")
- move_file: extract "from_path" and "to_path"

For the freshdesk-agent:
- create_ticket: extract "subject", "description", optional "status" (2=Open default), optional "priority" (1=Low default)
- check_ticket_status: extract "ticket_id" (number)
- search_solutions: extract "keyword"
- list_tickets: extract optional "limit" (default 5)

For the github-agent:
- list_repositories: extract optional "limit" and optional "sort" (updated/created/pushed)
- search_repositories: extract "query"
- get_issue: extract "owner", "repo", and "issueNumber"
- create_issue: extract "owner", "repo", "title", and optional "body"
- If owner or repo are missing and user hasn't specified, ask: "Which repository? (format: owner/repo)"

For the gitlab-agent:
- list_projects: extract optional "limit" and optional "search" filter
- get_issue: extract "projectId" (e.g. "mygroup/myproject") and "issueIid" (internal issue number)
- create_issue: extract "projectId", "title", and optional "description"

For the greenhouse-agent:
- list_candidates: extract optional "job_id" and optional "candidate_status" (active/rejected/hired)
- get_candidate_resume: extract "candidate_id"
- schedule_interview: extract "candidate_id", "interviewer_email", "start_time" (ISO 8601), "end_time" (ISO 8601)

For the jira-agent:
- create_issue: extract "project_key", "summary", "description", optional "issue_type" (Bug/Task/Story)
- get_issue_status: extract "issue_key" (e.g. "PROJ-123")
- search_issues: extract "jql" (Jira Query Language string)
- list_issues: extract optional "limit" (default 5)

For the linkedin-agent:
- schedule_post: extract "content" (the post text) and optional "scheduled_time" (ISO datetime)
- analyze_engagement: no parameters needed
- If user asks to "post on LinkedIn", use schedule_post without scheduled_time for an immediate post

For the zoom-agent:
- create_meeting: extract "topic", optional "start_time" (UTC ISO format), optional "duration" (minutes)
- list_upcoming_meetings: extract optional "type" (scheduled/upcoming, default upcoming)
- get_meeting_summary: extract "meetingId"

For the strata-agent:
- open_workspace: extract optional "symbol", optional "month", optional "months"
- dashboard: extract optional "symbol", optional "month"
- trends: extract optional "symbol", optional "months"
- categories: extract optional "symbol", optional "month"
- ai_insights: extract optional "symbol"
- ask: extract "question" and optional "symbol"
- upload_report: extract optional "reportName" and pass through uploaded attachments only if explicitly present in this request
- Use strata-agent for company financial analytics, stock trend/snapshot interpretation, profitability breakdowns, and decision insights.

If an agent is needed, output ONLY:
<AGENT_INTENT>
{
  "agent_required": "<agent-id>",
  "action": "<action-name>",
  "parameters": {
    "key": "value"
  },
  "reasoning": "<brief explanation>"
}
</AGENT_INTENT>`;
}

function normalizeAgentIntent(parsed: Record<string, unknown>): AgentIntent | null {
    const action = typeof parsed.action === "string" ? parsed.action.trim() : "";
    if (!action) return null;

    const intent: AgentIntent = {
        agent_required: String(parsed.agent_required || "").trim(),
        action,
        parameters: {},
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
    };

    if (typeof parsed.parameters === "string") {
        intent.parameters = { parameters: parsed.parameters };
    } else if (typeof parsed.parameters === "object" && parsed.parameters !== null) {
        intent.parameters = { ...(parsed.parameters as Record<string, unknown>) };
    } else if (typeof parsed.parameters !== "undefined" && parsed.parameters !== null) {
        intent.parameters = { parameters: String(parsed.parameters) };
    }

    if (typeof parsed.agent_type === "string" && !intent.parameters.agent_type) {
        intent.parameters.agent_type = parsed.agent_type;
    }

    return intent;
}

function fuzzyMatchAgent(rawAgent: string) {
    return AGENT_CATALOG.find((agent) => {
        const id = agent.id.toLowerCase();
        const name = agent.name.toLowerCase();
        return (
            rawAgent === id ||
            rawAgent === id.replace("-", "_") ||
            rawAgent.includes(id.replace("-", "")) ||
            name.includes(rawAgent)
        );
    });
}

function normalizeGoogleIntent(intent: AgentIntent): AgentIntent {
    if (intent.agent_required !== "google-agent") return intent;

    const normalized: AgentIntent = {
        ...intent,
        parameters: { ...intent.parameters },
    };

    const currentAgentType =
        typeof normalized.parameters.agent_type === "string"
            ? normalized.parameters.agent_type.toLowerCase().trim()
            : "";

    if (GOOGLE_AGENT_TYPES.has(currentAgentType)) {
        normalized.parameters.agent_type = currentAgentType;
        return normalized;
    }

    const actionLower = normalized.action.toLowerCase().trim();
    if (GOOGLE_AGENT_TYPES.has(actionLower)) {
        normalized.parameters.agent_type = actionLower;
        return normalized;
    }

    const paramsText = String(normalized.parameters.parameters || "").toLowerCase();
    if (/\b(gmail|email|mail|inbox)\b/.test(paramsText)) normalized.parameters.agent_type = "gmail";
    else if (/\b(drive|file|files|docs?|documents?)\b/.test(paramsText)) normalized.parameters.agent_type = "drive";
    else if (/\b(calendar|event|schedule|agenda)\b/.test(paramsText)) normalized.parameters.agent_type = "calendar";
    else if (/\b(meet|meeting|video call)\b/.test(paramsText)) normalized.parameters.agent_type = "meet";
    else if (/\b(task|tasks|todo|to-do|remind)\b/.test(paramsText)) normalized.parameters.agent_type = "tasks";
    else if (/\b(search|web|internet|lookup|look up)\b/.test(paramsText)) normalized.parameters.agent_type = "web_search";

    return normalized;
}

function isStrataUploadIntent(intent: AgentIntent): boolean {
    if (intent.agent_required !== "strata-agent") return false;
    const action = intent.action.toLowerCase().trim();
    return action === "upload_report" || action === "analyze_report";
}

function tryParseAgentIntent(content: string): ParsedIntentResult | { error: true; fallback: string } | null {
    const tagMatch = content.match(/<AGENT_INTENT>([\s\S]*?)<\/AGENT_INTENT>/);

    if (!tagMatch) {
        return null;
    }

    const jsonStr = tagMatch[1].trim();
    const conversationalText = content.replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/, "").trim();

    try {
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed !== "object" || parsed === null) {
            return { error: true, fallback: "I could not understand that agent request. Please try again." };
        }

        const normalizedIntent = normalizeAgentIntent(parsed as Record<string, unknown>);
        if (!normalizedIntent) {
            return { error: true, fallback: "I could not understand that agent request. Please try again." };
        }

        const matchedAgent = fuzzyMatchAgent(String(normalizedIntent.agent_required || "").toLowerCase());
        if (!matchedAgent) {
            return { error: true, fallback: "I could not match that request to a supported agent." };
        }

        normalizedIntent.agent_required = matchedAgent.id;
        const finalIntent = normalizeGoogleIntent(normalizedIntent);

        if (
            finalIntent.agent_required === "google-agent" &&
            (typeof finalIntent.parameters.agent_type !== "string" ||
                !GOOGLE_AGENT_TYPES.has(finalIntent.parameters.agent_type.toLowerCase().trim()))
        ) {
            return {
                error: true,
                fallback:
                    "I could not determine which Google service to use. Please mention Gmail, Drive, Calendar, Meet, Tasks, or Web Search.",
            };
        }

        return { intent: finalIntent, conversationalText };
    } catch {
        return { error: true, fallback: "I generated an invalid agent payload. Please try again." };
    }
}

function getNumericRequestCount(text: string): number | null {
    const lower = text.toLowerCase();

    if (/\b(all|every)\s+(emails?|mails?|files?|documents?|docs?)\b/.test(lower)) {
        return 999;
    }

    const directMatch = lower.match(/\b(\d{1,4})\s+(latest\s+|recent\s+|last\s+)?(emails?|mails?|files?|documents?|docs?)\b/);
    if (directMatch) {
        return Number.parseInt(directMatch[1], 10);
    }

    return null;
}

function getGoogleIntentLimitViolation(intent: AgentIntent, userMessage: string): string | null {
    if (intent.agent_required !== "google-agent") return null;

    const rawAgentType = intent.parameters.agent_type;
    const agentType = typeof rawAgentType === "string" ? rawAgentType.toLowerCase() : "";
    if (agentType !== "gmail" && agentType !== "drive") return null;

    const requestedCount = getNumericRequestCount(userMessage) ?? getNumericRequestCount(String(intent.parameters.parameters || ""));
    if (requestedCount && requestedCount > 20) {
        const itemLabel = agentType === "gmail" ? "emails" : "files";
        return `I currently cannot display more than 20 ${itemLabel} at once. Please ask for 20 or fewer.`;
    }

    return null;
}

function resolveGeminiModel(model: string): string {
    return GEMINI_MODEL_ALIASES[model] || model;
}

function stripBase64Prefix(value: string): string {
    const trimmed = value.trim();
    const commaIndex = trimmed.indexOf(",");
    if (commaIndex === -1) return trimmed;
    return trimmed.slice(commaIndex + 1);
}

function createAbortError(): Error {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw createAbortError();
    }
}

function isAbortLikeError(error: unknown): boolean {
    if (!error) return false;

    if (error instanceof Error) {
        const name = (error.name || "").toLowerCase();
        const message = (error.message || "").toLowerCase();
        if (name === "aborterror") return true;
        if (message.includes("aborted")) return true;
        if (message.includes("controller is already closed")) return true;
    }

    if (typeof error === "object" && error !== null) {
        const code = String((error as { code?: unknown }).code || "").toUpperCase();
        if (code === "ABORT_ERR" || code === "ERR_ABORTED") return true;
    }

    return false;
}

async function refreshGoogleAccessToken(
    refreshToken: string,
    abortSignal?: AbortSignal
): Promise<string | null> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !refreshToken) return null;

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: abortSignal,
        body,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { access_token?: string };
    return payload.access_token || null;
}

function resolveDriveExportMimeType(sourceMimeType: string): string | null {
    switch (sourceMimeType) {
        case "application/vnd.google-apps.document":
            return "text/plain";
        case "application/vnd.google-apps.presentation":
            return "text/plain";
        case "application/vnd.google-apps.spreadsheet":
            return "text/csv";
        default:
            return null;
    }
}

async function fetchDriveAttachmentAsBase64(
    uid: string,
    attachment: ChatAttachment,
    abortSignal?: AbortSignal
): Promise<{ mimeType: string; dataBase64: string }> {
    throwIfAborted(abortSignal);

    const connection = await getProviderConnection(uid, "google");
    if (!connection?.accessToken) {
        throw new Error("Google Drive connection is required for Drive attachments.");
    }
    if (!attachment.driveFileId) {
        throw new Error(`Drive attachment "${attachment.name}" is missing a file id.`);
    }

    let accessToken = connection.accessToken;
    const exportMimeType = resolveDriveExportMimeType(attachment.mimeType);
    const requestUrl = exportMimeType
        ? `https://www.googleapis.com/drive/v3/files/${attachment.driveFileId}/export?mimeType=${encodeURIComponent(
              exportMimeType
          )}`
        : `https://www.googleapis.com/drive/v3/files/${attachment.driveFileId}?alt=media`;

    const requestWithToken = async (token: string) =>
        fetch(requestUrl, {
            headers: { Authorization: `Bearer ${token}` },
            signal: abortSignal,
        });

    let response = await requestWithToken(accessToken);
    if (response.status === 401 && connection.refreshToken) {
        const refreshed = await refreshGoogleAccessToken(connection.refreshToken, abortSignal);
        if (refreshed) {
            accessToken = refreshed;
            response = await requestWithToken(accessToken);
        }
    }

    if (!response.ok) {
        throw new Error(
            `Could not download Drive file "${attachment.name}" (status ${response.status}).`
        );
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > 0) {
        validateSingleAttachmentSize(contentLength, attachment.name || "drive-file");
    }

    throwIfAborted(abortSignal);
    const bytes = Buffer.from(await response.arrayBuffer());
    validateSingleAttachmentSize(bytes.length, attachment.name || "drive-file");

    return {
        mimeType: exportMimeType || attachment.mimeType || "application/octet-stream",
        dataBase64: bytes.toString("base64"),
    };
}

interface PreparedGeminiAttachmentPart {
    attachment: ChatAttachment;
    part: Part;
    estimatedBytes: number;
}

interface BuildAttachmentPartsResult {
    parts: PreparedGeminiAttachmentPart[];
    failed: ChatFailedAttachment[];
}

async function buildGeminiAttachmentParts(
    uid: string,
    attachments: ChatAttachment[],
    abortSignal?: AbortSignal
): Promise<BuildAttachmentPartsResult> {
    const parts: PreparedGeminiAttachmentPart[] = [];
    const failed: ChatFailedAttachment[] = [];
    let totalBytes = 0;

    for (const attachment of attachments) {
        throwIfAborted(abortSignal);
        try {
            if (attachment.source === "computer") {
                let dataBase64 = attachment.dataBase64 ? stripBase64Prefix(attachment.dataBase64) : "";
                if (!dataBase64 && attachment.storagePath) {
                    dataBase64 = await readStoredUploadedDocAsBase64(uid, attachment.storagePath);
                }
                if (!dataBase64) {
                    throw new Error("File data is missing.");
                }

                const approxBytes = Math.ceil((dataBase64.length * 3) / 4);
                validateSingleAttachmentSize(approxBytes, attachment.name || "attachment");
                validateTotalAttachmentSize(totalBytes + approxBytes);

                parts.push({
                    attachment,
                    estimatedBytes: approxBytes,
                    part: {
                        inlineData: {
                            mimeType: attachment.mimeType || "application/octet-stream",
                            data: dataBase64,
                        },
                    },
                });
                totalBytes += approxBytes;
                continue;
            }

            if (attachment.source === "drive") {
                const fetched = await fetchDriveAttachmentAsBase64(uid, attachment, abortSignal);
                const approxBytes = Math.ceil((fetched.dataBase64.length * 3) / 4);
                validateSingleAttachmentSize(approxBytes, attachment.name || "attachment");
                validateTotalAttachmentSize(totalBytes + approxBytes);

                parts.push({
                    attachment,
                    estimatedBytes: approxBytes,
                    part: {
                        inlineData: {
                            mimeType: fetched.mimeType,
                            data: fetched.dataBase64,
                        },
                    },
                });
                totalBytes += approxBytes;
                continue;
            }

            failed.push({
                name: attachment.name || "attachment",
                reason: "Unsupported attachment source.",
            });
        } catch (error) {
            failed.push({
                name: attachment.name || "attachment",
                reason: toFriendlyAttachmentReason(
                    error instanceof Error ? error.message : "Could not process this file."
                ),
            });
        }
    }

    return { parts, failed };
}

function uploadedDocToAttachment(doc: UploadedDocRecord): ChatAttachment | null {
    if (doc.source === "drive" && doc.driveFileId) {
        return {
            id: `uploaded-${doc.docId}`,
            source: "drive",
            name: doc.name,
            mimeType: doc.mimeType,
            size: doc.size,
            driveFileId: doc.driveFileId,
        };
    }

    if (doc.source === "computer" && doc.storagePath) {
        return {
            id: `uploaded-${doc.docId}`,
            source: "computer",
            name: doc.name,
            mimeType: doc.mimeType,
            size: doc.size,
            storagePath: doc.storagePath || undefined,
        };
    }

    return null;
}

function triggerMemoryExtraction(
    uid: string,
    chatId: string | undefined,
    messageId: string | undefined,
    content: string
): void {
    Promise.resolve()
        .then(async () => {
            try {
                if (!isTriggerMessage(content)) {
                    return;
                }

                const extracted = await extractMemories(content);
                if (extracted.length === 0) {
                    return;
                }

                const saved = await processExtractedMemories(
                    uid,
                    extracted,
                    "chat",
                    chatId ?? null,
                    messageId ?? null
                );

                if (saved > 0) {
                    rebuildPersona(uid).catch((err) =>
                        console.error("[MemoryPipeline] persona rebuild error:", err)
                    );
                }
            } catch (err) {
                console.error("[MemoryPipeline] error:", err);
            }
        })
        .catch((err) => console.error("[MemoryPipeline] unhandled:", err));
}

async function buildPersonaContext(uid: string, userMessage: string): Promise<string> {
    if (!isPersonalContextQuery(userMessage)) return "";

    try {
        const [persona, topMemories] = await Promise.all([
            getPersona(uid),
            getTopKMemories(uid, userMessage, 7),
        ]);

        const personaSection = formatPersonaForPrompt(persona);
        const memoriesSection = formatMemoriesForPrompt(topMemories);
        return [personaSection, memoriesSection].filter(Boolean).join("\n\n");
    } catch (err) {
        console.error("[PersonaContext] failed:", err);
        return "";
    }
}

async function streamOllamaChat(
    baseUrl: string,
    model: string,
    messages: { role: string; content: string }[],
    onDelta: (delta: string) => void,
    abortSignal?: AbortSignal
): Promise<string> {
    throwIfAborted(abortSignal);

    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
            model,
            messages,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Ollama returned status ${response.status}. ${errorText || "No details available."}`
        );
    }

    if (!response.body) {
        throw new Error("Ollama did not return a streaming body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
        if (abortSignal?.aborted) {
            try {
                await reader.cancel();
            } catch {
                // Ignore reader cancel races.
            }
            throw createAbortError();
        }
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const payload = JSON.parse(trimmed) as {
                done?: boolean;
                message?: { content?: string };
            };

            const delta = payload.message?.content || "";
            if (delta) {
                fullContent += delta;
                onDelta(delta);
            }
        }
    }

    if (buffer.trim()) {
        const payload = JSON.parse(buffer.trim()) as { message?: { content?: string } };
        const delta = payload.message?.content || "";
        if (delta) {
            fullContent += delta;
            onDelta(delta);
        }
    }

    return fullContent;
}

async function streamGeminiChat(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: { role: string; content: string }[],
    attachments: ChatAttachment[],
    uid: string,
    onDelta: (delta: string) => void,
    abortSignal?: AbortSignal
): Promise<{ content: string; failedAttachments: ChatFailedAttachment[] }> {
    throwIfAborted(abortSignal);

    const geminiModel = resolveGeminiModel(model);
    const ai = new GoogleGenAI({ apiKey });
    const geminiContentsBase: Array<{ role: "user" | "model"; parts: Part[] }> = [];

    for (const message of messages) {
        const role: "user" | "model" =
            message.role === "assistant" || message.role === "agent" ? "model" : "user";
        const content = message.content?.trim();
        if (!content) continue;

        geminiContentsBase.push({
            role,
            parts: [{ text: content }],
        });
    }

    if (geminiContentsBase.length === 0) {
        geminiContentsBase.push({
            role: "user",
            parts: [{ text: "Hello" }],
        });
    }

    const builtAttachments = await buildGeminiAttachmentParts(uid, attachments, abortSignal);
    let usableAttachments = [...builtAttachments.parts];
    const failedAttachments: ChatFailedAttachment[] = [...builtAttachments.failed];

    const buildContentsWithAttachments = (
        attachmentParts: PreparedGeminiAttachmentPart[]
    ): Array<{ role: "user" | "model"; parts: Part[] }> => {
        const contents = [...geminiContentsBase];
        if (attachmentParts.length > 0) {
            const attachmentLabel = attachmentParts
                .map((item) => item.attachment.name)
                .filter(Boolean)
                .join(", ");
            contents.push({
                role: "user",
                parts: [
                    {
                        text: attachmentLabel
                            ? `Use the attached file(s): ${attachmentLabel}`
                            : "Use the attached file(s).",
                    },
                    ...attachmentParts.map((item) => item.part),
                ],
            });
        }
        return contents;
    };

    const streamWithAttachments = async (attachmentParts: PreparedGeminiAttachmentPart[]) => {
        throwIfAborted(abortSignal);
        const stream = await ai.models.generateContentStream({
            model: geminiModel,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2,
                abortSignal,
            },
            contents: buildContentsWithAttachments(attachmentParts),
        });

        let fullContent = "";
        for await (const chunk of stream) {
            throwIfAborted(abortSignal);
            const delta = chunk.text || "";
            if (!delta) continue;
            fullContent += delta;
            onDelta(delta);
        }
        return fullContent.trim();
    };

    try {
        const content = await streamWithAttachments(usableAttachments);
        return { content, failedAttachments };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        const canRetryIndividually =
            usableAttachments.length > 1 &&
            /document has no pages|invalid_argument|failed to process/i.test(errorMessage);

        if (!canRetryIndividually) {
            throw error;
        }

        const stillUsable: PreparedGeminiAttachmentPart[] = [];
        for (const item of usableAttachments) {
            throwIfAborted(abortSignal);
            try {
                await ai.models.generateContent({
                    model: geminiModel,
                    config: {
                        systemInstruction:
                            "Check if this file can be read. Reply with only OK if readable.",
                        temperature: 0,
                        abortSignal,
                    },
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: "Validate this uploaded file." }, item.part],
                        },
                    ],
                });
                stillUsable.push(item);
            } catch (validationError) {
                failedAttachments.push({
                    name: item.attachment.name || "attachment",
                    reason: toFriendlyAttachmentReason(
                        validationError instanceof Error
                            ? validationError.message
                            : "Could not read this file."
                    ),
                });
            }
        }

        if (stillUsable.length === 0) {
            return {
                content:
                    "I couldn't process any of the uploaded files. Please re-upload them (PDF/image/document) and try again.",
                failedAttachments,
            };
        }

        usableAttachments = stillUsable;
        const content = await streamWithAttachments(usableAttachments);
        return { content, failedAttachments };
    }
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { messages, chatId, attachments = [], failedAttachments = [] } = body as {
            messages: ChatRequestMessage[];
            chatId?: string;
            model?: string;
            attachments?: ChatAttachment[];
            failedAttachments?: ChatFailedAttachment[];
        };

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Request body must include a non-empty messages array." },
                { status: 400 }
            );
        }

        const uid = verifiedUser.uid;
        cleanupExpiredUploadedDocs(uid).catch((error) => {
            console.error("[UploadedDocsCleanup] failed:", error);
        });
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
        const model = body.model || process.env.OLLAMA_DEFAULT_MODEL || "qwen3.5:397b-cloud";
        const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
        const normalizedFailedAttachments = normalizeFailedAttachments(failedAttachments);
        const usingGemini = isGeminiChatModel(model);
        const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
        const lastUserMessage =
            [...messages].reverse().find((message) => message.role === "user")?.content || "";
        let effectiveAttachments = normalizedAttachments;

        if (
            usingGemini &&
            effectiveAttachments.length === 0 &&
            lastUserMessage &&
            isUploadFollowupMessage(lastUserMessage)
        ) {
            const recentUploadedDocs = await listRecentUploadedDocs(uid, 10);
            let matchedDocs = matchDocsByHint(lastUserMessage, recentUploadedDocs);
            if (matchedDocs.length === 0 && recentUploadedDocs.length > 0) {
                matchedDocs = [recentUploadedDocs[0] as UploadedDocRecord];
            }

            effectiveAttachments = matchedDocs
                .map(uploadedDocToAttachment)
                .filter((item): item is ChatAttachment => Boolean(item));
        }

        if (effectiveAttachments.length > 0) {
            try {
                validateRequestAttachmentPolicy(effectiveAttachments);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Invalid attachment payload.";
                return NextResponse.json({ error: message }, { status: 400 });
            }
        }

        if (effectiveAttachments.length > 0 && !usingGemini) {
            return NextResponse.json(
                {
                    error:
                        "File attachments currently require a Gemini model. Please switch the model and try again.",
                },
                { status: 400 }
            );
        }

        if (usingGemini && !geminiApiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }

        // Avoid re-triggering agent tasks when user only sends an acknowledgement.
        if (isAcknowledgementOnlyMessage(lastUserMessage)) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    const ack = "Got it. Tell me the next task whenever you're ready.";
                    controller.enqueue(
                        encoder.encode(`event: text\ndata: ${JSON.stringify({ content: ack })}\n\n`)
                    );
                    controller.enqueue(
                        encoder.encode(
                            `event: done\ndata: ${JSON.stringify({ type: "chat", content: ack })}\n\n`
                        )
                    );
                    controller.close();
                },
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            });
        }

        const [installedAgentIds, accessibleAgentIds, personaContext] = await Promise.all([
            getInstalledAgentIds(uid),
            getAccessibleAgentIds(uid),
            buildPersonaContext(uid, lastUserMessage),
        ]);

        if (lastUserMessage) {
            triggerMemoryExtraction(uid, chatId, undefined, lastUserMessage);
        }

        const shouldForceDirectAttachmentResponse =
            usingGemini &&
            (effectiveAttachments.length > 0 || normalizedFailedAttachments.length > 0);
        const systemPrompt = shouldForceDirectAttachmentResponse
            ? buildDirectAttachmentPrompt(personaContext)
            : [buildOrchestrationPrompt(installedAgentIds, accessibleAgentIds), personaContext]
                  .filter(Boolean)
                  .join("\n\n");

        const messagesForModel = [
            { role: "system", content: systemPrompt },
            ...messages.map((message) => ({
                role: message.role === "agent" ? "assistant" : message.role,
                content: message.content,
            })),
        ];

        const encoder = new TextEncoder();
        const upstreamAbortController = new AbortController();
        let streamClosed = false;
        const stream = new ReadableStream({
            start(controller) {
                const abortUpstream = () => {
                    if (!upstreamAbortController.signal.aborted) {
                        upstreamAbortController.abort();
                    }
                };

                const safeClose = () => {
                    if (streamClosed) return;
                    streamClosed = true;
                    try {
                        controller.close();
                    } catch {
                        // Ignore close races when stream is already closed/cancelled.
                    }
                };

                const sendEvent = (event: string, data: Record<string, unknown>): boolean => {
                    if (streamClosed) return false;
                    try {
                        controller.enqueue(
                            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                        );
                        return true;
                    } catch {
                        streamClosed = true;
                        abortUpstream();
                        return false;
                    }
                };

                const run = async () => {
                    try {
                        let streamedText = "";
                        let heldBuffer = "";
                        let streamMode: "undecided" | "text" | "intent" = "undecided";

                        const handleDelta = (delta: string) => {
                            if (streamClosed) {
                                abortUpstream();
                                return;
                            }

                            heldBuffer += delta;

                            if (streamMode === "undecided") {
                                const trimmed = heldBuffer.trimStart();
                                if (!trimmed) return;

                                if (
                                    trimmed.startsWith("<AGENT_INTENT>") ||
                                    "<AGENT_INTENT>".startsWith(trimmed)
                                ) {
                                    streamMode = "intent";
                                    return;
                                }

                                if (trimmed.startsWith("<") && heldBuffer.length < 24) {
                                    return;
                                }

                                streamMode = "text";
                                streamedText += heldBuffer;
                                sendEvent("text", { content: heldBuffer });
                                heldBuffer = "";
                                return;
                            }

                            if (streamMode === "text") {
                                streamedText += delta;
                                sendEvent("text", { content: delta });
                            }
                        };

                        let attachmentFailuresForResponse = [...normalizedFailedAttachments];

                        const assistantContent = usingGemini
                            ? await (async () => {
                                  const result = await streamGeminiChat(
                                      geminiApiKey,
                                      model,
                                      systemPrompt,
                                      messages.map((message) => ({
                                          role: message.role === "agent" ? "assistant" : message.role,
                                          content: message.content,
                                      })),
                                      effectiveAttachments,
                                      uid,
                                      handleDelta,
                                      upstreamAbortController.signal
                                  );
                                  if (result.failedAttachments.length > 0) {
                                      attachmentFailuresForResponse = [
                                          ...attachmentFailuresForResponse,
                                          ...result.failedAttachments,
                                      ];
                                  }
                                  return result.content;
                              })()
                            : await streamOllamaChat(
                                  baseUrl,
                                  model,
                                  messagesForModel,
                                  handleDelta,
                                  upstreamAbortController.signal
                              );

                        const parsedIntentOrError = tryParseAgentIntent(assistantContent);
                        const parseResult =
                            shouldForceDirectAttachmentResponse &&
                            parsedIntentOrError &&
                            !("error" in parsedIntentOrError) &&
                            !isStrataUploadIntent(parsedIntentOrError.intent)
                                ? null
                                : parsedIntentOrError;
                        if (parseResult && "error" in parseResult) {
                            const fallback = parseResult.fallback;
                            if (!streamedText.trim()) {
                                sendEvent("text", { content: fallback });
                            }
                            sendEvent("done", { type: "chat", content: fallback });
                            safeClose();
                            return;
                        }

                        if (parseResult && chatId) {
                            const { intent } = parseResult;
                            const googleLimitMessage = getGoogleIntentLimitViolation(intent, lastUserMessage);
                            if (googleLimitMessage) {
                                if (!streamedText.trim()) {
                                    sendEvent("text", { content: googleLimitMessage });
                                }
                                sendEvent("done", { type: "chat", content: googleLimitMessage });
                                safeClose();
                                return;
                            }

                            if (!installedAgentIds.includes(intent.agent_required)) {
                                const installMessage = getInstallHintForAgent(intent.agent_required);
                                if (!streamedText.trim()) {
                                    sendEvent("text", { content: installMessage });
                                }
                                sendEvent("done", { type: "chat", content: installMessage });
                                safeClose();
                                return;
                            }

                            if (!accessibleAgentIds.includes(intent.agent_required)) {
                                const connectMessage = getInstallHintForAgent(intent.agent_required);
                                if (!streamedText.trim()) {
                                    sendEvent("text", { content: connectMessage });
                                }
                                sendEvent("done", { type: "chat", content: connectMessage });
                                safeClose();
                                return;
                            }

                            const agentInput: Record<string, unknown> = {
                                action: intent.action,
                                ...intent.parameters,
                            };

                            if (
                                isStrataUploadIntent(intent) &&
                                !Array.isArray(agentInput.attachments) &&
                                effectiveAttachments.length > 0
                            ) {
                                agentInput.attachments = effectiveAttachments.map((attachment) => ({
                                    name: attachment.name,
                                    mimeType: attachment.mimeType,
                                    size: attachment.size,
                                    source: attachment.source,
                                    driveFileId: attachment.driveFileId,
                                    storagePath: attachment.storagePath,
                                }));
                            }

                            const task = await createAgentTask({
                                userId: uid,
                                chatId,
                                agentId: intent.agent_required,
                                parentLLMRequest: intent as unknown as Record<string, unknown>,
                                agentInput,
                            });

                            executeAgentTask(task).catch((err) =>
                                console.error("[executeAgentTask] background error:", err)
                            );

                            const agentName =
                                getAgentCatalogEntry(intent.agent_required)?.name || intent.agent_required;
                            const content =
                                `Delegating to ${agentName}.\n\n` +
                                `Action: ${intent.action}` +
                                (intent.reasoning ? `\n\nReasoning: ${intent.reasoning}` : "");

                            sendEvent("agent_task", {
                                type: "agent_task",
                                taskId: task.taskId,
                                agentId: intent.agent_required,
                                status: "queued",
                                content,
                            });
                            sendEvent("done", {
                                type: "agent_task",
                                taskId: task.taskId,
                                agentId: intent.agent_required,
                                status: "queued",
                                content,
                            });
                            safeClose();
                            return;
                        }

                        const cleanContent = assistantContent
                            .replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/g, "")
                            .trim();
                        const failurePrefix = buildAttachmentFailureMessage(
                            attachmentFailuresForResponse
                        );
                        const combinedContent = [failurePrefix, cleanContent]
                            .filter(Boolean)
                            .join("\n\n")
                            .trim();

                        if (!streamedText.trim() && combinedContent) {
                            sendEvent("text", { content: combinedContent });
                        }

                        sendEvent("done", {
                            type: "chat",
                            content: combinedContent || streamedText || "No response received.",
                        });
                        safeClose();
                    } catch (error) {
                        if (isAbortLikeError(error) || upstreamAbortController.signal.aborted) {
                            safeClose();
                            return;
                        }
                        console.error("[Chat API Error]", error);
                        const message =
                            error instanceof Error ? error.message : "Internal server error";
                        sendEvent("error", { error: message });
                        safeClose();
                    }
                };

                void run();
            },
            cancel() {
                // Client disconnected (tab close/navigation/abort). Prevent late enqueue calls.
                // Abort upstream provider call too, so token/cost consumption stops ASAP.
                streamClosed = true;
                if (!upstreamAbortController.signal.aborted) {
                    upstreamAbortController.abort();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        console.error("[Chat API Error]", error);
        const message =
            error instanceof Error ? error.message : "Unknown error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
