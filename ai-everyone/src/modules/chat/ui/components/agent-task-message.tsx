/**
 * AgentTaskMessage — renders an agent task status card within the chat.
 *
 * Shows the agent name, current status (queued → running → success/failed),
 * and action buttons for the task result (e.g. "Open Teams Call").
 *
 * Uses the taskStatuses map from ChatContext for real-time updates.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import type { ChatMessage } from "@/modules/chat/types";
import { Bot, Loader2, CheckCircle, XCircle, Phone, MessageSquare, ExternalLink, Calendar, Key, ListTodo, Folder, FileText, FileImage, AlertTriangle, MapPin, Share2, Mail } from "lucide-react";
import { MicrosoftLoginCard, type DeviceFlowData } from "./microsoft-login-card";
import { GoogleLoginCard } from "./google-login-card";
import { subscribeToTask, type AgentTask } from "@/lib/firestore-tasks";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { auth } from "@/lib/firebase";
import { StrataResultCard } from "./agent-renderers/strata-result-card";
import { DiaHelperDiagramCard } from "./agent-renderers/dia-helper-diagram-card";
import { ShopGenieResultCard } from "./agent-renderers/shopgenie-result-card";
import { CareerPlanResultCard } from "./agent-renderers/career-plan-result-card";
import { InterpretedAgentGuidance } from "./agent-renderers/interpreted-agent-guidance";
import { GenericAgentResultCard } from "./agent-renderers/generic-agent-result-card";

interface AgentTaskMessageProps {
    message: ChatMessage;
}

/** Human-readable agent names. */
const AGENT_NAMES: Record<string, string> = {
    "teams-agent": "Microsoft Teams Agent",
    "email-agent": "Email Agent",
    "google-agent": "Google Workspace Agent",
    "notion-agent": "Notion Agent",
    "maps-agent": "Google Maps Agent",
    "todo-agent": "To-do Agent",
    "emergency-response-agent": "Emergency Response Agent",
    "strata-agent": "Stara Agent",
    "dia-helper-agent": "Dia Helper",
    "shopgenie-agent": "ShopGenie Agent",
};

interface GmailRow {
    from: string;
    subject: string;
    date: string;
    time: string;
}

interface DriveRow {
    name: string;
    mimeType: string;
    typeLabel: string;
    modifiedDate: string;
    modifiedTime: string;
}

interface DriveListMeta {
    hasMore: boolean;
    returnedCount: number;
    totalShown: number;
}

interface GuidancePayload {
    summary: string;
    suggestedAction?: string;
    suggestedInputs?: string[];
}

function getGuidanceFromTaskResult(
    rawStatus: string,
    result?: Record<string, unknown>
): GuidancePayload | null {
    if (!result) return null;
    if (rawStatus !== "needs_input" && rawStatus !== "failed") return null;

    const suggestedInputs = Array.isArray(result?.suggestedInputs)
        ? result.suggestedInputs.map((value) => String(value)).filter(Boolean)
        : undefined;

    const suggestedActionFromResult =
        typeof result?.suggestedAction === "string" && result.suggestedAction.trim()
            ? result.suggestedAction.trim()
            : undefined;

    const recommendedActions = Array.isArray(result?.recommended_next_actions)
        ? result.recommended_next_actions
            .map((value) => String(value).trim())
            .filter(Boolean)
        : [];

    const summary =
        (typeof result?.summary === "string" && result.summary.trim()) ||
        (typeof result?.message === "string" && result.message.trim()) ||
        (typeof result?.error === "string" && result.error.trim()) ||
        (rawStatus === "needs_input"
            ? "I need one more specific detail to continue."
            : "I couldn't complete this request yet.");

    const suggestedAction =
        suggestedActionFromResult ||
        recommendedActions[0] ||
        (suggestedInputs && suggestedInputs.length > 0
            ? `Please provide: ${suggestedInputs.join(", ")}.`
            : rawStatus === "needs_input"
                ? "Please share one specific detail and I'll retry immediately."
                : "Please share one additional detail so I can retry right away.");

    return {
        summary,
        suggestedAction,
        suggestedInputs,
    };
}

