"use client";

import React, { useMemo } from "react";
import {
    BarChart3,
    ChevronDown,
    ChevronUp,
    LayoutDashboard,
    Sparkles,
    ShieldAlert,
    Table2,
    TrendingUp,
} from "lucide-react";

interface DashboardDesignerResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function MetricPill({
    title,
    value,
    tone = "white",
}: {
    title: string;
    value: string;
    tone?: "white" | "emerald" | "amber" | "rose" | "cyan";
}) {
    const toneClasses: Record<"white" | "emerald" | "amber" | "rose" | "cyan", string> = {
        white: "border-white/10 bg-white/5 text-white/90",
        emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
        amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
        rose: "border-rose-500/25 bg-rose-500/10 text-rose-100",
        cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
    };

    return (
        <div className={`rounded-lg border px-3 py-2 ${toneClasses[tone]}`}>
            <p className="text-[10px] uppercase tracking-wider text-white/45">{title}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
    );
}

function SectionCard({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-black/25">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <span className="text-white/65">{icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/75">{title}</span>
            </div>
            <div className="space-y-2 p-3">{children}</div>
        </div>
    );
}

export const DashboardDesignerResultCard: React.FC<DashboardDesignerResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const schema = asObject(payload.dashboardSchema);
    const requestSummary = asObject(payload.requestSummary);
    const analysis = asObject(payload.analysis);

    const kpis = useMemo(() => {
        const raw = asArray<Record<string, unknown>>(schema.cards).length > 0 ? asArray<Record<string, unknown>>(schema.cards) : asArray<Record<string, unknown>>(schema.kpis);
        return raw;
    }, [schema.cards, schema.kpis]);

    const charts = asArray<Record<string, unknown>>(schema.charts);
    const tables = asArray<Record<string, unknown>>(schema.tables);
    const thresholds = asArray<Record<string, unknown>>(schema.thresholds);
    const highlights = asArray<string>(schema.highlights);
    const keyMetrics = asArray<string>(analysis.key_metrics);
    const keySignals = asArray<string>(analysis.key_signals);
    const recommendations = asArray<string>(payload.recommendedNextActions || result.recommended_next_actions);

    const title = asString(schema.title, asString(payload.title, "Dashboard Designer"));
    const subtitle = asString(payload.subtitle, asString(schema.description, asString(payload.message, "Schema generated from your prompt.")));
    const summary = asString(payload.summary, asString(schema.summary, asString(result.summary, asString(result.message, ""))));
    const audience = asString(schema.audience, asString(requestSummary.audience, "operators"));
    const horizon = asString(schema.time_horizon, asString(requestSummary.time_horizon, "monthly"));
    const theme = asString(schema.theme, "dark");
    const status = asString(payload.status, asString(result.status, "success"));
    const statusTone = status === "success" ? "emerald" : status === "partial_success" ? "amber" : "rose";

    return (
        <div className="mt-3 rounded-2xl border border-white/10 bg-[#08090D] p-3 text-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                            <LayoutDashboard className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                                Dashboard Designer
                            </p>
                            <h3 className="truncate text-base font-semibold text-white/95">{title}</h3>
                        </div>
                    </div>
                    <p className="max-w-3xl text-sm leading-relaxed text-white/72">{subtitle}</p>
                </div>

                <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        statusTone === "emerald"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                            : statusTone === "amber"
                                ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
                                : "border-rose-500/25 bg-rose-500/10 text-rose-200"
                    }`}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    {status.replace(/_/g, " ")}
                </span>
            </div>

            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricPill title="Audience" value={audience} tone="cyan" />
                <MetricPill title="Time Horizon" value={horizon} tone="amber" />
                <MetricPill title="Theme" value={theme} tone="white" />
                <MetricPill title="Charts" value={String(charts.length)} tone="emerald" />
            </div>

            {summary ? (
                <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Summary</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/82 whitespace-pre-wrap">{summary}</p>
                </div>
            ) : null}

            {kpis.length > 0 ? (
                <SectionCard title="Key Metrics" icon={<TrendingUp className="h-4 w-4" />}>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {kpis.slice(0, 4).map((item, index) => {
                            const change = asNumber(item.change);
                            const trend = asString(item.trend, change > 0 ? "up" : change < 0 ? "down" : "flat");
                            const tone = trend === "up" ? "emerald" : trend === "down" ? "rose" : "amber";
                            return (
                                <div
                                    key={`${asString(item.title, "Metric")}-${index}`}
                                    className="rounded-lg border border-white/10 bg-black/30 p-3"
                                >
                                    <p className="text-[10px] uppercase tracking-wide text-white/45">
                                        {asString(item.title, "Metric")}
                                    </p>
                                    <div className="mt-1 flex items-end justify-between gap-2">
                                        <p className="text-lg font-semibold text-white/95">
                                            {asString(item.value, "—")}
                                        </p>
                                        <span
                                            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${
                                                tone === "emerald"
                                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                                                    : tone === "rose"
                                                        ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
                                                        : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                                            }`}
                                        >
                                            {change > 0 ? "+" : ""}
                                            {change.toFixed(2)}%
                                        </span>
                                    </div>
                                    {asString(item.note) ? (
                                        <p className="mt-2 text-xs leading-relaxed text-white/55">
                                            {asString(item.note)}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            ) : null}

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <SectionCard title="Charts" icon={<BarChart3 className="h-4 w-4" />}>
                    {charts.length > 0 ? (
                        <div className="space-y-2">
                            {charts.slice(0, 3).map((chart, index) => (
                                <div
                                    key={`${asString(chart.id, "chart")}-${index}`}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-white/90">
                                            {asString(chart.title, "Chart")}
                                        </p>
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                                            {asString(chart.type, "chart")}
                                        </span>
                                    </div>
                                    {asString(chart.subtitle) ? (
                                        <p className="mt-1 text-xs leading-relaxed text-white/60">
                                            {asString(chart.subtitle)}
                                        </p>
                                    ) : null}
                                    {asString(chart.insight) ? (
                                        <p className="mt-2 text-xs leading-relaxed text-cyan-100/80">
                                            {asString(chart.insight)}
                                        </p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/55">
                            No charts were returned in this result.
                        </div>
                    )}
                </SectionCard>

                <SectionCard title="Tables" icon={<Table2 className="h-4 w-4" />}>
                    {tables.length > 0 ? (
                        <div className="space-y-2">
                            {tables.slice(0, 3).map((table, index) => {
                                const columns = asArray<Record<string, unknown>>(table.columns);
                                return (
                                    <div
                                        key={`${asString(table.id, "table")}-${index}`}
                                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                                    >
                                        <p className="text-sm font-medium text-white/90">
                                            {asString(table.title, "Table")}
                                        </p>
                                        {asString(table.subtitle) ? (
                                            <p className="mt-1 text-xs leading-relaxed text-white/60">
                                                {asString(table.subtitle)}
                                            </p>
                                        ) : null}
                                        <p className="mt-2 text-[11px] uppercase tracking-wide text-white/45">
                                            {columns.length > 0
                                                ? columns
                                                      .slice(0, 4)
                                                      .map((column) => asString(column.label, asString(column.key, "col")))
                                                      .join(" • ")
                                                : "No column metadata"}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/55">
                            No tables were returned in this result.
                        </div>
                    )}
                </SectionCard>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <SectionCard title="Thresholds" icon={<ShieldAlert className="h-4 w-4" />}>
                    {thresholds.length > 0 ? (
                        <div className="space-y-2">
                            {thresholds.slice(0, 4).map((threshold, index) => (
                                <div
                                    key={`${asString(threshold.metric_name, "threshold")}-${index}`}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium text-white/88">
                                            {asString(threshold.metric_name, "Metric")}
                                        </p>
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                                            {asString(threshold.severity, "warning")}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-white/65">
                                        {asString(threshold.operator, "≤")} {String(threshold.threshold_value ?? "-")}
                                    </p>
                                    {asString(threshold.message) ? (
                                        <p className="mt-1 text-white/55">{asString(threshold.message)}</p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/55">
                            No thresholds were returned in this result.
                        </div>
                    )}
                </SectionCard>

                <SectionCard title="Notes" icon={<Sparkles className="h-4 w-4" />}>
                    <div className="space-y-2">
                        {highlights.length > 0 ? (
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                                <p className="text-[11px] uppercase tracking-wide text-white/45">Highlights</p>
                                <ul className="mt-2 space-y-1.5">
                                    {highlights.slice(0, 4).map((item, index) => (
                                        <li key={`${item}-${index}`}>• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {keyMetrics.length > 0 ? (
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                                <p className="text-[11px] uppercase tracking-wide text-white/45">Key Metrics</p>
                                <p className="mt-1 text-white/75">{keyMetrics.slice(0, 5).join(" • ")}</p>
                            </div>
                        ) : null}

                        {keySignals.length > 0 ? (
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                                <p className="text-[11px] uppercase tracking-wide text-white/45">Key Signals</p>
                                <ul className="mt-2 space-y-1.5">
                                    {keySignals.slice(0, 4).map((item, index) => (
                                        <li key={`${item}-${index}`}>• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                </SectionCard>
            </div>

            {recommendations.length > 0 ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                        <ChevronDown className="h-3.5 w-3.5" />
                        Next Actions
                    </div>
                    <div className="space-y-1.5 text-sm text-white/78">
                        {recommendations.slice(0, 4).map((item, index) => (
                            <div key={`${item}-${index}`} className="flex items-start gap-2">
                                <ChevronUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/70" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
