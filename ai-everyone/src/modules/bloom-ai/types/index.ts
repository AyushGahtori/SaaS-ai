export type BloomSection =
    | "notes"
    | "habits"
    | "journal"
    | "archive"
    | "deleted"
    | "agent"
    | "labels";

export type BloomModelId =
    | "gemini-2.5-flash"
    | "gemini-2.5-pro"
    | "gemini-2.5-flash-lite";

export type BloomNoteStatus = "active" | "archived" | "deleted";
export type BloomReminderStatus = "pending" | "done";
export type BloomReminderPriority = "normal" | "high";
export type BloomContextSource = "notes" | "habits" | "journal";

export interface BloomMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
}

export interface BloomConversation {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    lastMessagePreview: string;
    modelId: BloomModelId;
    isPinned: boolean;
    isArchived: boolean;
    messages: BloomMessage[];
}

export interface BloomReminder {
    id: string;
    title: string;
    details: string;
    scheduledFor: string;
    priority: BloomReminderPriority;
    status: BloomReminderStatus;
    createdAt: string;
    completedAt: string | null;
}

export interface BloomNote {
    id: string;
    title: string;
    content: string;
    labels: string[];
    status: BloomNoteStatus;
    createdAt: string;
    updatedAt: string;
}

export interface BloomHabit {
    id: string;
    name: string;
    category: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    completedDates: string[];
}

export interface BloomJournalEntry {
    id: string;
    title: string;
    content: string;
    mood: "reflective" | "energized" | "calm" | "focused";
    entryDate: string;
    createdAt: string;
    updatedAt: string;
}

export interface BloomSettings {
    modelId: BloomModelId;
    dataAccess: Record<BloomContextSource, boolean>;
}

export interface BloomWorkspaceSnapshot {
    conversations: BloomConversation[];
    reminders: BloomReminder[];
    notes: BloomNote[];
    habits: BloomHabit[];
    journalEntries: BloomJournalEntry[];
    settings: BloomSettings;
}

export interface BloomChatResponse {
    conversation: BloomConversation;
}

export interface BloomMutationResponse<T> {
    item: T;
}
