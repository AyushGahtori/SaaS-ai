"use client";

import React from "react";

interface UiCard {
    title?: unknown;
    body?: unknown;
    fields?: Record<string, unknown>;
    tone?: unknown;
}

interface GenericAgentResultCardProps {
    summary?: string | null;
    details?: Array<{ label: string; value: string }>;
    uiCards?: UiCard[];
    logs?: string[];
    recommendedNextActions?: string[];
}

function isLargePayloadKey(key: string): boolean {
    return /(base64|data_url|file_data|audio|image|payload)/i.test(key);
}

function formatValue(value: unknown, key = ""): string {
    if (value === null || typeof value === "undefined") return "-";
    if (isLargePayloadKey(key) && typeof value === "string" && value.length > 80) {
        return "Attached payload";
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return "-";
        return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) {
        const rendered = value.map((item) => formatValue(item)).filter(Boolean).join(", ");
        return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered || "-";
    }
    if (typeof value === "object") {
        const rendered = Object.entries(value as Record<string, unknown>)
            .slice(0, 8)
            .map(([entryKey, entryValue]) => `${entryKey.replace(/_/g, " ")}: ${formatValue(entryValue, entryKey)}`)
            .join(" · ");
        return rendered || "-";
    }
    return String(value);
}

function cardToneClass(tone: unknown): string {
    if (tone === "warning") return "border-amber-400/20 bg-amber-400/8";
    if (tone === "danger") return "border-red-400/20 bg-red-400/8";
    if (tone === "success") return "border-emerald-400/20 bg-emerald-400/8";
    return "border-white/10 bg-black/25";
}

export const GenericAgentResultCard: React.FC<GenericAgentResultCardProps> = ({
    summary,
    details = [],
    uiCards = [],
    logs = [],
    recommendedNextActions = [],
}) => {
    return (
        <div className="mt-3 space-y-3">
            {summary ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 whitespace-pre-wrap break-words">
                    {summary}
                </div>
            ) : null}
            {uiCards.length > 0 ? (
                <div className="grid gap-2">
                    {uiCards.slice(0, 6).map((item, index) => {
                        const title = formatValue(item.title || "Result");
                        const body = formatValue(item.body || "");
                        const fields = item.fields && typeof item.fields === "object" ? item.fields : {};
                        const fieldEntries = Object.entries(fields).slice(0, 8);

                        return (
                            <div
                                key={`${title}-${index}`}
                                className={`rounded-lg border px-3 py-2 ${cardToneClass(item.tone)}`}
                            >
                                <p className="text-sm font-semibold text-white/90">{title}</p>
                                {body && body !== "-" ? (
                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">
                                        {body}
                                    </p>
                                ) : null}
                                {fieldEntries.length > 0 ? (
                                    <div className="mt-2 grid gap-1.5 text-xs text-white/65">
                                        {fieldEntries.map(([key, value]) => (
                                            <div
                                                key={`${title}-${key}`}
                                                className="flex items-start justify-between gap-3"
                                            >
                                                <span className="text-white/45">{key.replace(/_/g, " ")}</span>
                                                <span className="max-w-[68%] text-right text-white/78 break-words">
                                                    {formatValue(value, key)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
            {details.length > 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">
                    <div className="space-y-1.5">
                        {details.map((item) => (
                            <div
                                key={`${item.label}-${item.value}`}
                                className="flex items-start justify-between gap-3"
                            >
                                <span className="text-white/50">{item.label}</span>
                                <span className="text-right text-white/80 break-words">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {recommendedNextActions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {recommendedNextActions.slice(0, 5).map((item) => (
                        <span
                            key={item}
                            className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-white/72"
                        >
                            {item}
                        </span>
                    ))}
                </div>
            ) : null}
            {logs.length > 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Logs</p>
                    <div className="mt-1.5 space-y-1 text-xs text-white/62">
                        {logs.slice(0, 4).map((item) => (
                            <p key={item}>{item}</p>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
