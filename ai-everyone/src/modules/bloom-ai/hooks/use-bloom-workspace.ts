"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { fetchBloomWorkspace } from "@/modules/bloom-ai/services/bootstrap-service";
import {
    createBloomConversation,
    deleteBloomConversation,
    sendBloomMessage,
    updateBloomConversation,
} from "@/modules/bloom-ai/services/chat-service";
import {
    createBloomReminder,
    deleteBloomReminder,
    updateBloomReminder,
} from "@/modules/bloom-ai/services/reminders-service";
import { createBloomNote, deleteBloomNote, updateBloomNote } from "@/modules/bloom-ai/services/notes-service";
import {
    createBloomHabit,
    deleteBloomHabit,
    updateBloomHabit,
} from "@/modules/bloom-ai/services/habits-service";
import {
    createBloomJournalEntry,
    deleteBloomJournalEntry,
    updateBloomJournalEntry,
} from "@/modules/bloom-ai/services/journal-service";
import { updateBloomSettings as saveBloomSettings } from "@/modules/bloom-ai/services/settings-service";
import type {
    BloomConversation,
    BloomHabit,
    BloomJournalEntry,
    BloomNote,
    BloomReminder,
    BloomSection,
    BloomSettings,
    BloomWorkspaceSnapshot,
} from "@/modules/bloom-ai/types";

