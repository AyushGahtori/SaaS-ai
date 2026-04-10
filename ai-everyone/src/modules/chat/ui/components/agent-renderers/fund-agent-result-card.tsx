"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Link2, Sparkles, TrendingUp, Users } from "lucide-react";

type Payload = Record<string, unknown> & {
    status?: string;
    type?: string;
    message?: string;
    displayName?: string;
    result?: Record<string, unknown>;
};

interface FundAgentResultCardProps {
    result: Payload;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
}

function badgeClass(status?: string) {
    switch ((status || "").toLowerCase()) {
        case "success":
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
        case "needs_linkedin_connection":
            return "border-amber-500/30 bg-amber-500/10 text-amber-200";
        case "failed":
            return "border-rose-500/30 bg-rose-500/10 text-rose-200";
        default:
            return "border-white/15 bg-white/5 text-white/70";
    }
}

export const FundAgentResultCard: React.FC<FundAgentResultCardProps> = ({ result }) => {
    const payload = React.useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const status = asString(result.status, "success");
    const type = asString(result.type, "fundraising_plan");
    const message = asString(result.message, "Fundraising response ready.");
    const displayName = asString(result.displayName, "Fund Agent");
    const dependency = asObject(payload.linkedin_dependency);
    const investors = asArray<Record<string, unknown>>(payload.investors);
    const shortlist = asArray<Record<string, unknown>>(payload.shortlist);
    const sequence = asArray<Record<string, unknown>>(payload.sequence);
    const terms = asArray<string>(payload.commercial_terms);
    const watchouts = asArray<string>(payload.founder_watchouts);
    const nextActions = asArray<string>(payload.recommended_next_actions);
    const aiSummary = asString(payload.ai_summary, "");
    const isDependency = status === "needs_linkedin_connection" || asString(dependency.state).toLowerCase() === "needs_connection";

    return (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/10 bg-slate-950/90 text-slate-100 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.75)]">
            <div className="border-b border-white/5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{displayName}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">{message}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${badgeClass(status)}`}>
                        {status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                        {status.replace(/_/g, " ")}
                    </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-white/5 bg-white/5 px-2 py-1">{type}</span>
                    {asString(result.action, "") ? (
                        <span className="rounded-full border border-white/5 bg-white/5 px-2 py-1">{asString(result.action)}</span>
                    ) : null}
                </div>
            </div>

            <div className="space-y-4 p-4">
                {aiSummary ? (
                    <div className="rounded-xl border border-white/6 bg-white/4 p-3 text-sm text-slate-200">
                        <div className="mb-1 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-slate-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI Summary
                        </div>
                        <p className="leading-relaxed">{aiSummary}</p>
                    </div>
                ) : null}

                {isDependency ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
                                <Link2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-amber-100">LinkedIn connection required</p>
                                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                                    {asString(dependency.message, "Connect the LinkedIn agent to continue outreach workflows.")}
                                </p>
                                <p className="mt-2 text-xs text-slate-400">Next step: {asString(dependency.next_step, "Connect the linkedIn agent and retry.")}</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {investors.length > 0 ? (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Investor Matches</h3>
                            <span className="text-xs text-slate-500">{investors.length} shown</span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {investors.slice(0, 4).map((investor, index) => (
                                <div key={`${String(investor.name || "investor")}-${index}`} className="rounded-xl border border-white/6 bg-white/4 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-100">{asString(investor.name)}</p>
                                            <p className="text-xs text-slate-400">{asString(investor.firm)}</p>
                                        </div>
                                        <span className="rounded-full border border-slate-600/40 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-200">
                                            {asString(investor.match_score, "0")}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{asString(investor.fit_reason)}</p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                                        <span className="rounded-full border border-white/5 bg-white/5 px-2 py-1">Stage: {asString(investor.stage)}</span>
                                        <span className="rounded-full border border-white/5 bg-white/5 px-2 py-1">Check: {asString(investor.check_size, "N/A")}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                {shortlist.length > 0 ? (
                    <section className="rounded-xl border border-white/6 bg-white/4 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <Users className="h-3.5 w-3.5" />
                            Shortlist
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {shortlist.slice(0, 4).map((item, index) => (
                                <div key={`${String(item.name || "shortlist")}-${index}`} className="rounded-lg border border-white/5 bg-slate-900/60 p-2.5 text-xs">
                                    <p className="font-medium text-slate-100">{asString(item.name)}</p>
                                    <p className="mt-1 text-slate-400">{asString(item.fit_reason)}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                {sequence.length > 0 ? (
                    <section className="rounded-xl border border-white/6 bg-white/4 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Outreach Sequence
                        </div>
                        <div className="space-y-2">
                            {sequence.map((step, index) => (
                                <div key={`${String(step.step || index)}-${index}`} className="flex gap-3 rounded-lg border border-white/5 bg-slate-900/60 p-3">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
                                        {asString(step.step, String(index + 1))}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-slate-100">{asString(step.goal)}</p>
                                            <span className="text-[11px] text-slate-500">Day {asString(step.day, "0")}</span>
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-300">{asString(step.copy_hint)}</p>
                                        <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Channel: {asString(step.channel)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                {terms.length > 0 || watchouts.length > 0 ? (
                    <section className="grid gap-3 md:grid-cols-2">
                        {terms.length > 0 ? (
                            <div className="rounded-xl border border-white/6 bg-white/4 p-3">
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Term Sheet Notes</h3>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    {terms.slice(0, 4).map((item, index) => (
                                        <li key={`${item}-${index}`} className="leading-relaxed">{item}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {watchouts.length > 0 ? (
                            <div className="rounded-xl border border-white/6 bg-white/4 p-3">
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Founder Watchouts</h3>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    {watchouts.slice(0, 4).map((item, index) => (
                                        <li key={`${item}-${index}`} className="leading-relaxed">{item}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </section>
                ) : null}

                {nextActions.length > 0 ? (
                    <section className="rounded-xl border border-white/6 bg-white/4 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Recommended Next Steps
                        </div>
                        <ul className="space-y-1.5 text-sm text-slate-300">
                            {nextActions.map((item, index) => (
                                <li key={`${item}-${index}`} className="leading-relaxed">{item}</li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </div>
        </div>
    );
};
