"use client";

import React, { useMemo } from "react";
import { Mail, PlaneTakeoff } from "lucide-react";

interface TravelHalperResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
}

export const TravelHalperResultCard: React.FC<TravelHalperResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const type = asString(result.type, "");
    const summary = asString(result.summary || result.message, "");
    const threadId = asString(payload.threadId, "");
    const planMarkdown = asString(payload.planMarkdown, "");
    const toEmail = asString(payload.toEmail, "");
    const subject = asString(payload.subject, "");
    const sentAt = asString(payload.sentAt, "");

    const isEmailResult = type === "travel_email_result";

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/90">
                    {isEmailResult ? <Mail className="h-4 w-4 text-sky-300" /> : <PlaneTakeoff className="h-4 w-4 text-emerald-300" />}
                    {isEmailResult ? "Travel Plan Email" : "Travel Plan"}
                </div>
                {threadId ? (
                    <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/60">
                        Thread: {threadId}
                    </span>
                ) : null}
            </div>

            {summary ? (
                <p className="mb-2 text-xs text-white/75">{summary}</p>
            ) : null}

            {!isEmailResult && planMarkdown ? (
                <pre className="max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/85 whitespace-pre-wrap">
                    {planMarkdown}
                </pre>
            ) : null}

            {isEmailResult ? (
                <div className="grid gap-2 text-xs text-white/85">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-white/60">Recipient:</span> {toEmail}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-white/60">Subject:</span> {subject}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-white/60">Sent At:</span> {sentAt}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