function getNeedsInputSummary(result?: Record<string, unknown>): string | null {
    if (!result) return null;
    const summary = result.summary;
    if (typeof summary === "string" && summary.trim()) {
        return summary.trim();
    }

    const message = result.message;
    if (typeof message === "string" && message.trim()) {
        return message.trim();
    }

    const payload =
        typeof result.result === "object" && result.result !== null
            ? (result.result as Record<string, unknown>)
            : undefined;
    const missing = payload?.missing_fields;
    if (Array.isArray(missing) && missing.length > 0) {
        return `More details are needed: ${missing.map((field) => String(field)).join(", ")}.`;
    }

    return null;
}

function normalizeString(value: unknown, fallback = "-") {
    if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
    }
    return fallback;
}

function formatDateAndTime(value: unknown): { date: string; time: string } {
    if (typeof value !== "string" || !value.trim()) {
        return { date: "-", time: "-" };
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return {
            date: parsed.toLocaleDateString("en-CA"),
            time: parsed.toLocaleTimeString("en-GB", { hour12: false }),
        };
    }

    const split = value.split(" ");
    return {
        date: split.slice(0, 4).join(" ") || value,
        time: split.slice(4).join(" ") || "-",
    };
}

function getGmailRows(result: Record<string, unknown>): GmailRow[] {
    const payload = (result.result as Record<string, unknown> | undefined) || result;
    const emails = payload.emails;
    if (!Array.isArray(emails)) {
        return [];
    }

    return emails.map((email) => {
        const item = (email || {}) as Record<string, unknown>;
        const dateTime = formatDateAndTime(item.date);
        return {
            from: normalizeString(item.from),
            subject: normalizeString(item.subject),
            date: dateTime.date,
            time: dateTime.time,
        };
    });
}

function getDriveTypeLabel(name: string, mimeType: string): string {
    const lowerName = name.toLowerCase();
    const lowerMime = mimeType.toLowerCase();

    if (lowerMime.includes("folder")) return "folder";
    if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) return ".pdf";
    if (lowerMime.includes("jpeg") || lowerMime.includes("jpg") || lowerMime.includes("png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png")) return ".jpg";
    if (lowerMime.includes("document") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) return ".docx";
    if (lowerName.endsWith(".txt")) return ".txt";
    return mimeType || "file";
}

function getDriveRows(result: Record<string, unknown>): DriveRow[] {
    const payload = (result.result as Record<string, unknown> | undefined) || result;
    const files = payload.files;
    if (!Array.isArray(files)) {
        return [];
    }

    return files.map((file) => {
        const item = (file || {}) as Record<string, unknown>;
        const name = normalizeString(item.name);
        const mimeType = normalizeString(item.mimeType, "file");
        const dateTime = formatDateAndTime(item.modifiedTime);
        return {
            name,
            mimeType,
            typeLabel: getDriveTypeLabel(name, mimeType),
            modifiedDate: dateTime.date,
            modifiedTime: dateTime.time,
        };
    });
}

function getDriveListMeta(result: Record<string, unknown>, rows: DriveRow[]): DriveListMeta {
    const payload = (result.result as Record<string, unknown> | undefined) || result;
    const hasMore = payload.hasMore === true;
    const returnedCount =
        typeof payload.returnedCount === "number" ? Number(payload.returnedCount) : rows.length;
    const totalShown =
        typeof payload.totalShown === "number" ? Number(payload.totalShown) : returnedCount;
    return { hasMore, returnedCount, totalShown };
}

function DriveTypeIcon({ typeLabel }: { typeLabel: string }) {
    const lower = typeLabel.toLowerCase();
    if (lower === "folder") return <Folder className="w-3.5 h-3.5 text-yellow-300" />;
    if (lower.includes("jpg") || lower.includes("png")) return <FileImage className="w-3.5 h-3.5 text-sky-300" />;
    return <FileText className="w-3.5 h-3.5 text-blue-300" />;
}

