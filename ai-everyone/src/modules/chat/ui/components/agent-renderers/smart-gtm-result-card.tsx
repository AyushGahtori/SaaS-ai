"use client";

import React, { useMemo } from "react";
import { BadgeInfo, Clock3, Globe2, Layers3, ShieldCheck, Sparkles } from "lucide-react";

interface SmartGTMResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function SectionBlock({ title, summary, bullets }: { title: string; summary: string; bullets: string[] }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/80">{summary}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Focus
                </span>
            </div>
            {bullets.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-white/74">
                    {bullets.map((bullet, index) => (
                        <li key={`${title}-${index}`} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-emerald-400/80" />
                            <span className="leading-6">{bullet}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

export const SmartGTMResultCard: React.FC<SmartGTMResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const companyName = asString(payload.companyName, "Smart GTM");
    const companyUrl = typeof payload.companyUrl === "string" ? payload.companyUrl.trim() : "";
    const mode = asString(payload.mode, "research");
    const modeLabel = asString(payload.modeLabel, mode);
    const cached = payload.cached === true;
    const cachedAt = asString(payload.cachedAt, "");
    const generatedAt = asString(payload.generatedAt, "");
    const keyTakeaways = asArray(payload.keyTakeaways).map((item) => asString(item)).filter(Boolean);
    const summary = asString(result.summary || keyTakeaways[0], "Report ready.");
    const reportMarkdown = asString(payload.reportMarkdown, "");

    const sections = asArray(payload.sections)
        .map((section) => asObject(section))
        .map((section) => ({
            title: asString(section.title, "Section"),
            summary: asString(section.summary, ""),
            bullets: asArray(section.bullets).map((item) => asString(item)).filter(Boolean),
        }));

    const risks = asArray(payload.risks).map((item) => asString(item)).filter(Boolean);
    const sources = asArray(payload.sources).map((item) => asObject(item));
    const companySignals = asArray(payload.companySignals).map((item) => asString(item)).filter(Boolean);
    const competitorSignals = asArray(payload.competitorSignals).map((item) => asString(item)).filter(Boolean);
    const sourceStatus = asObject(payload.sourceStatus);
    const sourceSummary = Object.entries(sourceStatus)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" · ");

    const modeTone =
        mode === "gtm"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
                : mode === "channel"
                ? "border-sky-500/20 bg-sky-500/10 text-sky-100"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";

    return (
        <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F12] text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-300">
                                <Sparkles className="h-4 w-4" />
                            </span>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Smart GTM Agent</p>
                                <h3 className="text-lg font-semibold tracking-[-0.02em] text-white/95">{companyName}</h3>
                            </div>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{summary}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${modeTone}`}>
                            <Layers3 className="h-3.5 w-3.5" />
                            {modeLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/65">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                            {cached ? "Cached" : "Fresh"}
                        </span>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/58">
                    {companyUrl ? (
                        <a
                            href={companyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                        >
                            <Globe2 className="h-3.5 w-3.5" />
                            {companyUrl}
                        </a>
                    ) : null}
                    {generatedAt ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {generatedAt}
                        </span>
                    ) : null}
                    {cachedAt ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            Cached at {cachedAt}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:px-5">
                <div className="grid gap-3 md:grid-cols-[1.3fr_0.9fr]">
                    <div className="space-y-3">
                        {sections.length > 0 ? (
                            sections.map((section) => (
                                <SectionBlock
                                    key={section.title}
                                    title={section.title}
                                    summary={section.summary}
                                    bullets={section.bullets}
                                />
                            ))
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                                No structured sections were returned.
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Source Status</p>
                            <p className="mt-2 text-sm leading-6 text-white/75">
                                {sourceSummary || "No source status available."}
                            </p>
                        </div>

                        {companySignals.length > 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Company Signals</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {companySignals.slice(0, 5).map((item, index) => (
                                        <span
                                            key={`${item}-${index}`}
                                            className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100/90"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {competitorSignals.length > 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Competitor Signals</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {competitorSignals.slice(0, 5).map((item, index) => (
                                        <span
                                            key={`${item}-${index}`}
                                            className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-white/72"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {keyTakeaways.length > 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex items-center gap-2">
                                    <BadgeInfo className="h-4 w-4 text-sky-300" />
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Key Takeaways</p>
                                </div>
                                <ul className="mt-3 space-y-2 text-sm text-white/75">
                                    {keyTakeaways.slice(0, 4).map((item, index) => (
                                        <li key={`${item}-${index}`} className="flex gap-2">
                                            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-sky-300/80" />
                                            <span className="leading-6">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {risks.length > 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Risks & Gaps</p>
                                <ul className="mt-3 space-y-2 text-sm text-white/68">
                                    {risks.slice(0, 4).map((item, index) => (
                                        <li key={`${item}-${index}`} className="flex gap-2">
                                            <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-300/80" />
                                            <span className="leading-6">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                </div>

                {reportMarkdown ? (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Report Markdown</p>
                        <div className="custom-scrollbar mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/35 p-4 text-sm leading-7 text-white/78">
                            {reportMarkdown}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
