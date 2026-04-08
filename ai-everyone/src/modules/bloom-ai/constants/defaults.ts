import type {
    BloomContextSource,
    BloomReminderPriority,
    BloomSection,
    BloomSettings,
} from "@/modules/bloom-ai/types";
import { DEFAULT_BLOOM_MODEL } from "@/modules/bloom-ai/constants/models";

export const DEFAULT_BLOOM_SETTINGS: BloomSettings = {
    modelId: DEFAULT_BLOOM_MODEL,
    dataAccess: {
        notes: true,
        habits: true,
        journal: true,
    },
};

export const BLOOM_SECTIONS: Array<{
    id: BloomSection;
    label: string;
}> = [
    { id: "notes", label: "Notes" },
    { id: "habits", label: "Habit Tracker" },
    { id: "journal", label: "Journal" },
    { id: "agent", label: "AI Agent" },
    { id: "labels", label: "My Labels" },
];

export const BLOOM_CHAT_SUGGESTIONS = ["Notes", "Habits", "Journal"];

export const BLOOM_PERMISSION_LABELS: Record<BloomContextSource, string> = {
    notes: "Notes",
    habits: "Habit Tracker",
    journal: "Journal Entries",
};

export const BLOOM_HABIT_COLORS = [
    "#B4FFC9",
    "#86F6C5",
    "#9FD2FF",
    "#FFCF8B",
    "#F8A8D8",
];

export const REMINDER_PRIORITY_STYLES: Record<BloomReminderPriority, string> = {
    normal: "border-emerald-400/20 bg-emerald-400/8 text-emerald-100",
    high: "border-rose-400/25 bg-rose-400/10 text-rose-100",
};
