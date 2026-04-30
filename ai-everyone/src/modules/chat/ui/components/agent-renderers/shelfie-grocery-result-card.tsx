"use client";

import React from "react";
import { ClipboardList, History, RefreshCcw, Sparkles } from "lucide-react";

type UnknownRecord = Record<string, unknown>;

interface ShelfieGroceryResultCardProps {
    result: UnknownRecord;
}

function asRecord(value: unknown): UnknownRecord {
    return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
}

function asArray(value: unknown): UnknownRecord[] {
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as UnknownRecord[] : [];
}

export function ShelfieGroceryResultCard({ result }: ShelfieGroceryResultCardProps) {
    const resultType = asString(result.type, "shelfie_grocery_result");
    const payload = asRecord(result.result);
    const summary = asString(result.summary, "") || asString(result.message, "");
    const sessionId = asString(payload.session_id, "");
    const responseText = asString(payload.responseText, "");
    const history = asArray(payload.history);
    const sessions = asArray(payload.sessions);
    const actions = Array.isArray(payload.actions) ? payload.actions.map((item) => asString(item, "")).filter(Boolean) : [];
    const failureText = `${summary} ${responseText}`.toLowerCase();
    const isFailure =
        failureText.includes("cannot fulfill") ||
        failureText.includes("unable to") ||
        failureText.includes("failed") ||
        failureText.includes("error");

    const badge =
        isFailure
            ? "Failed"
            :
        resultType === "shelfie_capabilities_result"
            ? "Capabilities"
            : resultType === "shelfie_history_result"
                ? "History"
                : resultType === "shelfie_sessions_result"
                    ? "Sessions"
                    : resultType === "shelfie_reset_result"
                        ? "Reset"
                        : "Conversation";

    const icon =
        isFailure
            ? <RefreshCcw className="h-3.5 w-3.5" />
            :
        badge === "Capabilities"
            ? <Sparkles className="h-3.5 w-3.5" />
            : badge === "History"
                ? <History className="h-3.5 w-3.5" />
                : badge === "Reset"
                    ? <RefreshCcw className="h-3.5 w-3.5" />
                    : <ClipboardList className="h-3.5 w-3.5" />;

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#102218] to-[#0b1410] p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-white">Shelfie Grocery Agent</p>
                    <p className="text-[11px] uppercase tracking-wide text-white/55">{resultType.replaceAll("_", " ")}</p>
                </div>
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                        isFailure
                            ? "border-red-500/35 bg-red-500/14 text-red-200"
                            : "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                    }`}
                >
                    {icon}
                    {badge}
                </span>
            </div>

            {summary ? (
                <p className="mb-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/82">
                    {summary}
                </p>
            ) : null}

            {responseText ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-6 text-white/84">
                    {responseText}
                </div>
            ) : null}

            {(history.length > 0 || sessions.length > 0 || actions.length > 0) ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {history.length > 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-white/55">Session History</p>
                            <p className="mt-1 text-xs text-white/70">{history.length} message(s)</p>
                        </div>
                    ) : null}
                    {sessions.length > 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-white/55">Recent Sessions</p>
                            <p className="mt-1 text-xs text-white/70">{sessions.length} session(s)</p>
                        </div>
                    ) : null}
                    {actions.length > 0 ? (
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 md:col-span-2">
                            <p className="text-[11px] uppercase tracking-wide text-white/55">Supported Actions</p>
                            <p className="mt-1 text-xs text-white/70">{actions.join(", ")}</p>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/58">
                {sessionId ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Session: {sessionId}
                    </span>
                ) : null}
                {asString(payload.provider, "") ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Provider: {asString(payload.provider)}
                    </span>
                ) : null}
                {asString(payload.model, "") ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Model: {asString(payload.model)}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
