"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarDays, IndianRupee, Link2, Mail, PlaneTakeoff, Users } from "lucide-react";

interface TravelHalperResultCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "-"): string {
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
}

interface MarkdownSection {
    heading: string;
    content: string;
}

interface ParsedTravelPlan {
    travelers: string;
    budget: string;
    tripDates: string;
    estimatedTotal: string;
    bookingLinks: Array<{ label: string; href: string }>;
    sections: MarkdownSection[];
}

function markdownInlineToText(value: string): string {
    return value
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .trim();
}

function parseTravelPlan(markdown: string): ParsedTravelPlan {
    const lines = markdown.split(/\r?\n/);
    const sections: MarkdownSection[] = [];

    let currentHeading = "Overview";
    let currentLines: string[] = [];
    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const headingMatch = line.match(/^###\s+\*\*(.+?)\*\*$/);
        if (headingMatch) {
            if (currentLines.length > 0) {
                sections.push({
                    heading: currentHeading,
                    content: currentLines.join("\n").trim(),
                });
            }
            currentHeading = markdownInlineToText(headingMatch[1] || "Section");
            currentLines = [];
            continue;
        }
        currentLines.push(line);
    }
    if (currentLines.length > 0) {
        sections.push({
            heading: currentHeading,
            content: currentLines.join("\n").trim(),
        });
    }

    const bookingLinks: Array<{ label: string; href: string }> = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    for (const section of sections) {
        let match: RegExpExecArray | null = null;
        while ((match = linkRegex.exec(section.content)) !== null) {
            const label = (match[1] || "").trim();
            const href = (match[2] || "").trim();
            if (!label || !href) continue;
            if (bookingLinks.some((item) => item.href === href)) continue;
            bookingLinks.push({ label, href });
        }
    }

    const budgetMatch = markdown.match(/budget of Rs\.\s*([\d,]+)/i);
    const travelersMatch = markdown.match(/for\s+(\d+)\s+(people|traveler|travelers|adults)/i);
    const tripDatesMatch = markdown.match(/\*\*Trip Dates:\*\*\s*(.+)/i);
    const totalCostMatch = markdown.match(/\*\*Total Estimated Cost:\*\*\s*\*\*Rs\.\s*([\d,]+)\*\*/i);

    return {
        travelers: travelersMatch ? travelersMatch[1] : "-",
        budget: budgetMatch ? budgetMatch[1] : "-",
        tripDates: tripDatesMatch ? markdownInlineToText(tripDatesMatch[1]) : "-",
        estimatedTotal: totalCostMatch ? totalCostMatch[1] : "-",
        bookingLinks,
        sections: sections.filter((section) => section.content.length > 0),
    };
}

function TravelMarkdown({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => <h3 className="text-base font-semibold text-white/95">{children}</h3>,
                h2: ({ children }) => <h4 className="text-sm font-semibold text-white/90">{children}</h4>,
                h3: ({ children }) => <h5 className="text-sm font-semibold text-white/90">{children}</h5>,
                hr: () => <div className="my-2 border-t border-white/10" />,
                p: ({ children }) => <p className="text-sm leading-6 text-white/80">{children}</p>,
                ul: ({ children }) => <ul className="space-y-1.5 pl-4 text-sm text-white/80">{children}</ul>,
                li: ({ children }) => <li className="list-disc">{children}</li>,
                a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="text-cyan-300 underline decoration-cyan-300/50 underline-offset-2 hover:text-cyan-200">
                        {children}
                    </a>
                ),
                code: ({ children }) => <code className="rounded bg-white/10 px-1 py-0.5 text-[0.92em] text-white/90">{children}</code>,
                pre: ({ children }) => <pre className="custom-scrollbar overflow-x-auto rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-white/85">{children}</pre>,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

export const TravelHalperResultCard: React.FC<TravelHalperResultCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const type = asString(result.type, "");
    const summary = asString(result.summary || result.message, "");
    const threadId = asString(payload.threadId, "");
    const planMarkdown = asString(payload.planMarkdown, "");
    const toEmail = asString(payload.toEmail, "");
    const subject = asString(payload.subject, "");
    const sentAt = asString(payload.sentAt, "");
    const parsedPlan = useMemo(() => parseTravelPlan(planMarkdown), [planMarkdown]);

    const isEmailResult = type === "travel_email_result";

    return (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/90">
                    {isEmailResult ? <Mail className="h-4 w-4 text-sky-300" /> : <PlaneTakeoff className="h-4 w-4 text-emerald-300" />}
                    {isEmailResult ? "Travel Plan Email" : "Travel Plan"}
                </div>
                {threadId ? (
                    <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/60">
                        Thread: {threadId}
                    </span>
                ) : null}
            </div>

            {summary ? (
                <p className="mb-2 text-xs text-white/75">{summary}</p>
            ) : null}

            {!isEmailResult && planMarkdown ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/55">Travelers</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
                                <Users className="h-3.5 w-3.5 text-emerald-300" />
                                {parsedPlan.travelers}
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/55">Budget</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
                                <IndianRupee className="h-3.5 w-3.5 text-yellow-300" />
                                {parsedPlan.budget}
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/55">Trip Dates</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
                                <CalendarDays className="h-3.5 w-3.5 text-sky-300" />
                                {parsedPlan.tripDates}
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-white/55">Estimated Total</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
                                <IndianRupee className="h-3.5 w-3.5 text-emerald-300" />
                                {parsedPlan.estimatedTotal}
                            </p>
                        </div>
                    </div>

                    {parsedPlan.bookingLinks.length > 0 ? (
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                            <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
                                <Link2 className="h-3.5 w-3.5" />
                                Booking Links
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {parsedPlan.bookingLinks.map((item) => (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md border border-cyan-400/25 bg-black/30 px-2.5 py-1 text-xs text-cyan-100 hover:border-cyan-300/40 hover:bg-black/45"
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="custom-scrollbar max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                        {parsedPlan.sections.map((section, index) => (
                            <div key={`${section.heading}-${index}`} className="rounded-lg border border-white/10 bg-black/25 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">{section.heading}</p>
                                <TravelMarkdown content={section.content} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {isEmailResult ? (
                <div className="grid gap-2 text-xs text-white/85">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-white/60">Recipient:</span> {toEmail}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-white/60">Subject:</span> {subject}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <span className="text-white/60">Sent At:</span> {sentAt}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