function replaceById<T extends { id: string }>(items: T[], nextItem: T) {
    const existing = items.some((item) => item.id === nextItem.id);
    if (!existing) return [nextItem, ...items];
    return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function removeById<T extends { id: string }>(items: T[], id: string) {
    return items.filter((item) => item.id !== id);
}

export function useBloomWorkspace() {
    const [snapshot, setSnapshot] = useState<BloomWorkspaceSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<BloomSection>("agent");
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isRemindersOpen, setIsRemindersOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const loadWorkspace = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const nextSnapshot = await fetchBloomWorkspace();
            startTransition(() => {
                setSnapshot(nextSnapshot);
                setActiveConversationId((current) => {
                    if (current && nextSnapshot.conversations.some((item) => item.id === current)) {
                        return current;
                    }
                    const firstActiveConversation = nextSnapshot.conversations.find(
                        (item) => !item.isArchived
                    );
                    return firstActiveConversation?.id ?? null;
                });
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load Bloom AI.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadWorkspace();
    }, [loadWorkspace]);

    const conversations = useMemo(
        () => snapshot?.conversations.filter((item) => !item.isArchived) ?? [],
        [snapshot?.conversations]
    );

    const activeConversation =
        conversations.find((item) => item.id === activeConversationId) ??
        conversations[0] ??
        null;

    const applyConversation = useCallback((conversation: BloomConversation) => {
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                conversations: replaceById(current.conversations, conversation).sort((left, right) => {
                    if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
                    return right.updatedAt.localeCompare(left.updatedAt);
                }),
            };
        });
        setActiveConversationId(conversation.id);
    }, []);

    const createConversation = useCallback(async () => {
        const response = await createBloomConversation();
        applyConversation(response.conversation);
        setActiveSection("agent");
        return response.conversation;
    }, [applyConversation]);

    const sendMessage = useCallback(
        async (message: string) => {
            const trimmed = message.trim();
            if (!trimmed) return;

            setIsSending(true);
            setError(null);
            try {
                const currentConversation = activeConversation ?? (await createConversation());
                const response = await sendBloomMessage({
                    conversationId: currentConversation.id,
                    message: trimmed,
                    modelId: snapshot?.settings.modelId,
                });
                applyConversation(response.conversation);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Bloom AI could not reply.");
            } finally {
                setIsSending(false);
            }
        },
        [activeConversation, applyConversation, createConversation, snapshot?.settings.modelId]
    );

    const patchConversation = useCallback(
        async (input: Parameters<typeof updateBloomConversation>[0]) => {
            const response = await updateBloomConversation(input);
            applyConversation(response.conversation);
        },
        [applyConversation]
    );

    const removeConversation = useCallback(async (conversationId: string) => {
        await deleteBloomConversation(conversationId);
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                conversations: removeById(current.conversations, conversationId),
            };
        });
        setActiveConversationId((current) => (current === conversationId ? null : current));
    }, []);

    const upsertReminder = useCallback((item: BloomReminder) => {
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                reminders: replaceById(current.reminders, item).sort((left, right) =>
                    left.scheduledFor.localeCompare(right.scheduledFor)
                ),
            };
        });
    }, []);

    const addReminder = useCallback(
        async (input: Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority">) => {
            const response = await createBloomReminder(input);
            upsertReminder(response.item);
        },
        [upsertReminder]
    );

    const patchReminder = useCallback(
        async (
            input: Partial<Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority" | "status">> & {
                reminderId: string;
            }
        ) => {
            const response = await updateBloomReminder(input);
            upsertReminder(response.item);
        },
        [upsertReminder]
    );

    const removeReminder = useCallback(async (reminderId: string) => {
        await deleteBloomReminder(reminderId);
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                reminders: removeById(current.reminders, reminderId),
            };
        });
    }, []);

    const upsertNote = useCallback((item: BloomNote) => {
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                notes: replaceById(current.notes, item).sort((left, right) =>
                    right.updatedAt.localeCompare(left.updatedAt)
                ),
            };
        });
    }, []);

    const addNote = useCallback(async (input: Pick<BloomNote, "title" | "content" | "labels">) => {
        const response = await createBloomNote(input);
        upsertNote(response.item);
        return response.item;
    }, [upsertNote]);

    const patchNote = useCallback(
        async (
            input: Partial<Pick<BloomNote, "title" | "content" | "labels" | "status">> & {
                noteId: string;
            }
        ) => {
            const response = await updateBloomNote(input);
            upsertNote(response.item);
            return response.item;
        },
        [upsertNote]
    );

    const removeNote = useCallback(async (noteId: string) => {
        await deleteBloomNote(noteId);
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                notes: removeById(current.notes, noteId),
            };
        });
    }, []);

    const upsertHabit = useCallback((item: BloomHabit) => {
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                habits: replaceById(current.habits, item).sort((left, right) =>
                    right.updatedAt.localeCompare(left.updatedAt)
                ),
            };
        });
    }, []);

    const addHabit = useCallback(
        async (input: Pick<BloomHabit, "name" | "category" | "color">) => {
            const response = await createBloomHabit(input);
            upsertHabit(response.item);
            return response.item;
        },
        [upsertHabit]
    );

    const patchHabit = useCallback(
        async (
            input: Partial<Pick<BloomHabit, "name" | "category" | "color" | "completedDates">> & {
                habitId: string;
            }
        ) => {
            const response = await updateBloomHabit(input);
            upsertHabit(response.item);
            return response.item;
        },
        [upsertHabit]
    );

    const removeHabit = useCallback(async (habitId: string) => {
        await deleteBloomHabit(habitId);
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                habits: removeById(current.habits, habitId),
            };
        });
    }, []);

    const upsertJournalEntry = useCallback((item: BloomJournalEntry) => {
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                journalEntries: replaceById(current.journalEntries, item).sort((left, right) =>
                    right.entryDate.localeCompare(left.entryDate)
                ),
            };
        });
    }, []);

    const addJournalEntry = useCallback(
        async (input: Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">) => {
            const response = await createBloomJournalEntry(input);
            upsertJournalEntry(response.item);
            return response.item;
        },
        [upsertJournalEntry]
    );

    const patchJournalEntry = useCallback(
        async (
            input: Partial<Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">> & {
                entryId: string;
            }
        ) => {
            const response = await updateBloomJournalEntry(input);
            upsertJournalEntry(response.item);
            return response.item;
        },
        [upsertJournalEntry]
    );

    const removeJournalEntry = useCallback(async (entryId: string) => {
        await deleteBloomJournalEntry(entryId);
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                journalEntries: removeById(current.journalEntries, entryId),
            };
        });
    }, []);

    const updateSettings = useCallback(async (input: {
        modelId?: BloomSettings["modelId"];
        dataAccess?: Partial<BloomSettings["dataAccess"]>;
    }) => {
        const response = await saveBloomSettings(input);
        setSnapshot((current) => {
            if (!current) return current;
            return {
                ...current,
                settings: response.settings,
            };
        });
    }, []);

    return {
        snapshot,
        conversations,
        activeConversation,
        activeSection,
        setActiveSection,
        activeConversationId,
        setActiveConversationId,
        isLoading,
        isSending,
        error,
        setError,
        isRemindersOpen,
        setIsRemindersOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        reload: loadWorkspace,
        createConversation,
        sendMessage,
        patchConversation,
        removeConversation,
        addReminder,
        patchReminder,
        removeReminder,
        addNote,
        patchNote,
        removeNote,
        addHabit,
        patchHabit,
        removeHabit,
        addJournalEntry,
        patchJournalEntry,
        removeJournalEntry,
        updateSettings,
    };
}