function GmailTableCard({ rows }: { rows: GmailRow[] }) {
    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 overflow-hidden">
            <div className="grid grid-cols-[1.3fr_2.2fr_1fr_1fr] gap-3 px-3 py-2.5 text-[11px] uppercase tracking-wide text-white/50 border-b border-white/10">
                <span>From</span>
                <span>Subject</span>
                <span>Date</span>
                <span>Time</span>
            </div>
            <div className="custom-scrollbar max-h-48 overflow-y-auto">
                {rows.map((row, idx) => (
                    <div key={`${row.from}-${row.subject}-${idx}`} className="grid grid-cols-[1.3fr_2.2fr_1fr_1fr] gap-3 px-3 py-2.5 text-xs text-white/85 border-b border-white/5 last:border-b-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <GeneratedAvatar seed={row.from} variant="botttsNeutral" className="h-5 w-5" />
                            <span className="truncate">{row.from}</span>
                        </div>
                        <span className="truncate">{row.subject}</span>
                        <span className="truncate text-white/70">{row.date}</span>
                        <span className="truncate text-white/70">{row.time}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DriveTableCard({ rows, meta }: { rows: DriveRow[]; meta: DriveListMeta }) {
    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 overflow-hidden">
            <div className="grid grid-cols-[2fr_1.1fr_1fr_1fr] gap-3 px-3 py-2.5 text-[11px] uppercase tracking-wide text-white/50 border-b border-white/10">
                <span>Name</span>
                <span>Type</span>
                <span>Modified Date</span>
                <span>Modified Time</span>
            </div>
            <div className="custom-scrollbar-always max-h-48 overflow-y-auto">
                {rows.map((row, idx) => (
                    <div key={`${row.name}-${idx}`} className="grid grid-cols-[2fr_1.1fr_1fr_1fr] gap-3 px-3 py-2.5 text-xs text-white/85 border-b border-white/5 last:border-b-0">
                        <span className="truncate">{row.name}</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                            <DriveTypeIcon typeLabel={row.typeLabel} />
                            <span className="truncate">{row.typeLabel}</span>
                        </div>
                        <span className="truncate text-white/70">{row.modifiedDate}</span>
                        <span className="truncate text-white/70">{row.modifiedTime}</span>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-[11px] text-white/55">
                <span>Showing {meta.returnedCount} item(s)</span>
                <span>{meta.hasMore ? "More files available. Ask for next batch." : `Total shown in this session: ${meta.totalShown}`}</span>
            </div>
        </div>
    );
}

export const AgentTaskMessage: React.FC<AgentTaskMessageProps> = ({ message }) => {
    const { taskStatuses } = useChatContext();
    const [localTask, setLocalTask] = useState<AgentTask | null>(null);
    const [emergencyResult, setEmergencyResult] = useState<Record<string, unknown> | null>(null);
    const [emergencyLoading, setEmergencyLoading] = useState(false);
    const [emergencyError, setEmergencyError] = useState<string | null>(null);
    const [emailTo, setEmailTo] = useState("");
    const [emailStatus, setEmailStatus] = useState<string | null>(null);

    const taskId = message.taskId;
    const agentId = message.agentId || "unknown";
    const agentName = AGENT_NAMES[agentId] || agentId;

    useEffect(() => {
        if (!taskId) return;
        const unsub = subscribeToTask(taskId, (task) => {
            setLocalTask(task);
        });
        return () => unsub();
    }, [taskId]);

    const globalTaskStatus = taskId ? taskStatuses[taskId] : undefined;

    // priority local firestore task over global contextual fallback 
    const rawStatus = localTask?.status || globalTaskStatus?.status || "queued";
    const result = (localTask?.agentOutput || globalTaskStatus?.result) as Record<string, unknown> | undefined;
    const interpretedFailed =
        rawStatus === "failed" && Boolean(result && result.interpreted === true);
    const status = interpretedFailed ? "needs_input" : rawStatus;
    const guidancePayload = getGuidanceFromTaskResult(rawStatus, result);
    if (guidancePayload) {
        return (
            <InterpretedAgentGuidance
                summary={guidancePayload.summary}
                suggestedAction={guidancePayload.suggestedAction}
                suggestedInputs={guidancePayload.suggestedInputs}
            />
        );
    }

    const isInterpretedGuidance = Boolean(
        result &&
        result.interpreted === true &&
        (rawStatus === "failed" || rawStatus === "needs_input")
    );

    if (isInterpretedGuidance) {
        const summary =
            (typeof result?.summary === "string" && result.summary) ||
            (typeof result?.error === "string" && result.error) ||
            "I couldn't complete that yet. Please share one more detail so I can continue.";
        const suggestedAction =
            typeof result?.suggestedAction === "string" ? result.suggestedAction : undefined;
        const suggestedInputs = Array.isArray(result?.suggestedInputs)
            ? result.suggestedInputs.map((value) => String(value))
            : undefined;

        return (
            <InterpretedAgentGuidance
                summary={summary}
                suggestedAction={suggestedAction}
                suggestedInputs={suggestedInputs}
            />
        );
    }

    if (rawStatus === "needs_input" && result) {
        const summary = getNeedsInputSummary(result);
        if (summary) {
            const nestedResult =
                typeof result.result === "object" && result.result !== null
                    ? (result.result as Record<string, unknown>)
                    : undefined;
            const missingFields = Array.isArray(nestedResult?.missing_fields)
                ? nestedResult?.missing_fields.map((value) => String(value)).filter(Boolean)
                : undefined;
            const suggestedAction =
                missingFields && missingFields.length > 0
                    ? `Please share: ${missingFields.join(", ")}.`
                    : "Please share one more specific detail and I’ll retry immediately.";
            return (
                <InterpretedAgentGuidance
                    summary={summary}
                    suggestedAction={suggestedAction}
                    suggestedInputs={missingFields}
                />
            );
        }
    }

    if (rawStatus === "failed" && result) {
        const summary =
            (typeof result.summary === "string" && result.summary.trim()) ||
            (typeof result.error === "string" && result.error.trim()) ||
            "I couldn't complete that request yet.";
        return (
            <InterpretedAgentGuidance
                summary={summary}
                suggestedAction="Share one more specific detail and I’ll retry immediately."
            />
        );
    }

    // ── Handle action buttons based on agent result ──────────────────────
    const handleAction = () => {
        if (!result) return;

        const resultType = result.type as string;
        const url = result.url as string;

        if (url && (resultType === "teams_call" || resultType === "teams_message")) {
            window.open(url, "_blank");
        }
    };

    const activateEmergency = async () => {
        if (!result) return;
        const triagePayload = (result.result as Record<string, unknown> | undefined) || {};
        const description =
            (triagePayload.originalDescription as string) ||
            (triagePayload.emergencyMessage as string) ||
            (message.content || "");

        if (!navigator.geolocation) {
            setEmergencyError("Geolocation is not supported in this browser.");
            return;
        }

        setEmergencyLoading(true);
        setEmergencyError(null);

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                });
            });

            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                throw new Error("Authentication expired. Please sign in again.");
            }

            const response = await fetch("/api/agents/emergency/escalate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    description,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    radius: 5000,
                }),
            });

            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
            if (!response.ok || payload.status !== "success") {
                throw new Error((payload.error as string) || "Failed to activate emergency response.");
            }
            const responseResult = (payload.result as Record<string, unknown> | undefined) || payload;
            setEmergencyResult(responseResult);
        } catch (error) {
            setEmergencyError(error instanceof Error ? error.message : "Failed to activate emergency response.");
        } finally {
            setEmergencyLoading(false);
        }
    };

    const sendEmergencyEmail = async () => {
        if (!emergencyResult) return;
        if (!emailTo.trim()) {
            setEmailStatus("Enter a recipient email first.");
            return;
        }

        const share = (emergencyResult.share as Record<string, unknown> | undefined) || {};
        const subject = (share.emailSubject as string) || "Emergency alert";
        const body = (share.emailBody as string) || (share.copyMessage as string) || "Emergency assistance required.";

        try {
            setEmailStatus("Sending...");
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication expired.");

            const response = await fetch("/api/agents/emergency/share-email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    to: emailTo.trim(),
                    subject,
                    body,
                    emergencyPayload: emergencyResult,
                }),
            });

            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
            if (!response.ok || payload.status !== "success") {
                throw new Error((payload.error as string) || "Email send failed.");
            }
            setEmailStatus("Emergency email sent.");
        } catch (error) {
            setEmailStatus(error instanceof Error ? error.message : "Email send failed.");
        }
    };

    // ── Status icon & badge ─────────────────────────────────────────────
    const StatusIcon = () => {
        switch (status) {
            case "queued":
                return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
            case "running":
                return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
            case "action_required":
                return <Key className="w-4 h-4 text-sky-400" />;
            case "needs_input":
                return <AlertTriangle className="w-4 h-4 text-amber-300" />;
            case "success":
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case "partial_success":
                return <CheckCircle className="w-4 h-4 text-emerald-300" />;
            case "failed":
                return <XCircle className="w-4 h-4 text-red-400" />;
            default:
                return <Bot className="w-4 h-4 text-white/60" />;
        }
    };

    const statusColors: Record<string, string> = {
        queued: "border-yellow-500/20 bg-yellow-500/5",
        running: "border-blue-500/20 bg-blue-500/5",
        action_required: "border-sky-500/20 bg-sky-500/5",
        needs_input: "border-amber-500/20 bg-amber-500/5",
        success: "border-green-500/20 bg-green-500/5",
        partial_success: "border-emerald-500/20 bg-emerald-500/5",
        failed: "border-red-500/20 bg-red-500/5",
    };

    const statusLabels: Record<string, string> = {
        queued: "Queued",
        running: "Running...",
        action_required: "Auth Required",
        needs_input: "Needs Input",
        success: "Completed",
        partial_success: "Partial Success",
        failed: "Failed",
    };

    // ── Action button based on result type ───────────────────────────────
    const ActionButton = () => {
        if (!result) return null;

        if (status === "action_required" && result.type === "device_auth" && result.flow) {
            return (
                <MicrosoftLoginCard
                    deviceData={result.flow as DeviceFlowData}
                    onAuthenticated={() => {
                        fetch("/api/tasks/retry", {
                            method: "POST",
                            body: JSON.stringify({ taskId: message.taskId }),
                            headers: { "Content-Type": "application/json" }
                        }).catch(console.error);
                    }}
                />
            );
        }

        if (status === "action_required" && result.type === "google_auth") {
            const nestedResult = result.result as Record<string, unknown> | undefined;
            const authUrl = (result.auth_url as string) || (nestedResult?.auth_url as string) || "/api/google-auth/login";
            return (
                <GoogleLoginCard
                    authUrl={authUrl}
                    onAuthenticated={() => {
                        fetch("/api/tasks/retry", {
                            method: "POST",
                            body: JSON.stringify({ taskId: message.taskId }),
                            headers: { "Content-Type": "application/json" }
                        }).catch(console.error);
                    }}
                />
            );
        }

        if (status !== "success") return null;

        const resultType = result.type as string;
        const displayName = result.displayName as string || "";
        const email = result.email as string || "";

        if (resultType === "teams_call") {
            return (
                <button
                    onClick={handleAction}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm font-medium transition-colors"
                >
                    <Phone className="w-4 h-4" />
                    Call {displayName || email} on Teams
                    <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                </button>
            );
        }

        if (resultType === "teams_message") {
            return (
                <button
                    onClick={handleAction}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-colors"
                >
                    <MessageSquare className="w-4 h-4" />
                    Message {displayName || email} on Teams
                    <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                </button>
            );
        }

        if (resultType === "teams_meeting") {
            const teamsUrl = result.teamsUrl as string | undefined;
            const outlookUrl = result.outlookUrl as string | undefined;
            const title = result.title as string | undefined;
            const date = result.date as string | undefined;
            const time = result.time as string | undefined;
            const duration = result.duration as number | undefined;
            const resolvedAttendees = result.resolvedAttendees as { name: string; email: string }[] | undefined;
            const unresolvedAttendees = result.unresolvedAttendees as string[] | undefined;

            return (
                <div className="mt-3 space-y-3">
                    {/* Meeting summary card */}
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm space-y-1">
                        {title && <p className="font-semibold text-white">{title}</p>}
                        {date && time && (
                            <p className="text-white/60 text-xs">
                                {date} at {time}{duration ? ` · ${duration} min` : ""}
                            </p>
                        )}
                        {resolvedAttendees && resolvedAttendees.length > 0 && (
                            <div className="text-xs text-white/50 mt-1">
                                <span className="text-white/40">Attendees: </span>
                                {resolvedAttendees.map((a) => a.name).join(", ")}
                            </div>
                        )}
                        {unresolvedAttendees && unresolvedAttendees.length > 0 && (
                            <p className="text-xs text-yellow-400/70 mt-1">
                                ⚠ Could not resolve: {unresolvedAttendees.join(", ")}
                            </p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        {teamsUrl && (
                            <button
                                onClick={() => window.open(teamsUrl, "_blank")}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm font-medium transition-colors"
                            >
                                <Calendar className="w-4 h-4" />
                                Open in Teams
                                <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                            </button>
                        )}
                        {outlookUrl && (
                            <button
                                onClick={() => window.open(outlookUrl, "_blank")}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-sm font-medium transition-colors"
                            >
                                <Calendar className="w-4 h-4" />
                                Open in Outlook
                                <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        if (resultType === "todo_action") {
            const msg = result.message as string || "Task updated successfully.";
            return (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    <span>{msg}</span>
                </div>
            );
        }

        if (resultType === "todo_list") {
            const tasks = (result.tasks as any[]) || [];
            const msg = result.message as string || `Found ${tasks.length} tasks.`;

            return (
                <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-2">
                        <ListTodo className="w-4 h-4" />
                        <span>{msg}</span>
                    </div>
                    {tasks.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {tasks.map((t, i) => (
                                <div key={t._id || i} className="flex flex-col px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className={`font-medium ${t.status === 'done' ? 'text-white/40 line-through' : 'text-white/90'}`}>{t.title}</span>
                                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${t.status === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                            {t.status}
                                        </span>
                                    </div>
                                    {t.datetime && (
                                        <div className="text-xs text-white/50 mt-1 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {t.datetime}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (resultType === "emergency_triage") {
            const triage = (result.result as Record<string, unknown> | undefined) || {};
            const warningSigns = Array.isArray(triage.warningSigns) ? (triage.warningSigns as string[]) : [];
            const homeRemedies = Array.isArray(triage.homeRemedies) ? (triage.homeRemedies as string[]) : [];
            const severity = (triage.severity as string) || "high";
            const severityBadge =
                severity === "critical"
                    ? "bg-red-500/15 text-red-300 border-red-500/30"
                    : severity === "high"
                        ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                        : "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";

            return (
                <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${severityBadge}`}>
                            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                            {severity}
                        </span>
                        <span className="text-xs text-white/60">Immediate caution advised</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 whitespace-pre-wrap">
                        {String(triage.advice || result.message || "Emergency triage generated.")}
                    </div>

                    {warningSigns.length > 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-xs font-semibold uppercase text-white/60">Warning Signs</p>
                            <ul className="mt-2 space-y-1 text-sm text-white/80">
                                {warningSigns.map((item, idx) => (
                                    <li key={`${item}-${idx}`}>• {item}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {homeRemedies.length > 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-xs font-semibold uppercase text-white/60">While Waiting For Help</p>
                            <ul className="mt-2 space-y-1 text-sm text-white/80">
                                {homeRemedies.map((item, idx) => (
                                    <li key={`${item}-${idx}`}>• {item}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {!emergencyResult ? (
                        <button
                            onClick={activateEmergency}
                            disabled={emergencyLoading}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-60"
                        >
                            {emergencyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                            {emergencyLoading ? "Activating Emergency..." : "Emergency"}
                        </button>
                    ) : null}

                    {emergencyError ? (
                        <p className="text-sm text-red-300">{emergencyError}</p>
                    ) : null}

                    {emergencyResult ? <EmergencyResponsePanel result={emergencyResult} /> : null}
                </div>
            );
        }

        if (resultType === "emergency_response") {
            const emergencyPayload = emergencyResult || ((result.result as Record<string, unknown> | undefined) || {});
            return <EmergencyResponsePanel result={emergencyPayload} />;
        }

        if (resultType === "google_gmail") {
            const rows = getGmailRows(result);
            if (rows.length > 0) {
                return <GmailTableCard rows={rows} />;
            }
        }

        if (resultType === "google_drive") {
            const rows = getDriveRows(result);
            if (rows.length > 0) {
                return <DriveTableCard rows={rows} meta={getDriveListMeta(result, rows)} />;
            }
        }

        if (typeof resultType === "string" && resultType.startsWith("strata_")) {
            return <StrataResultCard result={result} />;
        }

        if (resultType === "dia_diagram") {
            return <DiaHelperDiagramCard result={result} />;
        }

        if (resultType === "shopgenie_result") {
            return <ShopGenieResultCard result={result} />;
        }

        if (resultType === "career_plan") {
            return <CareerPlanResultCard result={result} />;
        }

        // Generic result
        const nestedResult =
            typeof result.result === "object" && result.result !== null
                ? (result.result as Record<string, unknown>)
                : undefined;
        const summary =
            (result.message as string | undefined) ||
            (result.summary as string | undefined) ||
            (nestedResult?.summary as string | undefined);

        const details: Array<{ label: string; value: string }> = [];
        if (typeof result.status === "string") {
            details.push({ label: "Status", value: result.status });
        }
        if (typeof result.type === "string") {
            details.push({ label: "Type", value: result.type });
        }
        if (typeof result.action === "string") {
            details.push({ label: "Action", value: result.action });
        }
        if (typeof result.error_code === "string") {
            details.push({ label: "Code", value: result.error_code });
        }

        return <GenericAgentResultCard summary={summary || undefined} details={details} />;
    };

    const EmergencyResponsePanel = ({ result }: { result: Record<string, unknown> }) => {
        const hospitals = Array.isArray(result.hospitals) ? (result.hospitals as Record<string, unknown>[]) : [];
        const location = (result.location as Record<string, unknown> | undefined) || {};
        const share = (result.share as Record<string, unknown> | undefined) || {};
        const mapEmbedUrl = (location.mapEmbedUrl as string) || "";
        const mapUrl = (location.mapUrl as string) || "";
        const whatsappUrl = (share.whatsappUrl as string) || "";
        const copyMessage = (share.copyMessage as string) || "";

        return (
            <div className="mt-3 space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                {mapEmbedUrl ? (
                    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                        <iframe
                            src={mapEmbedUrl}
                            title="Emergency map"
                            className="h-48 w-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Live Tracking
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {String(location.label || "Location captured")}
                    </span>
                    {mapUrl ? (
                        <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open map
                        </a>
                    ) : null}
                </div>

                {hospitals.length > 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/25 p-2">
                        <p className="mb-2 text-xs font-semibold uppercase text-white/60">Nearby Hospitals</p>
                        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                            {hospitals.map((hospital, idx) => (
                                <div key={`${String(hospital.placeId || hospital.name)}-${idx}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm">
                                    <div className="min-w-0">
                                        <p className="truncate text-white/90">{String(hospital.name || "Hospital")}</p>
                                        <p className="truncate text-xs text-white/60">{String(hospital.distanceLabel || hospital.distance || "")}</p>
                                    </div>
                                    <a
                                        href={String(hospital.callUrl || "tel:108")}
                                        className="ml-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                                    >
                                        <Phone className="h-3.5 w-3.5" />
                                        Call
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                    <a href="tel:108" className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/30">
                        <Phone className="h-4 w-4" />
                        Call Ambulance (108)
                    </a>
                    <a href={whatsappUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/15">
                        <Share2 className="h-4 w-4" />
                        Share on WhatsApp
                    </a>
                </div>

                <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2">
                    <label className="block text-xs text-white/60">Share via Gmail (Google Agent)</label>
                    <div className="flex gap-2">
                        <input
                            value={emailTo}
                            onChange={(event) => setEmailTo(event.target.value)}
                            placeholder="Recipient email"
                            className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white outline-none focus:border-white/30"
                        />
                        <button
                            onClick={sendEmergencyEmail}
                            className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
                        >
                            <Mail className="h-3.5 w-3.5" />
                            Send
                        </button>
                    </div>
                    {emailStatus ? <p className="text-xs text-white/70">{emailStatus}</p> : null}
                </div>

                <button
                    onClick={() => navigator.clipboard.writeText(copyMessage || "")}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/15"
                >
                    Copy emergency message
                </button>
            </div>
        );
    };

    // ── Error display ────────────────────────────────────────────────────
    const ErrorDisplay = () => {
        if (status !== "failed" || !result) return null;

        return (
            <div className="mt-2 text-sm text-red-400">
                {(result.error as string) || "Agent task failed."}
            </div>
        );
    };

    return (
        <div className="flex gap-3 px-4 py-4 justify-start">
            {/* Agent avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-400" />
            </div>

            {/* Task card */}
            <div
                className={`relative max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 border ${statusColors[status] || "border-white/10 bg-white/5"
                    }`}
            >
                {/* Header: agent name + status */}
                <div className="flex items-center gap-2 mb-2">
                    <StatusIcon />
                    <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                        {agentName}
                    </span>
                    <span className="text-xs text-white/40">
                        — {statusLabels[status] || status}
                    </span>
                </div>

                {/* Content — the delegating message from the LLM */}
                <div className="text-sm text-[#E5E5E5] leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                </div>

                {/* Action button or error */}
                <ActionButton />
                <ErrorDisplay />
            </div>
        </div>
    );
};
