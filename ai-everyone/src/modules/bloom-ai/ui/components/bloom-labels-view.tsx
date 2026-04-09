"use client";

import { useMemo, useState } from "react";
import { deriveLabels } from "@/modules/bloom-ai/lib/shared";
import type { BloomNote } from "@/modules/bloom-ai/types";

interface BloomLabelsViewProps {
    notes: BloomNote[];
}

export function BloomLabelsView({ notes }: BloomLabelsViewProps) {
    const labels = useMemo(
        () => deriveLabels(notes.filter((note) => note.status === "active")),
        [notes]
    );
    const [activeLabel, setActiveLabel] = useState<string | null>(labels[0]?.label ?? null);

    const matchingNotes = notes.filter(
        (note) => note.status === "active" && (!activeLabel || note.labels.includes(activeLabel))
    );

    return (
        <div className="custom-scrollbar h-full min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-[30px] border border-white/10 bg-[#1d1a19] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">My Labels</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Organize Your Knowledge</h3>
                    <div className="mt-5 flex flex-wrap gap-2">
                        {labels.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/45">
                                Add labels to notes and they will show up here.
                            </div>
                        ) : null}
                        {labels.map((label) => (
                            <button
                                key={label.label}
                                type="button"
                                onClick={() => setActiveLabel(label.label)}
                                className={`rounded-full border px-4 py-2 text-sm ${
                                    activeLabel === label.label
                                        ? "border-[#8FE7B5]/40 bg-[#213126] text-white"
                                        : "border-white/10 bg-black/30 text-white/70"
                                }`}
                            >
                                {label.label} <span className="text-white/35">({label.count})</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-[#171514] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Filtered Notes</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                        {activeLabel ? `${activeLabel} Notes` : "All Labeled Notes"}
                    </h3>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {matchingNotes.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                                No active notes match this label yet.
                            </div>
                        ) : null}
                        {matchingNotes.map((note) => (
                            <div
                                key={note.id}
                                className="rounded-[24px] border border-white/10 bg-black/30 p-4 text-white"
                            >
                                <div className="flex flex-wrap gap-2">
                                    {note.labels.map((label) => (
                                        <span
                                            key={`${note.id}-${label}`}
                                            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55"
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-4 text-lg font-medium">{note.title}</p>
                                <p className="mt-2 line-clamp-4 text-sm text-white/55">{note.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
