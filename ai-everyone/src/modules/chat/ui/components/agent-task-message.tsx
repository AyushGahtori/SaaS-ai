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
import { Bot, Loader2, CheckCircle, XCircle, Phone, MessageSquare, ExternalLink } from "lucide-react";

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
        success: "border-green-500/20 bg-green-500/5",
        failed: "border-red-500/20 bg-red-500/5",
    };

    const statusLabels: Record<string, string> = {
        queued: "Queued",
        running: "Running...",
        success: "Completed",
        failed: "Failed",
    };

    // ── Action button based on result type ───────────────────────────────
    const ActionButton = () => {
        if (status !== "success" || !result) return null;

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

        // Generic result
        return (
            <div className="mt-2 text-xs text-white/50">
                Result: {JSON.stringify(result)}
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
