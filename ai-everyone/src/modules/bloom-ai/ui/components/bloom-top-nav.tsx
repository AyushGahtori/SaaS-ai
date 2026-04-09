"use client";

import {
    Archive,
    BookOpenText,
    MessageCircleMore,
    NotebookPen,
    NotepadText,
    Tags,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOOM_SECTIONS } from "@/modules/bloom-ai/constants/defaults";
import { bloomHoverLift } from "@/modules/bloom-ai/animations/transitions";
import type { BloomSection } from "@/modules/bloom-ai/types";

const sectionIcons: Record<BloomSection, typeof NotepadText> = {
    notes: NotepadText,
    habits: NotebookPen,
    journal: BookOpenText,
    archive: Archive,
    deleted: Trash2,
    agent: MessageCircleMore,
    labels: Tags,
};

interface BloomTopNavProps {
    activeSection: BloomSection;
    onChange: (section: BloomSection) => void;
}

export function BloomTopNav({ activeSection, onChange }: BloomTopNavProps) {
    return (
        <div className="custom-scrollbar flex gap-3 overflow-x-auto overflow-y-visible pb-2 pt-1">
            {BLOOM_SECTIONS.map((section) => {
                const Icon = sectionIcons[section.id];
                const active = section.id === activeSection;

                return (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => onChange(section.id)}
                        className={cn(
                            bloomHoverLift,
                            "flex min-w-fit items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium",
                            active
                                ? "border-white/25 bg-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                                : "border-white/5 bg-white/10 text-white/72 hover:border-white/12 hover:bg-white/14"
                        )}
                    >
                        <Icon className="size-4" />
                        <span>{section.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
