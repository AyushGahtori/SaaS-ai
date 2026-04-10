"use client";

import React, { useMemo } from "react";
import { ArrowRight, CheckCircle2, FileText, Globe2, Search, Sparkles } from "lucide-react";

interface SeoResultCardProps {
    result: Record<string, unknown>;
}

type SeoSection = {
    title?: string;
    summary?: string;
    bullets?: string[];
    kind?: string;
};

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => asString(item, "")).filter(Boolean) : [];
}

function normalizePayload(result: Record<string, unknown>): Record<string, unknown> {
    const nested = asObject(result.result);
    return Object.keys(nested).length > 0 ? nested : result;
}

function SectionCard({ section }: { section: SeoSection }) {
    const bullets = section.bullets || [];
    return (
        <div className="rounded-xl border border-slate-200/10 bg-slate-950/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{section.kind || "section"}</p>
                    <h4 className="text-sm font-semibold text-slate-100">{section.title || "Report section"}</h4>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
            </div>
            {section.summary ? <p className="text-sm leading-6 text-slate-300">{section.summary}</p> : null}
            {bullets.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {bullets.map((bullet, idx) => (
                        <li key={`${bullet}-${idx}`} className="flex gap-2">
                            <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200/10 text-[10px] text-slate-400">
                                •
                            </span>
                            <span className="leading-6">{bullet}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

export const SeoResultCard: React.FC<SeoResultCardProps> = ({ result }) => {
    const payload = useMemo(() => normalizePayload(result), [result]);

    const summary = asString(payload.summary, asString(payload.message, ""));
    const mode = asString(payload.mode, "brief");
    const topic = asString(payload.topic, "SEO analysis");
    const searchQuery = asString(payload.searchQuery, topic);
    const title = asString(payload.title, "");
    const sourceUrl = asString(payload.sourceUrl, "");
    const displayName = asString(payload.displayName, "SEO Agent");
    const inputMode = asString(payload.inputMode, "topic_only");
    const warnings = asStringArray(payload.warnings);
    const nextSteps = asStringArray(payload.nextSteps);
    const reportSections = Array.isArray(payload.reportSections) ? (payload.reportSections as SeoSection[]) : [];

    const searchInsights = asObject(payload.searchInsights);
    const primaryKeywords = asStringArray(searchInsights.primaryKeywords);
    const relatedKeywords = asStringArray(searchInsights.relatedKeywords);
    const relatedQuestions = asStringArray(searchInsights.relatedQuestions);
    const searchIntent = asString(searchInsights.searchIntent, "Search intent unavailable.");
    const competitorAnalysis = asString(searchInsights.competitorAnalysis, "");
    const aiOverviewSummary = asString(searchInsights.aiOverviewSummary, "");

    const brief = asObject(payload.contentBrief);
    const audit = asObject(payload.articleAudit);
    const edits = asObject(payload.sectionEdits);

    const headings = asStringArray(brief.recommendedHeadings);
    const faqs = asStringArray(brief.faqSuggestions);
    const briefStructure = asString(brief.contentStructureRecommendations, "");
    const keywordGuidance = asString(brief.keywordPlacementGuidance, "");
    const writingGuidelines = asString(brief.writingGuidelines, "");

    const strengths = asString(audit.contentStrengths, "");
    const gaps = asString(audit.contentGaps, "");
    const opportunities = asString(audit.keywordOpportunities, "");
    const structureImprovements = asString(audit.structureImprovements, "");
    const eeat = asString(audit.e_e_a_t_assessment || audit.eEATAssessment, "");
    const missingSections = asStringArray(audit.missingSections);
    const recommendations = asStringArray(audit.prioritizedRecommendations);

    const improvedSections = Array.isArray(edits.improvedSections) ? (edits.improvedSections as Array<Record<string, unknown>>) : [];
    const keywordIntegrationSummary = asString(edits.keywordIntegrationSummary, "");
    const changesExplanation = asString(edits.changesExplanation, "");

    const wordCount = Number(payload.sourceWordCount || 0);
    const charCount = Number(payload.sourceCharacterCount || 0);

    return (
        <div className="mt-3 rounded-2xl border border-slate-200/10 bg-slate-950/85 p-4 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/10 pb-4">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-slate-300" />
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{displayName}</p>
                    </div>
                    <h3 className="truncate text-lg font-semibold text-slate-50">{searchQuery}</h3>
                    {title ? <p className="mt-1 text-sm text-slate-400">{title}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-200/10 bg-slate-100/5 px-2.5 py-1 text-xs font-medium text-slate-200">
                        {mode === "optimization" ? "Optimization Mode" : "Brief Mode"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/10 bg-slate-100/5 px-2.5 py-1 text-xs text-slate-300">
                        <FileText className="h-3.5 w-3.5" />
                        {inputMode.replace(/_/g, " ")}
                    </span>
                </div>
            </div>

            {summary ? (
                <div className="mt-4 rounded-xl border border-slate-200/10 bg-slate-100/5 px-4 py-3 text-sm leading-6 text-slate-200">
                    {summary}
                </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Search Intent</p>
                    <p className="mt-1 text-sm text-slate-200">{searchIntent}</p>
                </div>
                <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Source Size</p>
                    <p className="mt-1 text-sm text-slate-200">{wordCount > 0 ? `${wordCount.toLocaleString("en-US")} words` : "Topic only"}</p>
                    <p className="text-xs text-slate-500">{charCount > 0 ? `${charCount.toLocaleString("en-US")} characters` : "No article text provided"}</p>
                </div>
                <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Source URL</p>
                    {sourceUrl ? (
                        <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-sm text-slate-200 hover:text-slate-100"
                        >
                            <Globe2 className="h-3.5 w-3.5" />
                            Open source
                        </a>
                    ) : (
                        <p className="mt-1 text-sm text-slate-400">No URL attached</p>
                    )}
                </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                        <Search className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Search Insights</h4>
                    </div>
                    {primaryKeywords.length > 0 ? (
                        <div className="mb-3">
                            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Primary Keywords</p>
                            <div className="flex flex-wrap gap-2">
                                {primaryKeywords.slice(0, 6).map((keyword, idx) => (
                                    <span key={`${keyword}-${idx}`} className="rounded-full border border-slate-200/10 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-200">
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {relatedKeywords.length > 0 ? (
                        <div className="mb-3">
                            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Related Keywords</p>
                            <p className="text-sm leading-6 text-slate-300">{relatedKeywords.slice(0, 8).join(", ")}</p>
                        </div>
                    ) : null}
                    {relatedQuestions.length > 0 ? (
                        <div>
                            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Related Questions</p>
                            <ul className="space-y-2 text-sm text-slate-300">
                                {relatedQuestions.slice(0, 5).map((question, idx) => (
                                    <li key={`${question}-${idx}`} className="flex gap-2">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                        <span>{question}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>

                <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Competitor and SERP Notes</h4>
                    </div>
                    {competitorAnalysis ? <p className="text-sm leading-6 text-slate-300">{competitorAnalysis}</p> : null}
                    {aiOverviewSummary ? (
                        <div className="mt-3 rounded-lg border border-slate-200/10 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">AI Overview Summary</p>
                            <p className="mt-1 text-sm leading-6 text-slate-300">{aiOverviewSummary}</p>
                        </div>
                    ) : null}
                </div>
            </div>

            {brief ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Content Outline</p>
                        <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{asString(brief.contentOutline, "")}</pre>
                    </div>
                    <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Recommended Headings</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {headings.map((heading, idx) => (
                                    <span key={`${heading}-${idx}`} className="rounded-full border border-slate-200/10 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-200">
                                        {heading}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Keyword Guidance</p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">{keywordGuidance}</p>
                            {briefStructure ? <p className="mt-2 text-sm leading-6 text-slate-300">{briefStructure}</p> : null}
                            {writingGuidelines ? <p className="mt-2 text-sm leading-6 text-slate-300">{writingGuidelines}</p> : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {audit ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Audit Notes</p>
                        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
                            {strengths ? <p>{strengths}</p> : null}
                            {gaps ? <p>{gaps}</p> : null}
                            {opportunities ? <p>{opportunities}</p> : null}
                            {structureImprovements ? <p>{structureImprovements}</p> : null}
                            {eeat ? <p>{eeat}</p> : null}
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Prioritized Actions</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                            {recommendations.length > 0
                                ? recommendations.slice(0, 6).map((item, idx) => (
                                      <li key={`${item}-${idx}`} className="flex gap-2">
                                          <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200/10 text-[10px] text-slate-300">
                                              {idx + 1}
                                          </span>
                                          <span className="leading-6">{item}</span>
                                      </li>
                                  ))
                                : null}
                        </ul>
                        {missingSections.length > 0 ? (
                            <div className="mt-3 rounded-lg border border-slate-200/10 bg-slate-950/70 p-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Missing Sections</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300">{missingSections.join(", ")}</p>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {edits ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Rewrite Guidance</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{changesExplanation || keywordIntegrationSummary}</p>
                        {keywordIntegrationSummary ? <p className="mt-2 text-sm leading-6 text-slate-300">{keywordIntegrationSummary}</p> : null}
                    </div>
                    <div className="space-y-3">
                        {improvedSections.slice(0, 4).map((section, idx) => (
                            <div key={`${String(section.heading || section.rewrite)}-${idx}`} className="rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{asString(section.heading, "Suggested rewrite")}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300">{asString(section.rewrite, "")}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {reportSections.length > 0 ? (
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-slate-300" />
                        <h4 className="text-sm font-semibold text-slate-100">Structured Report</h4>
                    </div>
                    {reportSections.map((section, idx) => (
                        <SectionCard key={`${String(section.title || section.kind)}-${idx}`} section={section} />
                    ))}
                </div>
            ) : null}

            {nextSteps.length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Next Steps</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                        {nextSteps.map((step, idx) => (
                            <li key={`${step}-${idx}`} className="flex gap-2">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                <span className="leading-6">{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {warnings.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Notes</p>
                    <ul className="mt-2 space-y-1.5">
                        {warnings.map((warning, idx) => (
                            <li key={`${warning}-${idx}`}>{warning}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {faqs.length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-200/10 bg-slate-100/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">FAQ Suggestions</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-300">
                        {faqs.slice(0, 6).map((faq, idx) => (
                            <p key={`${faq}-${idx}`}>Q. {faq}</p>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

