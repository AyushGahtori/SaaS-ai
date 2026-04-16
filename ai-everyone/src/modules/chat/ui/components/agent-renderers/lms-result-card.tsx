"use client";

import React from "react";

type AnyRecord = Record<string, unknown>;

interface LMSResultCardProps {
    result: AnyRecord;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMELINE_MONTHS: Array<{ key: string; label: string }> = [
    { key: "jan", label: "Jan" },
    { key: "feb", label: "Feb" },
    { key: "mar", label: "Mar" },
    { key: "apr", label: "Apr" },
    { key: "may", label: "May" },
    { key: "jun", label: "Jun" },
    { key: "jul", label: "Jul" },
    { key: "aug", label: "Aug" },
    { key: "sep", label: "Sep" },
    { key: "oct", label: "Oct" },
    { key: "nov", label: "Nov" },
    { key: "dec", label: "Dec" },
];

function asRecord(value: unknown): AnyRecord | null {
    return value && typeof value === "object" ? (value as AnyRecord) : null;
}

function asArray(value: unknown): AnyRecord[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object") as AnyRecord[];
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function ValueCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-white/55">{label}</p>
            <p className="mt-1 text-base font-semibold text-white">{value}</p>
        </div>
    );
}

function SegmentBars({ segments }: { segments: AnyRecord[] }) {
    if (segments.length === 0) return null;

    const allSeries = segments.flatMap((segment) =>
        Array.isArray(segment.series) ? segment.series.map((value) => asNumber(value, 0)) : []
    );
    const max = Math.max(1, ...allSeries);

    return (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Department Activity</p>
            <div className="mt-3 space-y-3">
                {segments.map((segment, idx) => {
                    const series = Array.isArray(segment.series)
                        ? segment.series.map((value) => asNumber(value, 0))
                        : [];
                    return (
                        <div key={`${asString(segment.label, "segment")}-${idx}`}>
                            <p className="mb-1 text-xs text-white/70">{asString(segment.label, "Segment")}</p>
                            <div className="grid grid-cols-7 gap-1">
                                {WEEK_DAYS.map((day, dayIdx) => {
                                    const value = series[dayIdx] || 0;
                                    const percent = Math.max(6, Math.round((value / max) * 100));
                                    return (
                                        <div key={`${day}-${dayIdx}`} className="space-y-1">
                                            <div className="h-16 rounded-md bg-white/[0.04] p-1">
                                                <div
                                                    className="w-full rounded-sm bg-gradient-to-t from-[#7c8f86] to-[#b6c2b0]"
                                                    style={{ height: `${percent}%`, marginTop: `${100 - percent}%` }}
                                                />
                                            </div>
                                            <p className="text-center text-[10px] text-white/45">{day}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DashboardView({ payload }: { payload: AnyRecord }) {
    const overview = asRecord(payload.overview) || {};
    const learners = asArray(payload.learners);
    const segments = asArray(payload.segments);

    return (
        <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <ValueCard label="Trained" value={`${asNumber(overview.trainedPercentage, 0).toFixed(1)}%`} />
                <ValueCard label="Passed" value={String(asNumber(overview.passed, 0))} />
                <ValueCard label="Failed" value={String(asNumber(overview.failed, 0))} />
                <ValueCard label="In Progress" value={String(asNumber(overview.inProgress, 0))} />
                <ValueCard label="Not Started" value={String(asNumber(overview.notStarted, 0))} />
                <ValueCard label="Learners" value={String(asNumber(overview.totalLearners, learners.length))} />
            </div>

            <SegmentBars segments={segments} />

            <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
                <div className="grid grid-cols-[1.8fr_1fr_0.9fr_0.9fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                    <span>Learner</span>
                    <span>Department</span>
                    <span>Trained %</span>
                    <span>Completed</span>
                </div>
                <div className="custom-scrollbar-always max-h-56 overflow-y-auto">
                    {learners.slice(0, 12).map((learner, idx) => (
                        <div
                            key={`${asString(learner.learnerId, "learner")}-${idx}`}
                            className="grid grid-cols-[1.8fr_1fr_0.9fr_0.9fr] gap-2 border-b border-white/5 px-3 py-2 text-xs text-white/85 last:border-b-0"
                        >
                            <span className="truncate">{asString(learner.fullName)}</span>
                            <span className="truncate text-white/70">{asString(learner.department)}</span>
                            <span>{asNumber(learner.trainedPercentage, 0).toFixed(1)}%</span>
                            <span>{asNumber(learner.completed, 0)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CoursesView({ payload }: { payload: AnyRecord }) {
    const courses = asArray(payload.courses);
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 12).map((course, idx) => {
                const status = asString(course.status, "draft").toLowerCase();
                const badgeClass =
                    status === "published"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                        : "border-white/20 bg-white/5 text-white/70";
                return (
                    <div key={`${asString(course.courseId, "course")}-${idx}`} className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-white">{asString(course.title, "Untitled Course")}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${badgeClass}`}>{status}</span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-white/70">
                            <p>Enrolled: {asNumber(course.enrolled, 0)}</p>
                            <p>Difficulty: {asString(course.difficulty, "Intermediate")}</p>
                            <p>Rating: {"★".repeat(Math.max(1, Math.min(5, asNumber(course.rating, 3))))}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LearnersDirectoryView({ payload }: { payload: AnyRecord }) {
    const learners = asArray(payload.learners);
    return (
        <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                <span>Full Name</span>
                <span>Department</span>
                <span>Skill</span>
                <span>Role</span>
            </div>
            <div className="custom-scrollbar-always max-h-64 overflow-y-auto">
                {learners.slice(0, 14).map((learner, idx) => (
                    <div
                        key={`${asString(learner.learnerId, "learner")}-${idx}`}
                        className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-xs text-white/85 last:border-b-0"
                    >
                        <span className="truncate">{asString(learner.fullName)}</span>
                        <span className="truncate text-white/70">{asString(learner.department)}</span>
                        <span className="truncate text-white/70">{asString(learner.skillLevel)}</span>
                        <span className="truncate text-white/70">{asString(learner.role)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LearnerDetailView({ payload }: { payload: AnyRecord }) {
    const learner = asRecord(payload.learner) || {};
    const kpis = asArray(payload.kpis);
    const milestones = asArray(payload.milestones);
    const upcomingDeadlines = asArray(payload.upcomingDeadlines);
    const segments = asArray(payload.segments);

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-sm font-semibold text-white">{asString(learner.name, "Learner")}</p>
                <p className="text-xs text-white/55">{asString(learner.subtitle, "Learner detail report")}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
                {kpis.slice(0, 3).map((kpi, idx) => (
                    <ValueCard key={`${asString(kpi.label, "kpi")}-${idx}`} label={asString(kpi.label, "KPI")} value={`${asNumber(kpi.value, 0).toFixed(1)}%`} />
                ))}
            </div>

            <SegmentBars segments={segments} />

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Milestones</p>
                    <div className="mt-2 space-y-2">
                        {milestones.slice(0, 6).map((item, idx) => (
                            <div key={`${asString(item.label, "milestone")}-${idx}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs">
                                <span className="truncate text-white/85">{asString(item.label)}</span>
                                <span className="text-emerald-300">{asString(item.status, "Achieved")}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Upcoming Deadlines</p>
                    <div className="mt-2 space-y-2">
                        {upcomingDeadlines.slice(0, 6).map((item, idx) => (
                            <div key={`${asString(item.label, "deadline")}-${idx}`} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs">
                                <span className="truncate text-white/85">{asString(item.label)}</span>
                                <span className="text-white/60">{asString(item.status)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AssignmentsView({ payload }: { payload: AnyRecord }) {
    const complianceTracks = asArray(payload.complianceTracks);
    const recentAssignments = asArray(payload.recentAssignments);
    const moodleSyncStatus = asRecord(payload.moodleSyncStatus) || {};
    const moodleHealth = asString(moodleSyncStatus.connectionHealth, "unknown");
    const healthClass =
        moodleHealth === "healthy"
            ? "text-emerald-300"
            : moodleHealth === "degraded"
                ? "text-yellow-300"
                : "text-white/70";

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Moodle Sync Status</p>
                <p className={`mt-1 text-sm font-semibold ${healthClass}`}>{moodleHealth}</p>
                <p className="mt-1 text-xs text-white/60">{asString(moodleSyncStatus.details, "No status details available.")}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
                <div className="grid grid-cols-[1.8fr_0.9fr_6fr_1fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                    <span>Compliance Track</span>
                    <span>Role</span>
                    <span>Timeline</span>
                    <span>Renewal</span>
                </div>
                <div className="custom-scrollbar-always max-h-64 overflow-y-auto">
                    {complianceTracks.slice(0, 8).map((track, idx) => {
                        const timeline = asRecord(track.timeline) || {};
                        return (
                            <div
                                key={`${asString(track.name, "track")}-${idx}`}
                                className="grid grid-cols-[1.8fr_0.9fr_6fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-xs last:border-b-0"
                            >
                                <span className="truncate text-white/90">{asString(track.name)}</span>
                                <span className="truncate text-white/65">{asString(track.role)}</span>
                                <div className="grid grid-cols-12 gap-1">
                                    {TIMELINE_MONTHS.map((month) => (
                                        <div
                                            key={month.key}
                                            className={`rounded-sm px-1 py-1 text-center text-[10px] ${
                                                timeline[month.key] ? "bg-white/25 text-white" : "bg-white/[0.04] text-white/35"
                                            }`}
                                        >
                                            {month.label}
                                        </div>
                                    ))}
                                </div>
                                <span className="truncate text-white/65">{asString(track.renewal)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
                <div className="grid grid-cols-[1.5fr_1.5fr_1fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                    <span>Individual</span>
                    <span>Course</span>
                    <span>Due</span>
                </div>
                <div className="custom-scrollbar-always max-h-52 overflow-y-auto">
                    {recentAssignments.slice(0, 10).map((assignment, idx) => (
                        <div
                            key={`${asString(assignment.individual, "assignment")}-${idx}`}
                            className="grid grid-cols-[1.5fr_1.5fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-xs last:border-b-0"
                        >
                            <span className="truncate text-white/90">{asString(assignment.individual)}</span>
                            <span className="truncate text-white/70">{asString(assignment.course)}</span>
                            <span className="truncate text-white/65">{asString(assignment.dueDate)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SnapshotsView({ payload }: { payload: AnyRecord }) {
    const snapshots = asArray(payload.snapshots);
    return (
        <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
                <span>Type</span>
                <span>Snapshot</span>
                <span>Created</span>
            </div>
            <div className="custom-scrollbar-always max-h-56 overflow-y-auto">
                {snapshots.map((snapshot, idx) => (
                    <div
                        key={`${asString(snapshot.snapshotId, "snapshot")}-${idx}`}
                        className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-white/5 px-3 py-2 text-xs last:border-b-0"
                    >
                        <span className="truncate text-white/85">{asString(snapshot.type)}</span>
                        <span className="truncate text-white/70">{asString(snapshot.snapshotId)}</span>
                        <span className="truncate text-white/60">{asString(snapshot.createdAtIso, "-")}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function LMSResultCard({ result }: LMSResultCardProps) {
    const resultType = asString(result.type, "lms_dashboard_result");
    const payload = asRecord(result.result) || {};
    const summary =
        asString(result.summary, "") ||
        asString(result.message, "") ||
        asString(payload.summary, "");

    return (
        <div className="mt-3 rounded-2xl border border-white/10 bg-gradient-to-b from-[#111826] to-[#0a101b] p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">LMS Agent</p>
                    <p className="text-xs uppercase tracking-wide text-white/50">{resultType.split("_").join(" ")}</p>
                </div>
                {summary ? <p className="max-w-xl text-xs text-white/70">{summary}</p> : null}
            </div>

            {resultType === "lms_dashboard_result" ? <DashboardView payload={payload} /> : null}
            {resultType === "lms_courses_result" ? <CoursesView payload={payload} /> : null}
            {resultType === "lms_learners_directory_result" ? <LearnersDirectoryView payload={payload} /> : null}
            {resultType === "lms_learner_detail_result" ? <LearnerDetailView payload={payload} /> : null}
            {resultType === "lms_assignments_result" ? <AssignmentsView payload={payload} /> : null}
            {resultType === "lms_snapshots_result" ? <SnapshotsView payload={payload} /> : null}
        </div>
    );
}
