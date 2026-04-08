"use client";

import React, { useMemo } from "react";
import { CheckCircle2, Mail, Trophy, Youtube } from "lucide-react";

interface ShopGenieResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
}

export const ShopGenieResultCard: React.FC<ShopGenieResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const query = asString(payload.query, "-");
    const bestProduct = asString(payload.bestProduct, "-");
    const why = asString(payload.why, "-");
    const reasoning = asString(payload.reasoning, "-");
    const youtubeReview = typeof payload.youtubeReview === "string" && payload.youtubeReview.trim()
        ? payload.youtubeReview.trim()
        : null;
    const emailSent = payload.emailSent === true;
    const emailStatus = asString(payload.emailStatus, emailSent ? "Email sent." : "Email not sent.");

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-white/55">ShopGenie Results</p>
                    <p className="text-sm font-semibold text-white/90 truncate">{query}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10">
                <div className="grid grid-cols-[160px_1fr] border-b border-white/10 bg-white/5 px-3 py-2 text-xs">
                    <span className="text-white/60">Best Product</span>
                    <span className="inline-flex items-center gap-1.5 text-amber-200">
                        <Trophy className="h-3.5 w-3.5" /> {bestProduct}
                    </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] border-b border-white/10 px-3 py-2 text-xs">
                    <span className="text-white/60">Why</span>
                    <span className="text-white/85">{why}</span>
                </div>
                <div className="grid grid-cols-[160px_1fr] border-b border-white/10 px-3 py-2 text-xs">
                    <span className="text-white/60">Reasoning</span>
                    <span className="text-white/85 whitespace-pre-wrap">{reasoning}</span>
                </div>
                <div className="grid grid-cols-[160px_1fr] border-b border-white/10 px-3 py-2 text-xs">
                    <span className="text-white/60">YouTube Review</span>
                    {youtubeReview ? (
                        <a
                            href={youtubeReview}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200"
                        >
                            <Youtube className="h-3.5 w-3.5" /> {youtubeReview}
                        </a>
                    ) : (
                        <span className="text-white/60">Not available</span>
                    )}
                </div>
                <div className="grid grid-cols-[160px_1fr] px-3 py-2 text-xs">
                    <span className="text-white/60">Email Sent</span>
                    <span className={emailSent ? "inline-flex items-center gap-1.5 text-emerald-300" : "inline-flex items-center gap-1.5 text-amber-300"}>
                        <Mail className="h-3.5 w-3.5" /> {emailSent ? "Yes" : "No"} - {emailStatus}
                    </span>
                </div>
            </div>
        </div>
    );
};
