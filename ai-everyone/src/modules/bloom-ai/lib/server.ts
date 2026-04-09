import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_BLOOM_SETTINGS } from "@/modules/bloom-ai/constants/defaults";
import { DEFAULT_BLOOM_MODEL } from "@/modules/bloom-ai/constants/models";
import type {
    BloomContextSource,
    BloomConversation,
    BloomHabit,
    BloomJournalEntry,
    BloomMessage,
    BloomNote,
    BloomReminder,
    BloomSettings,
    BloomWorkspaceSnapshot,
} from "@/modules/bloom-ai/types";

const USER_COLLECTION = "users";
const CHAT_COLLECTION = "bloomAIChats";
const MESSAGE_COLLECTION = "messages";
const NOTE_COLLECTION = "bloomAINotes";
const HABIT_COLLECTION = "bloomAIHabits";
const JOURNAL_COLLECTION = "bloomAIJournalEntries";
const SETTINGS_COLLECTION = "bloomAISettings";
const SETTINGS_DOC = "default";
const TODO_COLLECTION = "todos";

function userRef(uid: string) {
    return adminDb.collection(USER_COLLECTION).doc(uid);
}

function serializeTimestamp(value: unknown): string {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value === "string" && value.trim()) return value;
    return new Date().toISOString();
}

function serializeSettings(data: Record<string, unknown> | undefined): BloomSettings {
    const nextDataAccess = (data?.dataAccess ?? {}) as Partial<Record<BloomContextSource, boolean>>;

    return {
        modelId:
            typeof data?.modelId === "string"
                ? (data.modelId as BloomSettings["modelId"])
                : DEFAULT_BLOOM_MODEL,
        dataAccess: {
            notes: nextDataAccess.notes ?? true,
            habits: nextDataAccess.habits ?? true,
            journal: nextDataAccess.journal ?? true,
        },
    };
}

function serializeMessage(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): BloomMessage {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        role: data.role === "assistant" ? "assistant" : "user",
        content: String(data.content || ""),
        createdAt: serializeTimestamp(data.createdAt),
    };
}

function serializeConversation(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
    messages: BloomMessage[]
): BloomConversation {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        title: String(data.title || "New Chat"),
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        lastMessagePreview: String(data.lastMessagePreview || ""),
        modelId:
            typeof data.modelId === "string"
                ? (data.modelId as BloomConversation["modelId"])
                : DEFAULT_BLOOM_MODEL,
        isPinned: Boolean(data.isPinned),
        isArchived: Boolean(data.isArchived),
        messages,
    };
}

function serializeReminder(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): BloomReminder {
    const data = snapshot.data() || {};
    const rawDate =
        typeof data.scheduledFor === "string" && data.scheduledFor.trim()
            ? String(data.scheduledFor)
            : typeof data.datetime === "string" && data.datetime.trim()
              ? String(data.datetime).replace(" ", "T")
              : "";

    return {
        id: snapshot.id,
        title: String(data.title || ""),
        details: String(data.details || ""),
        scheduledFor: rawDate,
        priority: data.priority === "high" ? "high" : "normal",
        status: data.status === "done" ? "done" : "pending",
        createdAt: serializeTimestamp(data.createdAt),
        completedAt: data.completedAt ? serializeTimestamp(data.completedAt) : null,
    };
}

function reminderDocRef(reminderId: string) {
    return adminDb.collection(TODO_COLLECTION).doc(reminderId);
}

function toTodoReminderDatetime(value: string | null | undefined) {
    const normalized = String(value || "").trim();
    return normalized ? normalized.replace("T", " ") : "";
}

function serializeNote(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): BloomNote {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        title: String(data.title || "Untitled note"),
        content: String(data.content || ""),
        labels: Array.isArray(data.labels) ? data.labels.map((item) => String(item)).filter(Boolean) : [],
        status:
            data.status === "archived" || data.status === "deleted" ? data.status : "active",
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
    };
}

