import {
    format,
    formatDistanceToNowStrict,
    isToday,
    isTomorrow,
    parseISO,
    subDays,
} from "date-fns";
import type {
    BloomHabit,
    BloomJournalEntry,
    BloomMessage,
    BloomNote,
    BloomReminder,
} from "@/modules/bloom-ai/types";

export function safeDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatBloomDate(value: string | null | undefined): string {
    const date = safeDate(value);
    if (!date) return "No date";
    if (isToday(date)) return `Today, ${format(date, "p")}`;
    if (isTomorrow(date)) return `Tomorrow, ${format(date, "p")}`;
    return format(date, "MMM dd, yyyy p");
}

export function formatBloomShortDate(value: string | null | undefined): string {
    const date = safeDate(value);
    if (!date) return "No date";
    return format(date, "MMM dd, yyyy");
}

export function formatBloomRelativeDate(value: string | null | undefined): string {
    const date = safeDate(value);
    if (!date) return "just now";
    return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function toDateKey(value: string | Date): string {
    const date = typeof value === "string" ? safeDate(value) : value;
    const resolved = date ?? new Date();
    return format(resolved, "yyyy-MM-dd");
}

export function summarizeMessagePreview(messages: BloomMessage[]): string {
    const last = messages[messages.length - 1];
    if (!last) return "New conversation";
    return last.content.trim().slice(0, 92) || "New conversation";
}

export function noteMatchesSearch(note: BloomNote, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const haystack = [note.title, note.content, ...note.labels].join(" ").toLowerCase();
    return haystack.includes(normalized);
}

export function deriveLabels(notes: BloomNote[]): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const note of notes) {
        for (const label of note.labels) {
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
    }

    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function lastSevenDateKeys(): string[] {
    return Array.from({ length: 7 }, (_, index) => toDateKey(subDays(new Date(), 6 - index)));
}

export function buildHabitChartData(habit: BloomHabit | null, days = 30) {
    return Array.from({ length: days }, (_, index) => {
        const date = subDays(new Date(), days - index - 1);
        const key = toDateKey(date);
        const done = habit?.completedDates.includes(key) ? 1 : 0;
        return {
            label: format(date, "MMM d"),
            key,
            completions: done,
        };
    });
}

export function calculateHabitSuccessRate(habit: BloomHabit | null, days = 30): number {
    if (!habit) return 0;
    const keys = new Set(
        Array.from({ length: days }, (_, index) => toDateKey(subDays(new Date(), index)))
    );
    const completed = habit.completedDates.filter((item) => keys.has(item)).length;
    return Math.round((completed / days) * 100);
}

export function buildJournalHeatmap(entries: BloomJournalEntry[]) {
    const counts = new Map<string, number>();
    for (const entry of entries) {
        const key = toDateKey(entry.entryDate);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function sortReminders(reminders: BloomReminder[]) {
    return [...reminders].sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
}
