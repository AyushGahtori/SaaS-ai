"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildJournalHeatmap, formatBloomShortDate, toDateKey } from "@/modules/bloom-ai/lib/shared";
import type { BloomJournalEntry } from "@/modules/bloom-ai/types";

interface BloomJournalViewProps {
    journalEntries: BloomJournalEntry[];
    onAddEntry: (
        input: Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">
    ) => Promise<BloomJournalEntry>;
    onPatchEntry: (
        input: Partial<Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">> & { entryId: string }
    ) => Promise<BloomJournalEntry>;
    onDeleteEntry: (entryId: string) => Promise<void>;
}

export function BloomJournalView({
    journalEntries,
    onAddEntry,
    onPatchEntry,
    onDeleteEntry,
}: BloomJournalViewProps) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [mood, setMood] = useState<BloomJournalEntry["mood"]>("reflective");
    const heatmap = useMemo(() => buildJournalHeatmap(journalEntries), [journalEntries]);
    const heatmapDays = useMemo(
        () => Array.from({ length: 90 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (89 - index));
            const key = toDateKey(date);
            return {
                key,
                count: heatmap.get(key) ?? 0,
            };
        }),
        [heatmap]
    );

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
        <div className="space-y-5">
            <div>
                <p className="text-3xl font-semibold text-white">My Journal</p>
                <p className="mt-2 text-sm text-white/45">
                    Journaling is a silent conversation with your soul. Each word is a step toward clarity.
                </p>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-black p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xl font-semibold text-white">Journal Activity</p>
                        <p className="mt-1 text-sm text-white/45">
                            Your meaningful writing activity over the past three months.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
                        Year: {new Date().getFullYear()}
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1 rounded-[24px] border border-white/8 bg-[#0c0c0c] p-4">
                    {heatmapDays.map((day) => (
                        <div
                            key={day.key}
                            title={`${day.key}: ${day.count} entries`}
                            className="aspect-square rounded-[5px]"
                            style={{
                                backgroundColor:
                                    day.count === 0
                                        ? "rgba(255,255,255,0.12)"
                                        : day.count === 1
                                          ? "#78e19c"
                                          : "#14f848",
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-[30px] border border-white/10 bg-[#171514] p-5">
                    <p className="text-xl font-semibold text-white">Recent Entries</p>
                    <ScrollArea className="mt-4 h-[420px] pr-2">
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
                                            void onPatchEntry({ entryId: entry.id, content: event.target.value })
                                        }
                                        className="mt-4 h-32 w-full resize-none rounded-2xl border border-white/8 bg-[#0f0f0f] p-4 text-sm text-white outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
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
                        <Button onClick={() => void submit()} className="w-full rounded-2xl bg-white text-black hover:bg-white/90">
                            Save Journal Entry
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