function serializeHabit(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): BloomHabit {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        name: String(data.name || "New habit"),
        category: String(data.category || "General"),
        color: String(data.color || "#B4FFC9"),
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        completedDates: Array.isArray(data.completedDates)
            ? data.completedDates.map((item) => String(item))
            : [],
    };
}

function serializeJournalEntry(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): BloomJournalEntry {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        title: String(data.title || "Journal entry"),
        content: String(data.content || ""),
        mood:
            data.mood === "energized" ||
            data.mood === "calm" ||
            data.mood === "focused"
                ? data.mood
                : "reflective",
        entryDate: String(data.entryDate || serializeTimestamp(data.createdAt)),
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
    };
}

async function listConversationMessages(uid: string, conversationId: string): Promise<BloomMessage[]> {
    const snapshot = await userRef(uid)
        .collection(CHAT_COLLECTION)
        .doc(conversationId)
        .collection(MESSAGE_COLLECTION)
        .orderBy("createdAt", "asc")
        .get();

    return snapshot.docs.map(serializeMessage);
}

export async function getBloomSettings(uid: string): Promise<BloomSettings> {
    const snapshot = await userRef(uid).collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
    if (!snapshot.exists) {
        await userRef(uid)
            .collection(SETTINGS_COLLECTION)
            .doc(SETTINGS_DOC)
            .set({
                ...DEFAULT_BLOOM_SETTINGS,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        return DEFAULT_BLOOM_SETTINGS;
    }

    return serializeSettings(snapshot.data() as Record<string, unknown>);
}

export async function listBloomConversations(uid: string): Promise<BloomConversation[]> {
    const snapshot = await userRef(uid)
        .collection(CHAT_COLLECTION)
        .orderBy("updatedAt", "desc")
        .limit(48)
        .get();

    const conversations = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
            const messages = await listConversationMessages(uid, docSnapshot.id);
            return serializeConversation(docSnapshot, messages);
        })
    );

    return conversations.sort((left, right) => {
        if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
        return right.updatedAt.localeCompare(left.updatedAt);
    }).slice(0, 24);
}

export async function listBloomReminders(uid: string): Promise<BloomReminder[]> {
    const snapshot = await adminDb.collection(TODO_COLLECTION).where("userId", "==", uid).get();
    return snapshot.docs
        .map(serializeReminder)
        .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
}

export async function listBloomNotes(uid: string): Promise<BloomNote[]> {
    const snapshot = await userRef(uid).collection(NOTE_COLLECTION).orderBy("updatedAt", "desc").get();
    return snapshot.docs.map(serializeNote);
}

export async function listBloomHabits(uid: string): Promise<BloomHabit[]> {
    const snapshot = await userRef(uid).collection(HABIT_COLLECTION).orderBy("updatedAt", "desc").get();
    return snapshot.docs.map(serializeHabit);
}

export async function listBloomJournalEntries(uid: string): Promise<BloomJournalEntry[]> {
    const snapshot = await userRef(uid)
        .collection(JOURNAL_COLLECTION)
        .orderBy("entryDate", "desc")
        .limit(120)
        .get();
    return snapshot.docs.map(serializeJournalEntry);
}

export async function getBloomWorkspaceSnapshot(uid: string): Promise<BloomWorkspaceSnapshot> {
    const [conversations, reminders, notes, habits, journalEntries, settings] = await Promise.all([
        listBloomConversations(uid),
        listBloomReminders(uid),
        listBloomNotes(uid),
        listBloomHabits(uid),
        listBloomJournalEntries(uid),
        getBloomSettings(uid),
    ]);

    return {
        conversations,
        reminders,
        notes,
        habits,
        journalEntries,
        settings,
    };
}

