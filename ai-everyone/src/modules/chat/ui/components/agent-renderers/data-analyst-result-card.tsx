"use client";

import React from "react";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Database, Target } from "lucide-react";

type UnknownRecord = Record<string, unknown>;

interface DataAnalystResultCardProps {
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

function asArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => asString(item, "")).filter(Boolean);
}

function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
            <p className="mt-1 text-xs font-medium text-white/90">{value}</p>
        </div>
    );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/55">{title}</p>
            <ul className="mt-2 space-y-1 text-xs text-white/82">
                {items.map((item, idx) => (
                    <li key={`${title}-${idx}`} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function DataAnalystResultCard({ result }: DataAnalystResultCardProps) {
    const type = asString(result.type, "data_analyst_result");
    const status = asString(result.status, "");
    const payload = asRecord(result.result);
    const anomaly = asRecord(payload.anomaly);
    const insight = asRecord(payload.insight);
    const stats = asRecord(payload.dataProfile);
    const cache = asRecord(payload.cache);

    const isCapabilities = type === "data_analyst_capabilities";
    const needsInput = status === "needs_input";
    const anomalyStatus = asString(anomaly.status, "");
    const anomalyDetected = anomalyStatus === "anomaly";
    const flaggedIndices = asArray(anomaly.indices);
    const flaggedValues = asArray(anomaly.flaggedValues);
    const recommendations = asArray(payload.recommendedActions);
    const nextInputs = asArray(payload.nextInputs);
    const capabilityActions = asArray(payload.actions);

    const summary =
        asString(result.summary, "") ||
        asString(asRecord(payload.insight).summary, "") ||
        asString(result.message, "");

    const badgeClass = isCapabilities
        ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-200"
        : needsInput
          ? "border-amber-500/30 bg-amber-500/15 text-amber-200"
          : anomalyDetected
            ? "border-red-500/30 bg-red-500/15 text-red-200"
            : "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";

    const badgeLabel = isCapabilities
        ? "Capabilities"
        : needsInput
          ? "Needs Input"
          : anomalyDetected
            ? "Anomaly Detected"
            : "No Anomaly";

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#0f1720] to-[#0a1118] p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-white">Data Analyst Agent</p>
                    <p className="text-[11px] uppercase tracking-wide text-white/55">{type.replaceAll("_", " ")}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${badgeClass}`}>
                    {isCapabilities ? (
                        <Activity className="h-3.5 w-3.5" />
                    ) : anomalyDetected ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {badgeLabel}
                </span>
            </div>

            {summary ? (
                <p className="mb-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/82">
                    {summary}
                </p>
            ) : null}

            {!isCapabilities && (Object.keys(stats).length > 0 || asString(payload.dataPointCount, "") !== "") ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {asString(payload.dataPointCount, "") ? (
                        <StatChip label="Points" value={asString(payload.dataPointCount, "-")} />
                    ) : null}
                    {asString(stats.mean, "") ? <StatChip label="Mean" value={asString(stats.mean)} /> : null}
                    {asString(stats.median, "") ? <StatChip label="Median" value={asString(stats.median)} /> : null}
                    {asString(stats.std, "") ? <StatChip label="Std Dev" value={asString(stats.std)} /> : null}
                    {asString(stats.min, "") ? <StatChip label="Min" value={asString(stats.min)} /> : null}
                    {asString(stats.max, "") ? <StatChip label="Max" value={asString(stats.max)} /> : null}
                </div>
            ) : null}

            <div className="grid gap-2 md:grid-cols-2">
                <ListBlock
                    title={isCapabilities ? "Supported Actions" : "Anomaly Signals"}
                    items={
                        isCapabilities
                            ? capabilityActions
                            : [
                                  flaggedIndices.length > 0 ? `Flagged indices: ${flaggedIndices.join(", ")}` : "",
                                  flaggedValues.length > 0 ? `Flagged values: ${flaggedValues.join(", ")}` : "",
                                  asString(anomaly.confidence, "") ? `Confidence: ${asString(anomaly.confidence)}` : "",
                                  asString(anomaly.message, "") || "",
                              ].filter(Boolean)
                    }
                />
                <ListBlock
                    title={
                        isCapabilities
                            ? "Suggested Inputs"
                            : type === "data_autonomous_result"
                              ? "Recommended Next Inputs"
                              : "Recommended Actions"
                    }
                    items={isCapabilities ? asArray(asRecord(payload.requiredFields).monitor) : type === "data_autonomous_result" ? nextInputs : recommendations}
                />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/58">
                {asString(payload.label, "") ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Label: {asString(payload.label)}
                    </span>
                ) : null}
                {asString(payload.goal, "") ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        <Target className="h-3.5 w-3.5" />
                        Goal: {asString(payload.goal)}
                    </span>
                ) : null}
                {asString(insight.provider, "") ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        <Activity className="h-3.5 w-3.5" />
                        Insight: {asString(insight.provider)}
                    </span>
                ) : null}
                {Object.keys(cache).length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        <Database className="h-3.5 w-3.5" />
                        Cache: {cache.hit === true ? `hit (${asString(cache.source, "memory")})` : "miss"}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
