"use client";

import { useMemo, useState } from "react";
import { Fragment } from "react";
import {
    addDays,
    addWeeks,
    endOfWeek,
    endOfYear,
    format,
    isAfter,
    isBefore,
    startOfWeek,
    startOfYear,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { buildJournalHeatmap, formatBloomShortDate, toDateKey } from "@/modules/bloom-ai/lib/shared";
import type { BloomJournalEntry } from "@/modules/bloom-ai/types";

interface BloomJournalViewProps {
    journalEntries: BloomJournalEntry[];
    onAddEntry: (
        input: Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">
    ) => Promise<BloomJournalEntry>;
    onPatchEntry: (
        input: Partial<Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">> & {
            entryId: string;
        }
    ) => Promise<BloomJournalEntry>;
    onDeleteEntry: (entryId: string) => Promise<void>;
}

const JOURNAL_ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function heatmapColor(count: number) {
    if (count <= 0) return "rgba(255,255,255,0.16)";
    if (count === 1) return "#4fdc76";
    if (count === 2) return "#24f75a";
    return "#13ff49";
}

export function BloomJournalView({
    journalEntries,
    onAddEntry,
    onPatchEntry,
    onDeleteEntry,
}: BloomJournalViewProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [mood, setMood] = useState<BloomJournalEntry["mood"]>("reflective");
    const heatmap = useMemo(() => buildJournalHeatmap(journalEntries), [journalEntries]);

    const yearOptions = useMemo(
        () => [currentYear - 1, currentYear, currentYear + 1],
        [currentYear]
    );

    const heatmapGrid = useMemo(() => {
        const yearStart = startOfYear(new Date(selectedYear, 0, 1));
        const yearEnd = endOfYear(yearStart);
        const gridStart = startOfWeek(yearStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(yearEnd, { weekStartsOn: 1 });
        const seenMonths = new Set<number>();
        const weeks: Array<{
            key: string;
            monthLabel: string;
            days: Array<{ key: string; count: number; inYear: boolean }>;
        }> = [];

        let cursor = gridStart;
        while (!isAfter(cursor, gridEnd)) {
            const days = Array.from({ length: 7 }, (_, index) => {
                const day = addDays(cursor, index);
                const key = toDateKey(day);
                return {
                    key,
                    count: heatmap.get(key) ?? 0,
                    inYear: !isBefore(day, yearStart) && !isAfter(day, yearEnd),
                };
            });

            const monthAnchor = days.find((day) => {
                if (!day.inYear) return false;
                const date = new Date(`${day.key}T00:00:00`);
                const month = date.getMonth();
                if (date.getDate() > 7 || seenMonths.has(month)) {
                    return false;
                }

                seenMonths.add(month);
                return true;
            });

            weeks.push({
                key: toDateKey(cursor),
                monthLabel: monthAnchor ? format(new Date(`${monthAnchor.key}T00:00:00`), "MMM") : "",
                days,
            });

            cursor = addWeeks(cursor, 1);
        }

        return weeks;
    }, [heatmap, selectedYear]);

    const submit = async () => {
        if (!content.trim()) return;
        await onAddEntry({
            title: title.trim() || "Journal entry",
            content: content.trim(),
            mood,
            entryDate: new Date().toISOString(),
        });
        setTitle("");
        setContent("");
        setMood("reflective");
    };

    return (
        <div className="custom-scrollbar h-full min-h-0 overflow-y-auto pr-1">
            <div className="space-y-5 pb-4">
                <div>
                    <p className="text-3xl font-semibold text-white">My Journal</p>
                    <p className="mt-2 text-sm text-white/45">
                        Journaling is a silent conversation with your soul. Each word is a step toward
                        clarity.
                    </p>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-black p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xl font-semibold text-white">Journal Activity</p>
                            <p className="mt-1 text-sm text-white/45">
                                Your meaningful writing activity over the past year.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
                            <label className="flex items-center gap-2 text-sm text-white/70">
                                <span>Year:</span>
                                <select
                                    value={selectedYear}
                                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                                    className="bg-transparent text-sm text-white outline-none"
                                >
                                    {yearOptions.map((year) => (
                                        <option key={year} value={year} className="bg-[#111]">
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 rounded-[24px] border border-white/8 bg-[#0c0c0c] px-5 py-4">
                        <div className="custom-scrollbar overflow-x-auto pb-2">
                            <div
                                className="grid min-w-max items-start gap-x-1.5 gap-y-1.5"
                                style={{
                                    gridTemplateColumns: `40px repeat(${heatmapGrid.length}, minmax(0, 10px))`,
                                }}
                            >
                                <div />
                                {heatmapGrid.map((week) => (
                                    <div
                                        key={`month-${week.key}`}
                                        className="relative h-4"
                                    >
                                        {week.monthLabel ? (
                                            <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] font-medium leading-none text-white/38">
                                                {week.monthLabel}
                                            </span>
                                        ) : null}
                                    </div>
                                ))}

                                {Array.from({ length: 7 }, (_, rowIndex) => {
                                    return (
                                        <Fragment key={`row-${rowIndex}`}>
                                            <div
                                                className="flex h-2.5 items-center pr-2 text-[10px] leading-none text-white/32"
                                            >
                                                {JOURNAL_ROW_LABELS[rowIndex]}
                                            </div>
                                            {heatmapGrid.map((week) => {
                                                const day = week.days[rowIndex];

                                                return (
                                                    <div
                                                        key={`${week.key}-${rowIndex}`}
                                                        title={day ? `${day.key}: ${day.count} entries` : ""}
                                                        className="size-2.5 rounded-[2px]"
                                                        style={{
                                                            backgroundColor:
                                                                day && day.inYear
                                                                    ? heatmapColor(day.count)
                                                                    : "transparent",
                                                        }}
                                                    />
                                                );
                                            })}
                                        </Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-white/40">
                            <span>Less</span>
                            <div className="flex items-center gap-1">
                                {[0, 1, 2, 3].map((count) => (
                                    <span
                                        key={count}
                                        className="size-2.5 rounded-[2px]"
                                        style={{ backgroundColor: heatmapColor(count) }}
                                    />
                                ))}
                            </div>
                            <span>More</span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                    <div className="flex min-h-0 flex-col rounded-[30px] border border-white/10 bg-[#171514] p-5">
                        <p className="text-xl font-semibold text-white">Recent Entries</p>
                        <div className="custom-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
                            <div className="space-y-3">
                                {journalEntries.length === 0 ? (
                                    <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                                        Your journal entries will appear here.
                                    </div>
                                ) : null}

                                {journalEntries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="rounded-[24px] border border-white/10 bg-black/30 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-lg font-medium text-white">{entry.title}</p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/35">
                                                    {formatBloomShortDate(entry.entryDate)} - {entry.mood}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                className="rounded-xl border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                                                onClick={() => void onDeleteEntry(entry.id)}
                                            >
                                                Delete
                                            </Button>
                                        </div>

                                        <textarea
                                            defaultValue={entry.content}
                                            onBlur={(event) =>
                                                void onPatchEntry({
                                                    entryId: entry.id,
                                                    content: event.target.value,
                                                })
                                            }
                                            className="mt-4 h-32 w-full resize-none rounded-2xl border border-white/8 bg-[#0f0f0f] p-4 text-sm text-white outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[30px] border border-white/10 bg-black p-5">
                        <p className="text-xl font-semibold text-white">New Entry</p>
                        <div className="mt-4 space-y-3">
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Entry title"
                                className="w-full rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none"
                            />

                            <div className="flex gap-2">
                                {["reflective", "energized", "calm", "focused"].map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setMood(option as BloomJournalEntry["mood"])}
                                        className={`rounded-full px-3 py-2 text-sm ${
                                            mood === option ? "bg-white text-black" : "bg-white/10 text-white/65"
                                        }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={content}
                                onChange={(event) => setContent(event.target.value)}
                                placeholder="Write what feels true today..."
                                className="h-[250px] w-full resize-none rounded-[24px] border border-white/10 bg-[#0d0d0d] p-4 text-sm text-white outline-none"
                            />

                            <Button
                                onClick={() => void submit()}
                                className="w-full rounded-2xl bg-white text-black hover:bg-white/90"
                            >
                                Save Journal Entry
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
