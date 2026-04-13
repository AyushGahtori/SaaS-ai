"use client";

import React, { useMemo } from "react";
import { BookOpen, CircleCheckBig, Gauge, GraduationCap, Link2, ListChecks, Users } from "lucide-react";

interface LMSResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function compactPercent(value: unknown): string {
    return `${asNumber(value, 0).toFixed(1)}%`;
}

function statusChip(status: string): string {
    if (status === "published") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    if (status === "healthy") return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
    return "border-white/15 bg-white/5 text-white/70";
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</p>
            <p className="mt-1 text-lg font-semibold text-white/92">{value}</p>
        </div>
    );
}

function ResultHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
            <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">LMS Agent</p>
                <h3 className="mt-1 text-lg font-semibold text-white/95">{title}</h3>
                <p className="mt-1 text-sm text-white/72">{subtitle}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                <Gauge className="h-3.5 w-3.5" />
                Live Snapshot
            </span>
        </div>
    );
}

export const LMSResultCard: React.FC<LMSResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const type = asString(result.type, asString(payload.type, "lms_dashboard_result"));
    const view = asString(payload.view);
    const summary = asString(result.summary, asString(payload.summary, asString(result.message, "LMS output ready.")));

    const overview = asObject(payload.overview);
    const learners = asArray<Record<string, unknown>>(payload.learners);
    const courses = asArray<Record<string, unknown>>(payload.courses);
    const assignments = asArray<Record<string, unknown>>(payload.recentAssignments);
    const complianceTracks = asArray<Record<string, unknown>>(payload.complianceTracks);
    const moodleSync = asObject(payload.moodleSyncStatus);
    const learner = asObject(payload.learner);
    const learnerKpis = asArray<Record<string, unknown>>(payload.kpis);
    const snapshots = asArray<Record<string, unknown>>(payload.snapshots);

    const title =
        view === "courses"
            ? "LMS Courses"
            : view === "learners_directory"
                ? "Learners Directory"
                : view === "learner_detail"
                    ? asString(learner.name, "Learner Detail")
                    : view === "assignments_integrations"
                        ? "Assignments & Integrations"
                        : view === "snapshots"
                            ? "Recent LMS Snapshots"
                            : "Learner Progress Dashboard";

    return (
        <div className="mt-3 rounded-3xl border border-white/10 bg-[#0A0F15] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <ResultHeader title={title} subtitle={summary} />

            {(type === "lms_dashboard_result" || view === "dashboard") && (
                <>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <MetricCard label="Trained" value={compactPercent(overview.trainedPercentage)} />
                        <MetricCard label="Passed" value={String(asNumber(overview.passed, 0))} />
                        <MetricCard label="Failed" value={String(asNumber(overview.failed, 0))} />
                        <MetricCard label="In Progress" value={String(asNumber(overview.inProgress, 0))} />
                        <MetricCard label="Not Started" value={String(asNumber(overview.notStarted, 0))} />
                        <MetricCard label="Learners" value={String(asNumber(overview.totalLearners, learners.length))} />
                    </div>

                    {learners.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="mb-2 flex items-center gap-2 text-white/85">
                                <Users className="h-4 w-4 text-cyan-200" />
                                <p className="text-sm font-medium">Learners</p>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                                {learners.slice(0, 6).map((row, idx) => (
                                    <div key={`${asString(row.learnerId, "learner")}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-sm font-medium text-white/92">{asString(row.fullName, "Learner")}</p>
                                        <p className="mt-0.5 text-xs text-white/58">
                                            {asString(row.department, "Department")} • {asString(row.role, "Role")}
                                        </p>
                                        <p className="mt-1 text-xs text-cyan-100/80">
                                            Trained {compactPercent(row.trainedPercentage)} • Enrollments {asNumber(row.enrollments, 0)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </>
            )}

            {(type === "lms_courses_result" || view === "courses") && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course, idx) => (
                        <div key={`${asString(course.courseId, "course")}-${idx}`} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-white/92">{asString(course.title, "Course")}</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusChip(asString(course.status, "draft").toLowerCase())}`}>
                                    {asString(course.status, "draft")}
                                </span>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-white/70">
                                <p className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-cyan-200/80" /> Difficulty: {asString(course.difficulty, "Unknown")}</p>
                                <p className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5 text-cyan-200/80" /> Enrolled: {asNumber(course.enrolled, 0)}</p>
                                <p>Rating: {"★".repeat(Math.max(0, Math.min(5, asNumber(course.rating, 0))))}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {(type === "lms_learners_directory_result" || view === "learners_directory") && (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center gap-2 text-white/85">
                        <Users className="h-4 w-4 text-cyan-200" />
                        <p className="text-sm font-medium">Learners Directory</p>
                    </div>
                    <div className="space-y-2">
                        {learners.slice(0, 8).map((row, idx) => (
                            <div key={`${asString(row.learnerId, "learner")}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                <div>
                                    <p className="text-sm text-white/92">{asString(row.fullName, "Learner")}</p>
                                    <p className="text-xs text-white/58">
                                        {asString(row.department, "Department")} • {asString(row.skillLevel, "Skill")} • {asString(row.role, "Role")}
                                    </p>
                                </div>
                                <p className="text-sm font-medium text-cyan-100">{compactPercent(row.trainedPercentage)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(type === "lms_learner_detail_result" || view === "learner_detail") && (
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                        <p className="text-sm font-medium text-white/92">{asString(learner.name, "Learner")}</p>
                        <p className="mt-0.5 text-xs text-white/58">{asString(learner.subtitle, "Learner progress profile")}</p>
                        <div className="mt-3 space-y-2">
                            {learnerKpis.map((kpi, idx) => (
                                <div key={`${asString(kpi.label, "kpi")}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs uppercase tracking-wide text-white/55">{asString(kpi.label, "Metric")}</p>
                                        <p className="text-sm font-semibold text-cyan-100">{compactPercent(kpi.value)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                        <p className="text-sm font-medium text-white/85">Milestones</p>
                        <div className="mt-2 space-y-2">
                            {asArray<Record<string, unknown>>(payload.milestones).slice(0, 4).map((row, idx) => (
                                <div key={`${asString(row.label, "milestone")}-${idx}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                                    <span>{asString(row.label, "Milestone")}</span>
                                    <span className="text-cyan-100">{asString(row.status, "-")}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {(type === "lms_assignments_result" || view === "assignments_integrations") && (
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                        <div className="mb-2 flex items-center gap-2 text-white/85">
                            <ListChecks className="h-4 w-4 text-cyan-200" />
                            <p className="text-sm font-medium">Compliance Tracks</p>
                        </div>
                        <div className="space-y-2">
                            {complianceTracks.slice(0, 5).map((row, idx) => (
                                <div key={`${asString(row.name, "track")}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                                    <p className="text-white/90">{asString(row.name, "Track")}</p>
                                    <p className="text-xs text-white/58">{asString(row.role, "Role")} • Renewal {asString(row.renewal, "-")}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                        <div className="mb-2 flex items-center gap-2 text-white/85">
                            <Link2 className="h-4 w-4 text-cyan-200" />
                            <p className="text-sm font-medium">Integration Health</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${statusChip(asString(moodleSync.connectionHealth, "unknown").toLowerCase())}`}>
                            <CircleCheckBig className="h-3.5 w-3.5" />
                            {asString(moodleSync.connectionHealth, "unknown")}
                        </span>
                        <div className="mt-3 space-y-2">
                            {assignments.slice(0, 3).map((row, idx) => (
                                <div key={`${asString(row.individual, "person")}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                                    <p className="text-white/90">{asString(row.individual, "Learner")}</p>
                                    <p className="text-xs text-white/58">{asString(row.course, "Course")} • Due {asString(row.dueDate, "-")}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {(type === "lms_snapshots_result" || view === "snapshots") && (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center gap-2 text-white/85">
                        <ListChecks className="h-4 w-4 text-cyan-200" />
                        <p className="text-sm font-medium">Recent Snapshots</p>
                    </div>
                    <div className="space-y-2">
                        {snapshots.length > 0 ? snapshots.slice(0, 8).map((row, idx) => (
                            <div key={`${asString(row.snapshotId, "snapshot")}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                                <p className="text-white/90">{asString(row.type, "snapshot")}</p>
                                <p className="text-xs text-white/58">{asString(row.createdAtIso, "recent")}</p>
                            </div>
                        )) : (
                            <p className="text-sm text-white/60">No snapshots found yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
