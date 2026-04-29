"use client";

import React from "react";

type AnyRecord = Record<string, unknown>;

interface DevikaEngineerResultCardProps {
    result: AnyRecord;
}

function asRecord(value: unknown): AnyRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function asArray(value: unknown): AnyRecord[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object") as AnyRecord[];
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return fallback;
}

function stringifyValue(value: unknown): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
        return value
            .map((item) => stringifyValue(item))
            .filter((item) => item !== "-")
            .join(", ");
    }
    if (value && typeof value === "object") {
        const entries = Object.entries(value as AnyRecord)
            .slice(0, 4)
            .map(([key, item]) => `${key}: ${stringifyValue(item)}`)
            .filter((item) => !item.endsWith(": -"));
        return entries.join(" | ") || "-";
    }
    return "-";
}

function hasEntries(value: AnyRecord): boolean {
    return Object.values(value).some((item) => {
        if (Array.isArray(item)) return item.length > 0;
        if (item && typeof item === "object") return Object.keys(item as AnyRecord).length > 0;
        return stringifyValue(item) !== "-";
    });
}

function ListSection({ title, items }: { title: string; items: unknown[] }) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/55">{title}</p>
            <ul className="mt-2 space-y-1 text-xs text-white/85">
                {items.map((item, idx) => (
                    <li key={`${title}-${idx}`}>- {asString(item, "")}</li>
                ))}
            </ul>
        </div>
    );
}

