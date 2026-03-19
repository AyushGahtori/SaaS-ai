/**
 * AgentTaskMessage — renders an agent task status card within the chat.
 *
 * Shows the agent name, current status (queued → running → success/failed),
 * and action buttons for the task result (e.g. "Open Teams Call").
 *
 * Uses the taskStatuses map from ChatContext for real-time updates.
 */

"use client";

import React from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import type { ChatMessage } from "@/modules/chat/types";
import { Bot, Loader2, CheckCircle, XCircle, Phone, MessageSquare, ExternalLink, Calendar, Key, ListTodo } from "lucide-react";
import { TeamsLoginCard, type DeviceFlowData } from "./teams-login-card";

interface AgentTaskMessageProps {
    message: ChatMessage;
}

/** Human-readable agent names. */
const AGENT_NAMES: Record<string, string> = {
    "teams-agent": "Microsoft Teams Agent",
    "email-agent": "Email Agent",
};

export const AgentTaskMessage: React.FC<AgentTaskMessageProps> = ({ message }) => {
    const { taskStatuses } = useChatContext();

    const taskId = message.taskId;
    const agentId = message.agentId || "unknown";
    const agentName = AGENT_NAMES[agentId] || agentId;

    const taskStatus = taskId ? taskStatuses[taskId] : undefined;
    const status = taskStatus?.status || "queued";
    const result = taskStatus?.result as Record<string, unknown> | undefined;

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
                <TeamsLoginCard 
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

        // Generic result
        return (
            <div className="mt-2 text-xs text-white/50 break-words whitespace-pre-wrap">
                Result: {JSON.stringify(result, null, 2)}
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