export async function createConversation(uid: string, title = "New Chat") {
    const docRef = userRef(uid).collection(CHAT_COLLECTION).doc();
    await docRef.set({
        title,
        lastMessagePreview: "",
        modelId: DEFAULT_BLOOM_MODEL,
        isPinned: false,
        isArchived: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    const created = await docRef.get();
    return serializeConversation(created, []);
}

export async function upsertConversationMetadata(
    uid: string,
    conversationId: string,
    updates: Partial<{
        title: string;
        isPinned: boolean;
        isArchived: boolean;
        lastMessagePreview: string;
        modelId: BloomSettings["modelId"];
    }>
): Promise<BloomConversation> {
    const docRef = userRef(uid).collection(CHAT_COLLECTION).doc(conversationId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        throw new Error("Conversation not found.");
    }

    await docRef.set(
        {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    const updated = await docRef.get();
    const messages = await listConversationMessages(uid, conversationId);
    return serializeConversation(updated, messages);
}

export async function deleteConversation(uid: string, conversationId: string): Promise<void> {
    const docRef = userRef(uid).collection(CHAT_COLLECTION).doc(conversationId);
    const messages = await docRef.collection(MESSAGE_COLLECTION).get();
    if (!messages.empty) {
        const batch = adminDb.batch();
        messages.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
        await batch.commit();
    }
    await docRef.delete();
}

export async function appendConversationMessages(
    uid: string,
    conversationId: string,
    payload: Array<{ role: BloomMessage["role"]; content: string }>
): Promise<BloomConversation> {
    const docRef = userRef(uid).collection(CHAT_COLLECTION).doc(conversationId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        throw new Error("Conversation not found.");
    }

    const batch = adminDb.batch();
    payload.forEach((message) => {
        const messageRef = docRef.collection(MESSAGE_COLLECTION).doc();
        batch.set(messageRef, {
            role: message.role,
            content: message.content,
            createdAt: FieldValue.serverTimestamp(),
        });
    });

    batch.set(
        docRef,
        {
            lastMessagePreview: payload[payload.length - 1]?.content.slice(0, 120) ?? "",
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    await batch.commit();

    const updated = await docRef.get();
    const messages = await listConversationMessages(uid, conversationId);
    return serializeConversation(updated, messages);
}

export async function loadConversationForPrompt(uid: string, conversationId: string) {
    const docRef = userRef(uid).collection(CHAT_COLLECTION).doc(conversationId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        throw new Error("Conversation not found.");
    }

    const messages = await listConversationMessages(uid, conversationId);
    return {
        conversation: serializeConversation(snapshot, messages),
        messages,
    };
}

export async function createReminder(
    uid: string,
    input: Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority">
) {
    const docRef = adminDb.collection(TODO_COLLECTION).doc();
    await docRef.set({
        userId: uid,
        title: input.title,
        details: input.details,
        scheduledFor: input.scheduledFor,
        datetime: toTodoReminderDatetime(input.scheduledFor),
        priority: input.priority,
        status: "pending",
        completedAt: null,
        createdAt: FieldValue.serverTimestamp(),
    });
    const created = await docRef.get();
    return serializeReminder(created);
}

export async function updateReminder(
    uid: string,
    reminderId: string,
    updates: Partial<
        Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority" | "status">
    >
) {
    const docRef = reminderDocRef(reminderId);
    const snapshot = await docRef.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new Error("Reminder not found.");

    await docRef.set(
        {
            ...updates,
            ...(typeof updates.scheduledFor === "string"
                ? { datetime: toTodoReminderDatetime(updates.scheduledFor) }
                : {}),
            completedAt:
                updates.status === "done"
                    ? FieldValue.serverTimestamp()
                    : updates.status === "pending"
                      ? null
                      : undefined,
        },
        { merge: true }
    );

    const updated = await docRef.get();
    return serializeReminder(updated);
}

export async function deleteReminder(uid: string, reminderId: string) {
    const docRef = reminderDocRef(reminderId);
    const snapshot = await docRef.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) {
        throw new Error("Reminder not found.");
    }
    await docRef.delete();
}

export async function createNote(
    uid: string,
    input: Pick<BloomNote, "title" | "content" | "labels">
) {
    const docRef = userRef(uid).collection(NOTE_COLLECTION).doc();
    await docRef.set({
        ...input,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    const created = await docRef.get();
    return serializeNote(created);
}

export async function updateNote(
    uid: string,
    noteId: string,
    updates: Partial<Pick<BloomNote, "title" | "content" | "labels" | "status">>
) {
    const docRef = userRef(uid).collection(NOTE_COLLECTION).doc(noteId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new Error("Note not found.");

    await docRef.set(
        {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    const updated = await docRef.get();
    return serializeNote(updated);
}

export async function deleteNote(uid: string, noteId: string) {
    await userRef(uid).collection(NOTE_COLLECTION).doc(noteId).delete();
}

export async function createHabit(
    uid: string,
    input: Pick<BloomHabit, "name" | "category" | "color">
) {
    const docRef = userRef(uid).collection(HABIT_COLLECTION).doc();
    await docRef.set({
        ...input,
        completedDates: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    const created = await docRef.get();
    return serializeHabit(created);
}

export async function updateHabit(
    uid: string,
    habitId: string,
    updates: Partial<Pick<BloomHabit, "name" | "category" | "color" | "completedDates">>
) {
    const docRef = userRef(uid).collection(HABIT_COLLECTION).doc(habitId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new Error("Habit not found.");

    await docRef.set(
        {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    const updated = await docRef.get();
    return serializeHabit(updated);
}

export async function deleteHabit(uid: string, habitId: string) {
    await userRef(uid).collection(HABIT_COLLECTION).doc(habitId).delete();
}

export async function createJournalEntry(
    uid: string,
    input: Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">
) {
    const docRef = userRef(uid).collection(JOURNAL_COLLECTION).doc();
    await docRef.set({
        ...input,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    const created = await docRef.get();
    return serializeJournalEntry(created);
}

export async function updateJournalEntry(
    uid: string,
    entryId: string,
    updates: Partial<Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">>
) {
    const docRef = userRef(uid).collection(JOURNAL_COLLECTION).doc(entryId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new Error("Journal entry not found.");

    await docRef.set(
        {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    const updated = await docRef.get();
    return serializeJournalEntry(updated);
}

export async function deleteJournalEntry(uid: string, entryId: string) {
    await userRef(uid).collection(JOURNAL_COLLECTION).doc(entryId).delete();
}

export async function updateBloomSettingsDoc(
    uid: string,
    updates: Partial<{
        modelId: BloomSettings["modelId"];
        dataAccess: Partial<Record<BloomContextSource, boolean>>;
    }>
) {
    const current = await getBloomSettings(uid);
    const nextSettings = {
        ...current,
        ...updates,
        dataAccess: {
            ...current.dataAccess,
            ...(updates.dataAccess ?? {}),
        },
    };

    await userRef(uid)
        .collection(SETTINGS_COLLECTION)
        .doc(SETTINGS_DOC)
        .set(
            {
                ...nextSettings,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

    return nextSettings;
}

export async function buildBloomContextSources(
    uid: string,
    settings: BloomSettings
): Promise<Record<BloomContextSource, string[]>> {
    const [notes, habits, journalEntries] = await Promise.all([
        settings.dataAccess.notes ? listBloomNotes(uid) : Promise.resolve([]),
        settings.dataAccess.habits ? listBloomHabits(uid) : Promise.resolve([]),
        settings.dataAccess.journal ? listBloomJournalEntries(uid) : Promise.resolve([]),
    ]);

    return {
        notes: notes
            .filter((note) => note.status === "active")
            .slice(0, 5)
            .map((note) => `${note.title}: ${note.content.slice(0, 180)}`),
        habits: habits.slice(0, 5).map((habit) => {
            const streak = habit.completedDates.slice(-5).join(", ") || "No recent completions";
            return `${habit.name} (${habit.category}) recent check-ins: ${streak}`;
        }),
        journal: journalEntries
            .slice(0, 5)
            .map((entry) => `${entry.title} on ${entry.entryDate}: ${entry.content.slice(0, 180)}`),
    };
}
