"use client";

import React from "react";
import { Activity, AlertTriangle, Bug, Clock3, Database, Gauge, ShieldAlert, ShieldCheck, TableProperties } from "lucide-react";

type UnknownRecord = Record<string, unknown>;

interface CyberSocResultCardProps {
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

function asNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function asRecordArray(value: unknown): UnknownRecord[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object") as UnknownRecord[];
}

function riskClass(risk: string): string {
    const lowered = risk.toLowerCase();
    if (lowered === "critical") return "border-red-500/40 bg-red-500/15 text-red-200";
    if (lowered === "high") return "border-orange-500/40 bg-orange-500/15 text-orange-200";
    if (lowered === "medium") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
    if (lowered === "low") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    return "border-slate-400/30 bg-slate-400/10 text-slate-200";
}

function Chip({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
            <p className="mt-1 text-xs font-medium text-white/90">{value}</p>
        </div>
    );
}

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-white/10 bg-black/25">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/60">
                {icon}
                <span>{title}</span>
            </div>
            <div className="p-3">{children}</div>
        </div>
    );
}

export function CyberSocResultCard({ result }: CyberSocResultCardProps) {
    const resultType = asString(result.type, "cyber_soc_result");
    const status = asString(result.status, "");
    const payload = asRecord(result.result);
    const summary = asString(result.summary, "") || asString(result.message, "");

    const isAnalysis = resultType === "cyber_soc_analysis_result" || resultType === "cyber_soc_windows_analysis_result";
    const isWindows = resultType === "cyber_soc_windows_logs";
    const isHistory = resultType === "cyber_soc_history_result";
    const isDashboard = resultType === "cyber_soc_dashboard_result";
    const isChannels = resultType === "cyber_soc_channels_result";
    const isCapabilities = resultType === "cyber_soc_capabilities";

    const analysis = asRecord(payload.analysis);
    const risk = asString(analysis.risk, asString(payload.risk, "Unknown"));
    const threat = asString(analysis.threat, asString(payload.threat, "Unknown Threat"));
    const confidence = asNumber(analysis.confidence, asNumber(payload.confidence, 0));
    const actionsText = asString(analysis.action, "");
    const reason = asString(analysis.reason, "");
    const attackType = asString(analysis.attack_type, asString(payload.attackType, ""));
    const vtRows = asRecordArray(analysis.vt_results).slice(0, 6);
    const mitreRows = asRecordArray(analysis.mitre_mapping).slice(0, 6);
    const iocs = asRecord(analysis.indicators_found);

    const historyRows = asRecordArray(payload.history).slice(0, 6);
    const windowsRows = asRecordArray(payload.logs).slice(0, 8);
    const stats = asRecord(payload.stats);
    const recentActivity = asRecordArray(payload.recentActivity).slice(0, 5);
    const latest = asRecord(payload.latestAnalysis);

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#111723] to-[#0a0f17] p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-white">Cyber AI SOC Agent</p>
                    <p className="text-[11px] uppercase tracking-wide text-white/55">{resultType.replaceAll("_", " ")}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${status === "needs_input" ? "border-amber-500/40 bg-amber-500/15 text-amber-200" : status === "failed" ? "border-red-500/40 bg-red-500/15 text-red-200" : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"}`}>
                    {status === "failed" ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {asString(status, "success")}
                </span>
            </div>

            {summary ? (
                <p className="mb-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/82">
                    {summary}
                </p>
            ) : null}

            {isAnalysis ? (
                <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <Chip label="Threat" value={threat} />
                        <div className={`rounded-lg border px-2.5 py-2 ${riskClass(risk)}`}>
                            <p className="text-[10px] uppercase tracking-wide text-white/80">Risk</p>
                            <p className="mt-1 text-xs font-semibold">{risk}</p>
                        </div>
                        <Chip label="Confidence" value={`${confidence}%`} />
                        <Chip label="Attack Type" value={attackType || "-"} />
                        <Chip label="Processing" value={`${asNumber(analysis.processing_time_s, 0)}s`} />
                    </div>

                    {reason ? (
                        <Section title="Detection Context" icon={<Activity className="h-3.5 w-3.5" />}>
                            <p className="text-xs text-white/82">{reason}</p>
                        </Section>
                    ) : null}

                    {actionsText ? (
                        <Section title="Recommendations" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
                            <p className="whitespace-pre-wrap text-xs text-white/84">{actionsText}</p>
                        </Section>
                    ) : null}

                    {(Object.keys(iocs).length > 0 || vtRows.length > 0) ? (
                        <div className="grid gap-3 md:grid-cols-2">
                            <Section title="IOCs" icon={<Bug className="h-3.5 w-3.5" />}>
                                <div className="space-y-2 text-xs text-white/82">
                                    {Object.entries(iocs).map(([key, value]) => {
                                        const items = Array.isArray(value) ? value.map((item) => asString(item, "")).filter(Boolean) : [];
                                        if (!items.length) return null;
                                        return (
                                            <p key={key}>
                                                <span className="uppercase text-white/55">{key}:</span> {items.slice(0, 6).join(", ")}
                                            </p>
                                        );
                                    })}
                                </div>
                            </Section>
                            <Section title="VirusTotal (Top)" icon={<Database className="h-3.5 w-3.5" />}>
                                <div className="space-y-1 text-xs text-white/82">
                                    {vtRows.length ? vtRows.map((row, idx) => (
                                        <p key={idx}>
                                            {asString(row.type, "ioc")} | {asString(row.value, "-")} | malicious: {asNumber(row.malicious, 0)} | score: {asNumber(row.threat_score, 0)}
                                        </p>
                                    )) : <p className="text-white/60">No VT rows.</p>}
                                </div>
                            </Section>
                        </div>
                    ) : null}

                    {mitreRows.length ? (
                        <Section title="MITRE ATT&CK" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                            <div className="space-y-1 text-xs text-white/82">
                                {mitreRows.map((row, idx) => (
                                    <p key={idx}>
                                        {asString(row.threat, "Threat")} | {asString(row.tactic, "Tactic")} | {asString(row.technique, "Technique")}
                                    </p>
                                ))}
                            </div>
                        </Section>
                    ) : null}
                </div>
            ) : null}

            {isWindows ? (
                <Section title="Windows Event Logs" icon={<TableProperties className="h-3.5 w-3.5" />}>
                    <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-white/70">
                        <span>source: {asString(payload.source, "unknown")}</span>
                        <span>count: {asNumber(payload.count, 0)}</span>
                        <span>channels: {Array.isArray(payload.channels) ? payload.channels.join(", ") : "-"}</span>
                    </div>
                    <div className="space-y-1 text-xs text-white/82">
                        {windowsRows.length ? windowsRows.map((row, idx) => (
                            <p key={idx}>
                                {asString(row.timestamp)} | {asString(row.channel)} | {asString(row.severity)} | {asString(row.message)}
                            </p>
                        )) : <p className="text-white/60">No logs returned.</p>}
                    </div>
                </Section>
            ) : null}

            {isHistory ? (
                <Section title="Analysis History" icon={<Clock3 className="h-3.5 w-3.5" />}>
                    <p className="mb-2 text-xs text-white/70">Total: {asNumber(payload.count, historyRows.length)}</p>
                    <div className="space-y-1 text-xs text-white/82">
                        {historyRows.length ? historyRows.map((row, idx) => (
                            <p key={idx}>
                                {asString(row.timestamp)} | {asString(row.threat)} | {asString(row.risk)} | {asNumber(row.confidence, 0)}%
                            </p>
                        )) : <p className="text-white/60">No history yet.</p>}
                    </div>
                </Section>
            ) : null}

            {isDashboard ? (
                <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Chip label="Total Analyses" value={String(asNumber(stats.totalAnalyses, 0))} />
                        <Chip label="High/Critical" value={String(asNumber(stats.highOrCritical, 0))} />
                        <Chip label="Low/Medium" value={String(asNumber(stats.lowOrMedium, 0))} />
                        <Chip label="Avg Confidence" value={`${asNumber(stats.avgConfidence, 0)}%`} />
                    </div>
                    <Section title="Recent Activity" icon={<Gauge className="h-3.5 w-3.5" />}>
                        <div className="space-y-1 text-xs text-white/82">
                            {recentActivity.length ? recentActivity.map((row, idx) => (
                                <p key={idx}>
                                    {asString(row.threat)} | {asString(row.risk)} | {asNumber(row.confidence, 0)}% | {asString(row.timestamp)}
                                </p>
                            )) : <p className="text-white/60">No recent activity.</p>}
                        </div>
                    </Section>
                    {Object.keys(latest).length ? (
                        <Section title="Latest Analysis" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
                            <p className="text-xs text-white/82">
                                {asString(latest.threat)} | {asString(latest.risk)} | {asNumber(latest.confidence, 0)}% | {asString(latest.summary)}
                            </p>
                        </Section>
                    ) : null}
                </div>
            ) : null}

            {isChannels ? (
                <Section title="Windows Channels" icon={<Database className="h-3.5 w-3.5" />}>
                    <div className="space-y-1 text-xs text-white/82">
                        {(Array.isArray(payload.channels) ? payload.channels : []).map((value, idx) => (
                            <p key={idx}>{asString(value)}</p>
                        ))}
                    </div>
                </Section>
            ) : null}

            {isCapabilities ? (
                <Section title="Capabilities" icon={<Activity className="h-3.5 w-3.5" />}>
                    <div className="space-y-1 text-xs text-white/82">
                        {(Array.isArray(payload.actions) ? payload.actions : []).map((value, idx) => (
                            <p key={idx}>{asString(value)}</p>
                        ))}
                    </div>
                </Section>
            ) : null}
        </div>
    );
}
