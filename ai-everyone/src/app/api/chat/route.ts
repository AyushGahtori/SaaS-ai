/**
 * POST /api/chat
 *
 * Authenticated streaming chat route for Pian.
 *
 * - Verifies the Firebase ID token from the Authorization header
 * - Streams normal Ollama text responses incrementally
 * - Routes agent work through a parent-LLM orchestration loop
 * - Preserves the existing persona + memory pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import {
    GoogleGenAI,
    MediaResolution,
    Modality,
    type LiveServerMessage,
    type Part,
} from "@google/genai";
import { adminDb } from "@/lib/firebase-admin";
import { isTriggerMessage, isPersonalContextQuery } from "@/lib/memory/trigger-detector";
import { extractMemories } from "@/lib/memory/extractor";
import { processExtractedMemories } from "@/lib/memory/deduper";
import { rebuildPersona, formatPersonaForPrompt } from "@/lib/memory/persona-builder";
import { getPersona } from "@/lib/memory/memory-repository.server";
import { getTopKMemories, formatMemoriesForPrompt } from "@/lib/memory/retrieval";
import { getServerOllamaBaseUrls } from "@/lib/memory/server-ollama-base-urls";
import {
    getAccessibleAgentIds,
    getProviderConnection,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import { getAgentCatalogEntry } from "@/lib/agents/catalog";
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
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";
import { commitUsageSlot, reserveUsageSlot, UsageLimitError } from "@/lib/usage-limit";
import {
    runLangGraphOrchestration,
} from "@/lib/orchestrator/langgraph";
import { normalizeVoiceInputForRouting } from "@/lib/orchestrator/langgraph/text";

interface ChatRequestMessage {
    role: string;
    content: string;
    taskId?: string;
    agentId?: string;
    isVoice?: boolean;
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

const GEMINI_LIVE_VOICE_MODEL =
    process.env.GEMINI_LIVE_VOICE_MODEL ||
    process.env.GEMINI_VOICE_MODEL ||
    "models/gemini-3.2-flash-live-preview";
const GEMINI_LIVE_VOICE_FALLBACK_MODEL =
    process.env.GEMINI_LIVE_VOICE_FALLBACK_MODEL || "gemini-3.1-flash-live-preview";
const GEMINI_LIVE_VOICE_NAME = process.env.GEMINI_LIVE_VOICE_NAME || "Zephyr";

function createChatTraceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function elapsedMs(startedAt: number): number {
    return Date.now() - startedAt;
}

function previewLogText(value: unknown, maxLength = 500): string | null {
    if (typeof value !== "string") return null;
    const compact = value.replace(/\s+/g, " ").trim();
    if (!compact) return "";
    return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function chatTraceLog(
    traceId: string,
    stage: string,
    details: Record<string, unknown> = {}
): void {
    console.log(`[chat:${traceId}] ${stage}`, details);
}

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
    const attachmentDirective = `You are Pian assistant.

Current request contains user-uploaded files. You MUST answer directly from those uploaded files and MUST NOT emit <AGENT_INTENT>.
Do not delegate to Drive/Gmail/any other agent for this turn.
Exception: if the user explicitly asks for Stara/Strata financial analysis on uploaded files, you MAY delegate to strata-agent (action: upload_report).
If some files are missing or invalid, continue with valid files and clearly mention which files were skipped.`;

    return [attachmentDirective, personaContext].filter(Boolean).join("\n\n");
}

function buildAgentAccessContext(
    installedAgentIds: string[],
    accessibleAgentIds: string[]
): string {
    const installed = installedAgentIds
        .map((agentId) => {
            const agent = getAgentCatalogEntry(agentId);
            return agent ? `${agent.name} (${agent.id})` : agentId;
        })
        .sort((a, b) => a.localeCompare(b));

    const accessible = accessibleAgentIds
        .map((agentId) => {
            const agent = getAgentCatalogEntry(agentId);
            return agent ? `${agent.name} (${agent.id})` : agentId;
        })
        .sort((a, b) => a.localeCompare(b));

    return [
        "Current Pian agent access context:",
        `Installed agents count: ${installedAgentIds.length}`,
        installed.length > 0 ? `Installed agents: ${installed.join(", ")}` : "Installed agents: none",
        `Accessible agents count: ${accessibleAgentIds.length}`,
        accessible.length > 0 ? `Accessible agents: ${accessible.join(", ")}` : "Accessible agents: none",
        "If the user asks how many agents are installed or which agents are available, answer from this context.",
    ].join("\n");
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

function compactText(value: unknown, maxLength = 900): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function getRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function getStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
}

function mergeStringLists(...lists: string[][]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const list of lists) {
        for (const item of list) {
            const key = item.toLowerCase();
            if (!key || seen.has(key) || key === "specific_identifier") continue;
            seen.add(key);
            out.push(item);
        }
    }
    return out;
}

function summarizeAgentResultForModel(
    agentId: string,
    status: string,
    result?: Record<string, unknown> | null,
    fallbackContent?: string
): string {
    const nestedResult = getRecord(result?.result);
    const uiPayload = getRecord(result?.ui_payload);
    const recommendedActions = getStringList(result?.recommended_next_actions);
    const suggestedInputs = mergeStringLists(
        getStringList(result?.suggestedInputs),
        getStringList(result?.suggested_inputs),
        getStringList(uiPayload?.suggestedInputs),
        getStringList(nestedResult?.suggestedInputs),
        getStringList(nestedResult?.suggested_inputs),
        getStringList(nestedResult?.missing_fields)
    );

    const agentSaid =
        compactText(result?.message) ||
        compactText(result?.summary) ||
        compactText(result?.error) ||
        compactText(fallbackContent) ||
        "The agent returned a status update.";

    const lines = [
        `Previous agent task context:`,
        `Agent: ${agentId}`,
        `Status: ${status}`,
        `Agent said: ${agentSaid}`,
    ];

    if (suggestedInputs.length > 0) {
        lines.push(`Needed inputs: ${suggestedInputs.join(", ")}`);
    }

    if (recommendedActions.length > 0) {
        lines.push(`Recommended next action: ${recommendedActions.slice(0, 2).join(" | ")}`);
    }

    return lines.join("\n");
}

async function buildConversationMessagesForModel(
    uid: string,
    messages: ChatRequestMessage[]
): Promise<Array<{ role: string; content: string }>> {
    return Promise.all(
        messages.map(async (message) => {
            if (message.role !== "agent") {
                return {
                    role: message.role,
                    content: message.content,
                };
            }

            if (!message.taskId) {
                return {
                    role: "assistant",
                    content: `Previous agent task context:\n${message.content}`,
                };
            }

            try {
                const snap = await adminDb.collection("agentTasks").doc(message.taskId).get();
                const data = snap.exists ? snap.data() : null;
                const belongsToUser = data?.userId === uid;
                const status = typeof data?.status === "string" ? data.status : "unknown";
                const agentId =
                    typeof data?.agentId === "string"
                        ? data.agentId
                        : message.agentId || "unknown-agent";
                const result = getRecord(data?.agentOutput);

                return {
                    role: "assistant",
                    content: belongsToUser
                        ? summarizeAgentResultForModel(agentId, status, result, message.content)
                        : `Previous agent task context:\n${message.content}`,
                };
            } catch (error) {
                console.warn("[buildConversationMessagesForModel] failed to load task", {
                    taskId: message.taskId,
                    error,
                });
                return {
                    role: "assistant",
                    content: `Previous agent task context:\n${message.content}`,
                };
            }
        })
    );
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
    baseUrls: string[],
    model: string,
    messages: { role: string; content: string }[],
    onDelta: (delta: string) => void,
    abortSignal?: AbortSignal
): Promise<string> {
    throwIfAborted(abortSignal);

    const attempted: string[] = [];
    let lastError: unknown = null;

    for (const baseUrl of baseUrls) {
        attempted.push(baseUrl);
        try {
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
                    `Ollama at ${baseUrl} returned status ${response.status}. ${errorText || "No details available."
                    }`
                );
            }

            if (!response.body) {
                throw new Error(`Ollama at ${baseUrl} did not return a streaming body.`);
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
        } catch (error) {
            if (isAbortLikeError(error) || abortSignal?.aborted) {
                throw error;
            }
            lastError = error;
        }
    }

    const lastErrorMessage = lastError instanceof Error ? lastError.message : String(lastError || "Unknown error");
    throw new Error(
        `Unable to reach Ollama. Tried: ${attempted.join(", ")}. Last error: ${lastErrorMessage}`
    );
}

interface WavConversionOptions {
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
}

interface GeminiLiveVoiceResult {
    content: string;
    audioBase64: string;
    audioMimeType: string;
    model: string;
}

interface GeminiLiveAudioDelta {
    audioBase64: string;
    audioMimeType: string;
    model: string;
}

function parseAudioMimeType(mimeType: string): WavConversionOptions {
    const [fileType, ...params] = mimeType.split(";").map((item) => item.trim());
    const [, format] = fileType.split("/");
    const options: WavConversionOptions = {
        numChannels: 1,
        sampleRate: 24000,
        bitsPerSample: 16,
    };

    if (format?.startsWith("L")) {
        const bits = Number.parseInt(format.slice(1), 10);
        if (Number.isFinite(bits)) {
            options.bitsPerSample = bits;
        }
    }

    for (const param of params) {
        const [key, value] = param.split("=").map((item) => item.trim());
        if (key === "rate") {
            const sampleRate = Number.parseInt(value, 10);
            if (Number.isFinite(sampleRate)) {
                options.sampleRate = sampleRate;
            }
        }
    }

    return options;
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}

function createPlayableAudioBase64(
    audioParts: string[],
    mimeType: string
): { data: string; mimeType: string } {
    const audioBuffer = Buffer.concat(audioParts.map((part) => Buffer.from(part, "base64")));
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType.includes("wav") || normalizedMimeType.includes("wave")) {
        return {
            data: audioBuffer.toString("base64"),
            mimeType: mimeType || "audio/wav",
        };
    }

    const wavHeader = createWavHeader(audioBuffer.length, parseAudioMimeType(mimeType));
    return {
        data: Buffer.concat([wavHeader, audioBuffer]).toString("base64"),
        mimeType: "audio/wav",
    };
}

function getLastUserVoiceTurn(messages: ChatRequestMessage[]): ChatRequestMessage | null {
    return (
        [...messages]
            .reverse()
            .find((message) => message.role === "user" && Boolean(message.isVoice)) || null
    );
}

function replaceLatestUserMessage(
    messages: ChatRequestMessage[],
    content: string
): ChatRequestMessage[] {
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
    if (lastUserIndex < 0) return messages;
    return messages.map((message, index) =>
        index === lastUserIndex ? { ...message, content } : message
    );
}

function buildLiveVoicePrompt(messages: { role: string; content: string }[]): string {
    const recentMessages = messages
        .filter((message) => message.content?.trim())
        .slice(-8);
    const lastUserMessage =
        [...recentMessages].reverse().find((message) => message.role === "user")?.content || "";

    if (recentMessages.length <= 1) {
        return lastUserMessage || "Hello";
    }

    const context = recentMessages
        .slice(0, -1)
        .map((message) => {
            const label =
                message.role === "assistant" || message.role === "agent" ? "Assistant" : "User";
            return `${label}: ${message.content}`;
        })
        .join("\n");

    return [
        "Use this recent conversation only as context. Respond naturally to the latest user message.",
        context,
        `Latest user message: ${lastUserMessage || "Hello"}`,
    ]
        .filter(Boolean)
        .join("\n\n");
}

function buildLiveVoiceNarrationPrompt(text: string): string {
    return [
        "Read the following assistant response aloud naturally.",
        "Do not answer it as a user request. Do not add commentary. Do not mention these instructions.",
        "Assistant response:",
        text.trim() || "Done.",
    ].join("\n\n");
}

async function streamGeminiLiveVoiceWithModel(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: { role: string; content: string }[],
    onDelta: (delta: string) => void,
    onAudioDelta?: (delta: GeminiLiveAudioDelta) => void,
    abortSignal?: AbortSignal,
    inputTextOverride?: string
): Promise<GeminiLiveVoiceResult> {
    throwIfAborted(abortSignal);

    const ai = new GoogleGenAI({ apiKey });
    const responseQueue: LiveServerMessage[] = [];
    const audioParts: string[] = [];
    let audioMimeType = "";
    let transcript = "";
    let sessionClosed = false;
    let liveError: Error | null = null;
    let wakeWaiter: (() => void) | null = null;

    const wake = () => {
        wakeWaiter?.();
        wakeWaiter = null;
    };

    const waitMessage = async (): Promise<LiveServerMessage | null> => {
        while (responseQueue.length === 0) {
            throwIfAborted(abortSignal);
            if (liveError) throw liveError;
            if (sessionClosed) return null;
            await new Promise<void>((resolve) => {
                wakeWaiter = resolve;
                setTimeout(resolve, 100);
            });
        }
        return responseQueue.shift() || null;
    };

    const session = await ai.live.connect({
        model,
        callbacks: {
            onmessage(message) {
                responseQueue.push(message);
                wake();
            },
            onerror(error) {
                liveError = new Error(error.message || "Gemini Live voice session failed.");
                wake();
            },
            onclose() {
                sessionClosed = true;
                wake();
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: GEMINI_LIVE_VOICE_NAME,
                    },
                },
            },
            systemInstruction: systemPrompt,
            outputAudioTranscription: {},
            contextWindowCompression: {
                slidingWindow: {},
            },
        },
    });

    const closeSession = () => {
        try {
            session.close();
        } catch {
            // Ignore close races; the Live API may already have closed the socket.
        }
    };

    const abortListener = () => closeSession();
    abortSignal?.addEventListener("abort", abortListener, { once: true });

    try {
        session.sendRealtimeInput({
            text: inputTextOverride || buildLiveVoicePrompt(messages),
        });

        while (true) {
            const message = await waitMessage();
            if (!message) break;
            throwIfAborted(abortSignal);

            const serverContent = message.serverContent;
            const outputTranscript = serverContent?.outputTranscription?.text || "";
            if (outputTranscript) {
                transcript += outputTranscript;
                onDelta(outputTranscript);
            }

            for (const part of serverContent?.modelTurn?.parts || []) {
                if (part.inlineData?.data) {
                    audioParts.push(part.inlineData.data);
                    audioMimeType = part.inlineData.mimeType || audioMimeType;
                    onAudioDelta?.({
                        audioBase64: part.inlineData.data,
                        audioMimeType,
                        model,
                    });
                }

                if (part.text && !outputTranscript) {
                    transcript += part.text;
                    onDelta(part.text);
                }
            }

            if (serverContent?.turnComplete) {
                break;
            }
        }
    } finally {
        abortSignal?.removeEventListener("abort", abortListener);
        closeSession();
    }

    if (audioParts.length === 0) {
        throw new Error("Gemini Live did not return audio for this voice turn.");
    }

    const playableAudio = createPlayableAudioBase64(audioParts, audioMimeType);
    return {
        content: transcript.trim() || "Voice response generated.",
        audioBase64: playableAudio.data,
        audioMimeType: playableAudio.mimeType,
        model,
    };
}

async function streamGeminiLiveVoice(
    apiKey: string,
    systemPrompt: string,
    messages: { role: string; content: string }[],
    onDelta: (delta: string) => void,
    onAudioDelta?: (delta: GeminiLiveAudioDelta) => void,
    abortSignal?: AbortSignal
): Promise<GeminiLiveVoiceResult> {
    try {
        return await streamGeminiLiveVoiceWithModel(
            apiKey,
            GEMINI_LIVE_VOICE_MODEL,
            systemPrompt,
            messages,
            onDelta,
            onAudioDelta,
            abortSignal
        );
    } catch (error) {
        if (
            GEMINI_LIVE_VOICE_FALLBACK_MODEL === GEMINI_LIVE_VOICE_MODEL ||
            abortSignal?.aborted
        ) {
            throw error;
        }

        console.warn("[GeminiLiveVoice] primary model failed; retrying fallback", {
            primaryModel: GEMINI_LIVE_VOICE_MODEL,
            fallbackModel: GEMINI_LIVE_VOICE_FALLBACK_MODEL,
            error,
        });

        return streamGeminiLiveVoiceWithModel(
            apiKey,
            GEMINI_LIVE_VOICE_FALLBACK_MODEL,
            systemPrompt,
            messages,
            onDelta,
            onAudioDelta,
            abortSignal
        );
    }
}

async function streamGeminiLiveSpeech(
    apiKey: string,
    systemPrompt: string,
    text: string,
    onAudioDelta?: (delta: GeminiLiveAudioDelta) => void,
    abortSignal?: AbortSignal
): Promise<GeminiLiveVoiceResult> {
    const messages = [{ role: "assistant", content: text }];
    const inputText = buildLiveVoiceNarrationPrompt(text);

    try {
        return await streamGeminiLiveVoiceWithModel(
            apiKey,
            GEMINI_LIVE_VOICE_MODEL,
            systemPrompt,
            messages,
            () => {},
            onAudioDelta,
            abortSignal,
            inputText
        );
    } catch (error) {
        if (
            GEMINI_LIVE_VOICE_FALLBACK_MODEL === GEMINI_LIVE_VOICE_MODEL ||
            abortSignal?.aborted
        ) {
            throw error;
        }

        console.warn("[GeminiLiveSpeech] primary model failed; retrying fallback", {
            primaryModel: GEMINI_LIVE_VOICE_MODEL,
            fallbackModel: GEMINI_LIVE_VOICE_FALLBACK_MODEL,
            error,
        });

        return streamGeminiLiveVoiceWithModel(
            apiKey,
            GEMINI_LIVE_VOICE_FALLBACK_MODEL,
            systemPrompt,
            messages,
            () => {},
            onAudioDelta,
            abortSignal,
            inputText
        );
    }
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
    const traceId = createChatTraceId();
    const requestStartedAt = Date.now();
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
        await reserveUsageSlot(uid);
        cleanupExpiredUploadedDocs(uid).catch((error) => {
            console.error("[UploadedDocsCleanup] failed:", error);
        });
        const ollamaBaseUrls = getServerOllamaBaseUrls();
        const model =
            body.model || process.env.OLLAMA_DEFAULT_MODEL || "gemini-3-flash-preview";
        const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
        const normalizedFailedAttachments = normalizeFailedAttachments(failedAttachments);
        const isVoiceTurn = Boolean(getLastUserVoiceTurn(messages));
        const usingGemini = isGeminiChatModel(model);
        const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
        const lastUserMessage =
            [...messages].reverse().find((message) => message.role === "user")?.content || "";
        const routingUserMessage =
            isVoiceTurn ? normalizeVoiceInputForRouting(lastUserMessage) : lastUserMessage;
        const effectiveMessages =
            routingUserMessage !== lastUserMessage
                ? replaceLatestUserMessage(messages, routingUserMessage)
                : messages;
        let effectiveAttachments = normalizedAttachments;

        chatTraceLog(traceId, "request.received", {
            chatId: chatId || null,
            userId: uid,
            model,
            provider: usingGemini ? "gemini" : "ollama",
            isVoiceTurn,
            messageCount: messages.length,
            attachmentCount: normalizedAttachments.length,
            failedAttachmentCount: normalizedFailedAttachments.length,
            userQuery: previewLogText(lastUserMessage),
            ...(routingUserMessage !== lastUserMessage
                ? { normalizedVoiceQuery: previewLogText(routingUserMessage) }
                : {}),
        });

        if (
            usingGemini &&
            effectiveAttachments.length === 0 &&
            routingUserMessage &&
            isUploadFollowupMessage(routingUserMessage)
        ) {
            const recentUploadedDocs = await listRecentUploadedDocs(uid, 10);
            let matchedDocs = matchDocsByHint(routingUserMessage, recentUploadedDocs);
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

        // Avoid re-triggering agent tasks when user only sends an acknowledgement.
        if (isAcknowledgementOnlyMessage(routingUserMessage)) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    const ack = "Got it. Tell me the next task whenever you're ready.";
                    chatTraceLog(traceId, "response.acknowledgement", {
                        totalMs: elapsedMs(requestStartedAt),
                        content: ack,
                    });
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

        const setupStartedAt = Date.now();
        const [installedAgentIds, accessibleAgentIds, personaContext] = await Promise.all([
            getInstalledAgentIds(uid),
            getAccessibleAgentIds(uid),
            buildPersonaContext(uid, routingUserMessage),
        ]);
        chatTraceLog(traceId, "request.context.ready", {
            durationMs: elapsedMs(setupStartedAt),
            totalMs: elapsedMs(requestStartedAt),
            installedAgentCount: installedAgentIds.length,
            accessibleAgentCount: accessibleAgentIds.length,
            personaChars: personaContext.length,
        });

        if (routingUserMessage) {
            triggerMemoryExtraction(uid, chatId, undefined, routingUserMessage);
        }

        const shouldForceDirectAttachmentResponse =
            usingGemini &&
            (effectiveAttachments.length > 0 || normalizedFailedAttachments.length > 0);
        const orchestrationStartedAt = Date.now();
        const orchestrationResult = shouldForceDirectAttachmentResponse || !chatId
            ? null
            : await runLangGraphOrchestration({
                userId: uid,
                chatId,
                userInput: routingUserMessage,
                traceId,
                model,
                llmProvider: usingGemini ? "gemini" : "ollama",
                installedAgentIds,
                accessibleAgentIds,
                recentMessages: effectiveMessages.map((message) => ({
                    role: message.role,
                    content: message.content,
                    taskId: message.taskId,
                    agentId: message.agentId,
                })),
                attachments: effectiveAttachments.map((attachment) => ({
                    name: attachment.name,
                    mimeType: attachment.mimeType,
                    size: attachment.size,
                    source: attachment.source,
                    driveFileId: attachment.driveFileId,
                    storagePath: attachment.storagePath,
                })),
            });
        chatTraceLog(traceId, "orchestrator.result", {
            durationMs: elapsedMs(orchestrationStartedAt),
            totalMs: elapsedMs(requestStartedAt),
            skipped: shouldForceDirectAttachmentResponse || !chatId,
            handled: Boolean(orchestrationResult?.handled),
            type: orchestrationResult?.type || null,
            status: orchestrationResult?.status || null,
            taskId: orchestrationResult?.taskId || null,
            agentId: orchestrationResult?.agentId || null,
            targetAgent: orchestrationResult?.state?.route?.target_agent || null,
            targetAction: orchestrationResult?.state?.route?.target_action || null,
            confidence: orchestrationResult?.state?.route?.route_confidence || null,
            responsePreview: previewLogText(orchestrationResult?.content),
        });

        if (orchestrationResult?.handled) {
            await commitUsageSlot(uid);
            const encoder = new TextEncoder();
            const upstreamAbortController = new AbortController();
            let streamClosed = false;
            const stream = new ReadableStream({
                start(controller) {
                    const streamStartedAt = Date.now();
                    const safeClose = () => {
                        if (streamClosed) return;
                        streamClosed = true;
                        try {
                            controller.close();
                        } catch {
                            // Ignore close races when the browser aborts the stream.
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
                            upstreamAbortController.abort();
                            return false;
                        }
                    };

                    const speakHandledVoiceResult = async () => {
                        if (!isVoiceTurn || !orchestrationResult.content?.trim()) return;
                        if (orchestrationResult.type === "agent_task") return;
                        if (!geminiApiKey) return;

                        try {
                            const speechStartedAt = Date.now();
                            let firstAudioLogged = false;
                            await streamGeminiLiveSpeech(
                                geminiApiKey,
                                "You are Pian's voice renderer. Speak the supplied assistant response clearly and naturally.",
                                orchestrationResult.content,
                                (delta) => {
                                    if (!firstAudioLogged) {
                                        firstAudioLogged = true;
                                        chatTraceLog(traceId, "voice.first_audio_delta", {
                                            durationMs: elapsedMs(speechStartedAt),
                                            totalMs: elapsedMs(requestStartedAt),
                                            source: "handled_orchestration",
                                        });
                                    }
                                    sendEvent("audio_delta", { ...delta });
                                },
                                upstreamAbortController.signal
                            );
                            chatTraceLog(traceId, "voice.speech.completed", {
                                durationMs: elapsedMs(speechStartedAt),
                                totalMs: elapsedMs(requestStartedAt),
                                source: "handled_orchestration",
                            });
                        } catch (error) {
                            if (!isAbortLikeError(error) && !upstreamAbortController.signal.aborted) {
                                console.warn("[GeminiLiveSpeech] failed to narrate handled response", error);
                            }
                        }
                    };

                    const run = async () => {
                        if (orchestrationResult.content) {
                            chatTraceLog(traceId, "response.first_text_sent", {
                                durationMs: elapsedMs(streamStartedAt),
                                totalMs: elapsedMs(requestStartedAt),
                                source: "orchestration",
                                contentPreview: previewLogText(orchestrationResult.content),
                            });
                            sendEvent("text", { content: orchestrationResult.content });
                        }

                        await speakHandledVoiceResult();

                        if (
                            orchestrationResult.type === "agent_task" &&
                            orchestrationResult.taskId &&
                            orchestrationResult.agentId
                        ) {
                            const payload = {
                                type: "agent_task",
                                taskId: orchestrationResult.taskId,
                                agentId: orchestrationResult.agentId,
                                status: orchestrationResult.status,
                                ...(orchestrationResult.result ? { result: orchestrationResult.result } : {}),
                                content: orchestrationResult.content,
                                ...(orchestrationResult.meta ? { meta: orchestrationResult.meta } : {}),
                            };
                            sendEvent("agent_task", payload);
                            sendEvent("done", payload);
                            chatTraceLog(traceId, "response.done", {
                                totalMs: elapsedMs(requestStartedAt),
                                streamMs: elapsedMs(streamStartedAt),
                                type: "agent_task",
                                taskId: orchestrationResult.taskId,
                                agentId: orchestrationResult.agentId,
                                status: orchestrationResult.status,
                            });
                        } else {
                            sendEvent("done", {
                                type: "chat",
                                content: orchestrationResult.content,
                                ...(orchestrationResult.meta ? { meta: orchestrationResult.meta } : {}),
                            });
                            chatTraceLog(traceId, "response.done", {
                                totalMs: elapsedMs(requestStartedAt),
                                streamMs: elapsedMs(streamStartedAt),
                                type: "chat",
                                status: orchestrationResult.status,
                                contentChars: orchestrationResult.content.length,
                            });
                        }
                        safeClose();
                    };

                    void run();
                },
                cancel() {
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
        }

        if (usingGemini && !geminiApiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }
        const agentAccessContext = buildAgentAccessContext(installedAgentIds, accessibleAgentIds);
        const systemPrompt = shouldForceDirectAttachmentResponse
            ? buildDirectAttachmentPrompt(personaContext)
            : [
                "You are Pian assistant. Answer directly in natural language. Parent-LLM orchestration may already have handled any agent routing before this model call, so do not emit tool-routing JSON or <AGENT_INTENT> tags.",
                agentAccessContext,
                personaContext,
            ]
                .filter(Boolean)
                .join("\n\n");

        const conversationMessagesForModel = await buildConversationMessagesForModel(uid, effectiveMessages);
        const messagesForModel = [
            { role: "system", content: systemPrompt },
            ...conversationMessagesForModel,
        ];

        const encoder = new TextEncoder();
        const upstreamAbortController = new AbortController();
        let streamClosed = false;
        const stream = new ReadableStream({
            start(controller) {
                const streamStartedAt = Date.now();
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
                        const modelStartedAt = Date.now();
                        let firstTextLogged = false;
                        let firstAudioLogged = false;
                        let streamedText = "";
                        let heldBuffer = "";
                        let streamMode: "undecided" | "text" = "undecided";

                        const handleDelta = (delta: string) => {
                            if (streamClosed) {
                                abortUpstream();
                                return;
                            }

                            heldBuffer += delta;

                            if (streamMode === "undecided") {
                                const trimmed = heldBuffer.trimStart();
                                if (!trimmed) return;

                                streamMode = "text";
                                streamedText += heldBuffer;
                                if (!firstTextLogged) {
                                    firstTextLogged = true;
                                    chatTraceLog(traceId, "model.first_text_delta", {
                                        durationMs: elapsedMs(modelStartedAt),
                                        totalMs: elapsedMs(requestStartedAt),
                                        provider: usingGemini ? "gemini" : "ollama",
                                        model,
                                        preview: previewLogText(heldBuffer),
                                    });
                                }
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

                        let voiceAudioPayload: {
                            audioBase64: string;
                            audioMimeType: string;
                            model: string;
                        } | null = null;

                        let assistantContent: string;
                        const canUseDirectLiveVoice =
                            isVoiceTurn &&
                            usingGemini &&
                            geminiApiKey &&
                            effectiveAttachments.length === 0 &&
                            attachmentFailuresForResponse.length === 0;

                        chatTraceLog(traceId, "model.call.started", {
                            totalMs: elapsedMs(requestStartedAt),
                            provider: usingGemini ? "gemini" : "ollama",
                            model,
                            directLiveVoice: Boolean(canUseDirectLiveVoice),
                            attachmentCount: effectiveAttachments.length,
                        });

                        if (canUseDirectLiveVoice) {
                            try {
                                const liveVoiceStartedAt = Date.now();
                                const speechResult = await streamGeminiLiveVoice(
                                    geminiApiKey,
                                    systemPrompt,
                                    messages.map((message) => ({
                                        role: message.role === "agent" ? "assistant" : message.role,
                                        content: message.content,
                                    })),
                                    handleDelta,
                                    (delta) => {
                                        if (!firstAudioLogged) {
                                            firstAudioLogged = true;
                                            chatTraceLog(traceId, "voice.first_audio_delta", {
                                                durationMs: elapsedMs(liveVoiceStartedAt),
                                                totalMs: elapsedMs(requestStartedAt),
                                                source: "direct_live_voice",
                                            });
                                        }
                                        sendEvent("audio_delta", { ...delta });
                                    },
                                    upstreamAbortController.signal
                                );
                                assistantContent = speechResult.content;
                                voiceAudioPayload = {
                                    audioBase64: speechResult.audioBase64,
                                    audioMimeType: speechResult.audioMimeType,
                                    model: speechResult.model,
                                };
                                chatTraceLog(traceId, "model.direct_live_voice.completed", {
                                    durationMs: elapsedMs(liveVoiceStartedAt),
                                    totalMs: elapsedMs(requestStartedAt),
                                    model: speechResult.model,
                                    contentChars: assistantContent.length,
                                    audioChars: speechResult.audioBase64.length,
                                });
                            } catch (error) {
                                if (isAbortLikeError(error) || upstreamAbortController.signal.aborted) {
                                    throw error;
                                }
                                console.warn("[GeminiLiveVoice] direct voice turn failed; falling back to text then speech", error);
                                chatTraceLog(traceId, "model.direct_live_voice.failed", {
                                    durationMs: elapsedMs(modelStartedAt),
                                    totalMs: elapsedMs(requestStartedAt),
                                    error: error instanceof Error ? error.message : String(error),
                                });
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
                                assistantContent = result.content;
                            }
                        } else if (usingGemini) {
                            assistantContent = await (async () => {
                                const geminiStartedAt = Date.now();
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
                                chatTraceLog(traceId, "model.gemini.completed", {
                                    durationMs: elapsedMs(geminiStartedAt),
                                    totalMs: elapsedMs(requestStartedAt),
                                    model,
                                    contentChars: result.content.length,
                                    failedAttachmentCount: result.failedAttachments.length,
                                });
                                return result.content;
                            })();
                        } else {
                            const ollamaStartedAt = Date.now();
                            assistantContent = await streamOllamaChat(
                                ollamaBaseUrls,
                                model,
                                messagesForModel,
                                handleDelta,
                                upstreamAbortController.signal
                            );
                            chatTraceLog(traceId, "model.ollama.completed", {
                                durationMs: elapsedMs(ollamaStartedAt),
                                totalMs: elapsedMs(requestStartedAt),
                                model,
                                contentChars: assistantContent.length,
                            });
                        }
                        chatTraceLog(traceId, "model.call.completed", {
                            durationMs: elapsedMs(modelStartedAt),
                            totalMs: elapsedMs(requestStartedAt),
                            provider: usingGemini ? "gemini" : "ollama",
                            model,
                            contentPreview: previewLogText(assistantContent),
                        });
                        await commitUsageSlot(uid);

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
                            if (!firstTextLogged) {
                                firstTextLogged = true;
                                chatTraceLog(traceId, "model.first_text_delta", {
                                    durationMs: elapsedMs(modelStartedAt),
                                    totalMs: elapsedMs(requestStartedAt),
                                    provider: usingGemini ? "gemini" : "ollama",
                                    model,
                                    preview: previewLogText(combinedContent),
                                    fallbackBuffered: true,
                                });
                            }
                            sendEvent("text", { content: combinedContent });
                        }

                        if (isVoiceTurn && geminiApiKey && combinedContent && !voiceAudioPayload) {
                            try {
                                const speechStartedAt = Date.now();
                                const speechResult = await streamGeminiLiveSpeech(
                                    geminiApiKey,
                                    "You are Pian's voice renderer. Speak the supplied assistant response clearly and naturally.",
                                    combinedContent,
                                    (delta) => {
                                        if (!firstAudioLogged) {
                                            firstAudioLogged = true;
                                            chatTraceLog(traceId, "voice.first_audio_delta", {
                                                durationMs: elapsedMs(speechStartedAt),
                                                totalMs: elapsedMs(requestStartedAt),
                                                source: "post_text_speech",
                                            });
                                        }
                                        sendEvent("audio_delta", { ...delta });
                                    },
                                    upstreamAbortController.signal
                                );
                                voiceAudioPayload = {
                                    audioBase64: speechResult.audioBase64,
                                    audioMimeType: speechResult.audioMimeType,
                                    model: speechResult.model,
                                };
                                chatTraceLog(traceId, "voice.speech.completed", {
                                    durationMs: elapsedMs(speechStartedAt),
                                    totalMs: elapsedMs(requestStartedAt),
                                    source: "post_text_speech",
                                    model: speechResult.model,
                                    audioChars: speechResult.audioBase64.length,
                                });
                            } catch (error) {
                                if (!isAbortLikeError(error) && !upstreamAbortController.signal.aborted) {
                                    console.warn("[GeminiLiveSpeech] failed to narrate chat response", error);
                                }
                            }
                        }

                        sendEvent("done", {
                            type: "chat",
                            content: combinedContent || streamedText || "No response received.",
                            ...(voiceAudioPayload
                                ? {
                                    meta: {
                                        runtime: "google_genai_live",
                                        model: voiceAudioPayload.model,
                                        audioMimeType: voiceAudioPayload.audioMimeType,
                                    },
                                }
                                : {}),
                        });
                        chatTraceLog(traceId, "response.done", {
                            totalMs: elapsedMs(requestStartedAt),
                            streamMs: elapsedMs(streamStartedAt),
                            type: "chat",
                            provider: usingGemini ? "gemini" : "ollama",
                            model,
                            contentChars: (combinedContent || streamedText || "No response received.").length,
                            voiceAudio: Boolean(voiceAudioPayload),
                        });
                        safeClose();
                    } catch (error) {
                        if (streamClosed || isAbortLikeError(error) || upstreamAbortController.signal.aborted) {
                            chatTraceLog(traceId, "response.aborted", {
                                totalMs: elapsedMs(requestStartedAt),
                                streamMs: elapsedMs(streamStartedAt),
                            });
                            safeClose();
                            return;
                        }
                        if (error instanceof UsageLimitError) {
                            sendEvent("error", {
                                error: "You have reached your AI message limit. Please upgrade to continue.",
                            });
                            safeClose();
                            return;
                        }
                        console.error("[Chat API Error]", error);
                        chatTraceLog(traceId, "response.error", {
                            totalMs: elapsedMs(requestStartedAt),
                            error: error instanceof Error ? error.message : String(error),
                        });
                        const message = normalizeUserFacingError(error, {
                            surface: "chat",
                            fallbackMessage: "Internal server error",
                        }).message;
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
        // Intercept our custom Bouncer error!
        if (error instanceof UsageLimitError) {
            chatTraceLog(traceId, "request.usage_limit", {
                totalMs: elapsedMs(requestStartedAt),
            });
            return NextResponse.json(
                { error: "You have reached your AI message limit. Please upgrade to continue." },
                { status: 429 }
            );
        }

        console.error("[Chat API Error]", error);
        chatTraceLog(traceId, "request.failed", {
            totalMs: elapsedMs(requestStartedAt),
            error: error instanceof Error ? error.message : String(error),
        });
        const message = normalizeUserFacingError(error, {
            surface: "chat",
            fallbackMessage: "Unknown error occurred",
        }).message;
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
