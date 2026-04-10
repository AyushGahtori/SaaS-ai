"use client";

import React, { useMemo } from "react";
import { BadgeCheck, ClipboardList, CircleHelp, MessageSquareText, Trophy, UserRound } from "lucide-react";

interface ATSResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNum(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

export const ATSResultCard: React.FC<ATSResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const type = asString(result.type, asString(payload.type, "ats_result"));
    const summary = asString(result.summary, asString(payload.summary, asString(result.message, "ATS output ready.")));

    const analysis = asObject(payload.analysis);
    const score = asNum(analysis.overallScore, asNum(payload.overallScore, 0));
    const scoreBreakdown = asObject(analysis.scoreBreakdown);
    const strengths = asArray(analysis.strengths).map((item) => asString(item)).filter(Boolean);
    const growth = asArray(analysis.areasForGrowth).map((item) => asString(item)).filter(Boolean);

    const questions = asArray(payload.questions).map((item) => asObject(item));
    const feedback = asObject(payload.feedback);
    const rankings = asArray(payload.rankings).map((item) => asObject(item));
    const topRecommendation = asObject(payload.topRecommendation);
    const candidateName = asString(payload.candidateName, asString(payload.name, "Candidate"));
    const stage = asString(payload.stage, "Interview");

    return (
        <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-[#0B1016] text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(107,114,128,0.16),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">ATS Agent</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-50">{candidateName}</h3>
                        <p className="mt-1 text-sm text-slate-300">{summary}</p>
                    </div>
                    {score > 0 ? (
                        <div className="rounded-2xl border border-slate-300/15 bg-black/25 px-4 py-3 text-right">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Match Score</p>
                            <p className="text-3xl font-semibold tracking-tight text-slate-100">{Math.round(score)}%</p>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-3 px-5 py-4">
                {type === "ats_candidate_analysis" ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-4">
                            {[
                                ["Job Fit", asNum(scoreBreakdown.jobFit)],
                                ["Technical", asNum(scoreBreakdown.technicalFit)],
                                ["Cultural", asNum(scoreBreakdown.culturalFit)],
                                ["Communication", asNum(scoreBreakdown.communicationFit)],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
                                    <p className="mt-1 text-xl font-semibold text-slate-100">{Math.round(Number(value))}%</p>
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="mb-2 flex items-center gap-2 text-slate-200">
                                    <BadgeCheck className="h-4 w-4" />
                                    <p className="text-sm font-medium">Strengths</p>
                                </div>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    {strengths.length > 0 ? strengths.slice(0, 5).map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>) : <li>No strengths returned.</li>}
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="mb-2 flex items-center gap-2 text-slate-200">
                                    <CircleHelp className="h-4 w-4" />
                                    <p className="text-sm font-medium">Areas For Growth</p>
                                </div>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    {growth.length > 0 ? growth.slice(0, 5).map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>) : <li>No growth areas returned.</li>}
                                </ul>
                            </div>
                        </div>
                    </>
                ) : null}

                {type === "ats_interview_questions" ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-slate-200">
                                <ClipboardList className="h-4 w-4" />
                                <p className="text-sm font-medium">Interview Questions</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">{stage}</span>
                        </div>
                        <div className="space-y-3">
                            {questions.map((row, idx) => (
                                <div key={`${asString(row.question)}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                    <p className="text-sm font-medium text-slate-100">{idx + 1}. {asString(row.question, "Question")}</p>
                                    {asString(row.context) ? <p className="mt-1 text-sm text-slate-300">{asString(row.context)}</p> : null}
                                    {asString(row.tag) ? <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">{asString(row.tag)}</p> : null}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {type === "ats_interview_feedback" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="mb-2 flex items-center gap-2 text-slate-200">
                                <MessageSquareText className="h-4 w-4" />
                                <p className="text-sm font-medium">Feedback Snapshot</p>
                            </div>
                            <p className="text-sm text-slate-300">Rating: {Math.round(asNum(feedback.ratingOutOf10, 0))}/10</p>
                            <p className="mt-2 text-sm text-slate-300">{asString(feedback.summary, "No feedback summary returned.")}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-sm font-medium text-slate-200">Recommendations</p>
                            <ul className="mt-2 space-y-2 text-sm text-slate-300">
                                {asArray(feedback.recommendations).map((item, idx) => (
                                    <li key={`${asString(item)}-${idx}`}>{asString(item)}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : null}

                {type === "ats_candidate_compare" ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-slate-200">
                                <Trophy className="h-4 w-4" />
                                <p className="text-sm font-medium">Candidate Comparison</p>
                            </div>
                            {asString(topRecommendation.name) ? (
                                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                    Top pick: {asString(topRecommendation.name)}
                                </span>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            {rankings.map((row, idx) => (
                                <div key={`${asString(row.name)}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                    <div className="flex items-center gap-2 text-sm text-slate-200">
                                        <UserRound className="h-4 w-4 text-slate-400" />
                                        <span>{asString(row.name, `Candidate ${idx + 1}`)}</span>
                                    </div>
                                    <span className="text-sm font-medium text-slate-100">{Math.round(asNum(row.score, 0))}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {type === "ats_candidates_list" ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-medium text-slate-200">Recent Candidates</p>
                        <div className="mt-3 space-y-2">
                            {asArray(payload.candidates).map((item, idx) => {
                                const row = asObject(item);
                                return (
                                    <div key={`${asString(row.candidateId)}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                        <div>
                                            <p className="text-sm text-slate-100">{asString(row.name, "Candidate")}</p>
                                            <p className="text-xs text-slate-400">{asString(row.jobTitle, "Open Role")}</p>
                                        </div>
                                        <p className="text-sm text-slate-200">{Math.round(asNum(row.overallScore, 0))}%</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