function PlanView({ payload }: { payload: AnyRecord }) {
    const steps = asArray(payload.plan);
    return (
        <div className="space-y-2">
            {steps.length > 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/25 overflow-hidden">
                    <div className="grid grid-cols-[48px_1fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                        <span>Step</span>
                        <span>Plan</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {steps.map((step, idx) => (
                            <div key={`${asString(step.title, "step")}-${idx}`} className="grid grid-cols-[48px_1fr] gap-2 border-b border-white/5 px-3 py-2 text-xs text-white/85 last:border-b-0">
                                <span className="text-white/60">{asString(step.step, String(idx + 1))}</span>
                                <div>
                                    <p className="font-semibold text-white/90">{asString(step.title, "Task")}</p>
                                    <p className="text-white/70">{asString(step.details, "")}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            <ListSection title="Risks" items={Array.isArray(payload.risks) ? payload.risks : []} />
            <ListSection title="Acceptance Criteria" items={Array.isArray(payload.acceptanceCriteria) ? payload.acceptanceCriteria : []} />
        </div>
    );
}

function ResearchView({ payload }: { payload: AnyRecord }) {
    const findings = asArray(payload.findings);
    const queries = Array.isArray(payload.queries) ? payload.queries : [];
    return (
        <div className="space-y-2">
            {queries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {queries.slice(0, 8).map((query, idx) => (
                        <span key={`query-${idx}`} className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80">
                            {asString(query, "")}
                        </span>
                    ))}
                </div>
            ) : null}
            {findings.length > 0 ? (
                <div className="space-y-2">
                    {findings.slice(0, 5).map((finding, idx) => (
                        <div key={`finding-${idx}`} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-xs font-semibold text-white/90">{asString(finding.query, "Finding")}</p>
                            <p className="mt-1 text-xs text-white/75 whitespace-pre-wrap">{asString(finding.snippet, "")}</p>
                            {asString(finding.source, "") !== "-" ? (
                                <p className="mt-1 text-[11px] text-white/55">{asString(finding.source, "")}</p>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
            <ListSection title="Open Questions" items={Array.isArray(payload.openQuestions) ? payload.openQuestions : []} />
            <ListSection title="Next Actions" items={Array.isArray(payload.nextActions) ? payload.nextActions : []} />
        </div>
    );
}

function SnapshotView({ payload }: { payload: AnyRecord }) {
    const snapshots = asArray(payload.snapshots);
    if (snapshots.length === 0) {
        return <p className="text-xs text-white/60">No snapshots found yet.</p>;
    }
    return (
        <div className="rounded-lg border border-white/10 bg-black/25 overflow-hidden">
            <div className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                <span>Action</span>
                <span>Status</span>
                <span>Created</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
                {snapshots.map((snapshot, idx) => (
                    <div key={`${asString(snapshot.snapshotId, "snapshot")}-${idx}`} className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-xs last:border-b-0">
                        <span className="truncate text-white/90">{asString(snapshot.action, "action")}</span>
                        <span className="truncate text-white/70">{asString(snapshot.status, "-")}</span>
                        <span className="truncate text-white/60">{asString(snapshot.createdAtIso, "-")}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatusView({ payload }: { payload: AnyRecord }) {
    const counts = asRecord(payload.counts);
    if (!hasEntries(counts)) {
        return (
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/78">
                {asString(payload.note, "Status details will appear here after Devika records recent runs.")}
            </div>
        );
    }
    return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {["success", "partial_success", "needs_input", "failed", "action_required"].map((key) => (
                <div key={key} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-white/55">{key.replace("_", " ")}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{asString(counts[key], "0")}</p>
                </div>
            ))}
        </div>
    );
}

function StructuredFallbackView({ payload }: { payload: AnyRecord }) {
    const visibleEntries = Object.entries(payload).filter(([key]) => key !== "cache");
    if (visibleEntries.length === 0) {
        return (
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">
                Additional Devika details were returned, but there was no display-safe content to show yet.
            </div>
        );
    }

    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {visibleEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-white/55">
                        {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-white/85 whitespace-pre-wrap">
                        {stringifyValue(value)}
                    </p>
                </div>
            ))}
        </div>
    );
}

export function DevikaEngineerResultCard({ result }: DevikaEngineerResultCardProps) {
    const resultType = asString(result.type, "devika_status_result");
    const payload = asRecord(result.result);
    const cache = asRecord(payload.cache);
    const summary =
        asString(result.summary, "") ||
        asString(result.message, "") ||
        asString(payload.summary, "");
    const snapshotId = asString(payload.snapshotId, "");
    const executedAction = asString(payload.executedAction, "");
    const cacheHit = asString(cache.hit, "");
    const cacheSource = asString(cache.source, "");
    const cacheTtl = asString(cache.ttlSeconds, "");

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#101725] to-[#0b111c] p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">Devika Engineer Agent</p>
                    <p className="text-[11px] uppercase tracking-wide text-white/55">{resultType.replaceAll("_", " ")}</p>
                </div>
                {summary ? <p className="max-w-xl text-xs text-white/70">{summary}</p> : null}
            </div>

            {resultType === "devika_plan_result" ? <PlanView payload={payload} /> : null}
            {resultType === "devika_research_result" ? <ResearchView payload={payload} /> : null}
            {resultType === "devika_feature_result" ? (
                <div className="space-y-2">
                    <ListSection title="Implementation Plan" items={Array.isArray(payload.implementationPlan) ? payload.implementationPlan : []} />
                    <ListSection title="Test Plan" items={Array.isArray(payload.testPlan) ? payload.testPlan : []} />
                    <ListSection title="Rollback Plan" items={Array.isArray(payload.rollbackPlan) ? payload.rollbackPlan : []} />
                </div>
            ) : null}
            {resultType === "devika_bugfix_result" ? (
                <div className="space-y-2">
                    <ListSection title="Likely Root Causes" items={Array.isArray(payload.likelyRootCauses) ? payload.likelyRootCauses : []} />
                    <ListSection title="Debug Checklist" items={Array.isArray(payload.debugChecklist) ? payload.debugChecklist : []} />
                    <ListSection title="Proposed Fix" items={Array.isArray(payload.proposedFix) ? payload.proposedFix : []} />
                    <ListSection title="Verification Steps" items={Array.isArray(payload.verificationSteps) ? payload.verificationSteps : []} />
                </div>
            ) : null}
            {resultType === "devika_run_result" ? (
                <div className="space-y-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/85">
                        <p className="text-[11px] uppercase tracking-wide text-white/55">Recommended Command</p>
                        <p className="mt-1 font-mono text-white">{asString(asRecord(payload.executionStrategy).recommendedCommand, "-")}</p>
                    </div>
                    <ListSection title="Preflight Checks" items={Array.isArray(payload.preflightChecks) ? payload.preflightChecks : []} />
                    <ListSection title="Rerun Policy" items={Array.isArray(payload.rerunPolicy) ? payload.rerunPolicy : []} />
                </div>
            ) : null}
            {resultType === "devika_deploy_result" ? (
                <div className="space-y-2">
                    <ListSection title="Deployment Checklist" items={Array.isArray(payload.deploymentChecklist) ? payload.deploymentChecklist : []} />
                    <ListSection title="Release Plan" items={Array.isArray(payload.releasePlan) ? payload.releasePlan : []} />
                    <ListSection title="Risk Controls" items={Array.isArray(payload.riskControls) ? payload.riskControls : []} />
                </div>
            ) : null}
            {resultType === "devika_report_result" ? (
                <pre className="max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-white/85 whitespace-pre-wrap">
                    {asString(payload.markdown, summary || "-")}
                </pre>
            ) : null}
            {resultType === "devika_answer_result" ? (
                <div className="space-y-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/85">
                        {asString(payload.answer, summary || "-")}
                    </div>
                    <ListSection title="Follow Ups" items={Array.isArray(payload.followups) ? payload.followups : []} />
                </div>
            ) : null}
            {resultType === "devika_repo_result" ? (
                <div className="space-y-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/85">
                        <p><span className="text-white/55">Repository:</span> {asString(payload.canonicalUrl, "-")}</p>
                        <p className="mt-1"><span className="text-white/55">Clone:</span> <span className="font-mono">{asString(payload.cloneCommand, "-")}</span></p>
                    </div>
                    <ListSection title="Intake Checklist" items={Array.isArray(payload.intakeChecklist) ? payload.intakeChecklist : []} />
                </div>
            ) : null}
            {resultType === "devika_browser_result" ? (
                <div className="space-y-2">
                    <ListSection title="Interaction Plan" items={Array.isArray(payload.interactionPlan) ? payload.interactionPlan : []} />
                    <ListSection title="Safety Notes" items={Array.isArray(payload.safetyNotes) ? payload.safetyNotes : []} />
                </div>
            ) : null}
            {resultType === "devika_snapshots_result" ? <SnapshotView payload={payload} /> : null}
            {resultType === "devika_status_result" ? <StatusView payload={payload} /> : null}
            {resultType === "devika_token_result" ? (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/85">
                    Estimated tokens: <span className="font-semibold text-white">{asString(payload.tokenEstimate, "0")}</span>
                </div>
            ) : null}

            {resultType.startsWith("devika_") &&
                ![
                    "devika_plan_result",
                    "devika_research_result",
                    "devika_feature_result",
                    "devika_bugfix_result",
                    "devika_run_result",
                    "devika_deploy_result",
                    "devika_report_result",
                    "devika_answer_result",
                    "devika_repo_result",
                    "devika_browser_result",
                    "devika_snapshots_result",
                    "devika_status_result",
                    "devika_token_result",
                ].includes(resultType) ? (
                <StructuredFallbackView payload={payload} />
            ) : null}

            {executedAction || snapshotId || cacheHit || cacheSource || cacheTtl ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-[11px] text-white/62">
                    {executedAction ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                            Action: {executedAction.replaceAll("_", " ")}
                        </span>
                    ) : null}
                    {cacheHit ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                            Cache: {cacheHit}
                        </span>
                    ) : null}
                    {cacheSource ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                            Source: {cacheSource}
                        </span>
                    ) : null}
                    {cacheTtl ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                            TTL: {cacheTtl}s
                        </span>
                    ) : null}
                    {snapshotId ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                            Snapshot: {snapshotId}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
