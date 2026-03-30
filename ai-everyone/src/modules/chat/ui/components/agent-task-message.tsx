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
import { Bot, Loader2, CheckCircle, XCircle, Phone, MessageSquare, ExternalLink, Calendar, Key, ListTodo, Folder, FileText, FileImage } from "lucide-react";
import { MicrosoftLoginCard, type DeviceFlowData } from "./microsoft-login-card";
import { GoogleLoginCard } from "./google-login-card";
import { subscribeToTask, type AgentTask } from "@/lib/firestore-tasks";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";

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

function DriveTableCard({ rows }: { rows: DriveRow[] }) {
    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 overflow-hidden">
            <div className="grid grid-cols-[2fr_1.1fr_1fr_1fr] gap-3 px-3 py-2.5 text-[11px] uppercase tracking-wide text-white/50 border-b border-white/10">
                <span>Name</span>
                <span>Type</span>
                <span>Modified Date</span>
                <span>Modified Time</span>
            </div>
            <div className="custom-scrollbar max-h-48 overflow-y-auto">
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
        </div>
    );
}

export const AgentTaskMessage: React.FC<AgentTaskMessageProps> = ({ message }) => {
    const { taskStatuses } = useChatContext();
    const [localTask, setLocalTask] = useState<AgentTask | null>(null);

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
    const status = localTask?.status || globalTaskStatus?.status || "queued";
    const result = (localTask?.agentOutput || globalTaskStatus?.result) as Record<string, unknown> | undefined;

    // ── Handle action buttons based on agent result ──────────────────────
    const handleAction = () => {
        if (!result) return;

        const resultType = result.type as string;
        const url = result.url as string;

        if (url && (resultType === "teams_call" || resultType === "teams_message")) {
            window.open(url, "_blank");
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
            case "success":
                return <CheckCircle className="w-4 h-4 text-green-400" />;
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
        success: "border-green-500/20 bg-green-500/5",
        failed: "border-red-500/20 bg-red-500/5",
    };

    const statusLabels: Record<string, string> = {
        queued: "Queued",
        running: "Running...",
        action_required: "Auth Required",
        success: "Completed",
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

        if (resultType === "google_gmail") {
            const rows = getGmailRows(result);
            if (rows.length > 0) {
                return <GmailTableCard rows={rows} />;
            }
        }

        if (resultType === "google_drive") {
            const rows = getDriveRows(result);
            if (rows.length > 0) {
                return <DriveTableCard rows={rows} />;
            }
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

        return (
            <div className="mt-3 space-y-3">
                {summary ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 whitespace-pre-wrap break-words">
                        {summary}
                    </div>
                ) : null}
                <div className="text-xs text-white/50 break-words whitespace-pre-wrap">
                    Result: {JSON.stringify(result, null, 2)}
                </div>
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
