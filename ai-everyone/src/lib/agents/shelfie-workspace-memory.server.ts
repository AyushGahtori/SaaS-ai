import { adminDb } from "@/lib/firebase-admin";

interface ShelfieItemInput {
    name?: unknown;
    quantity?: unknown;
    purchased?: unknown;
    finished?: unknown;
}

interface ShelfieMemoryEntryInput {
    id?: unknown;
    title?: unknown;
    buying_date?: unknown;
    end_date?: unknown;
    items?: unknown;
    notes?: unknown;
}

export interface ShelfieMemoryItem {
    name: string;
    quantity: string;
    purchased: boolean;
    finished: boolean;
}

export interface ShelfieMemoryEntry {
    id: string;
    title: string;
    buying_date: string;
    end_date: string;
    items: ShelfieMemoryItem[];
    notes: string;
    updated_at: string;
}

export interface ShelfieWorkspaceMemory {
    grocery_memory: ShelfieMemoryEntry[];
    updated_at: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown): boolean {
    return value === true || value === "true" || value === 1 || value === "1";
}

function sanitizeItem(input: unknown): ShelfieMemoryItem | null {
    const row = asRecord(input);
    const name = asString(row.name);
    if (!name) return null;
    return {
        name,
        quantity: asString(row.quantity),
        purchased: asBoolean(row.purchased),
        finished: asBoolean(row.finished),
    };
}

function sanitizeEntry(input: unknown): ShelfieMemoryEntry | null {
    const row = asRecord(input);
    const itemsRaw = Array.isArray(row.items) ? row.items : [];
    const items = itemsRaw
        .map((item) => sanitizeItem(item))
        .filter((item): item is ShelfieMemoryItem => Boolean(item));

    const buyingDate = asString(row.buying_date);
    const endDate = asString(row.end_date);
    const id = asString(row.id) || `shelfie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!buyingDate && !endDate && items.length === 0) return null;

    return {
        id,
        title: asString(row.title) || "Grocery cycle",
        buying_date: buyingDate,
        end_date: endDate,
        items,
        notes: asString(row.notes),
        updated_at: new Date().toISOString(),
    };
}

export function sanitizeShelfieMemoryEntries(input: unknown): ShelfieMemoryEntry[] {
    const rows = Array.isArray(input) ? input : [];
    return rows
        .map((row) => sanitizeEntry(row))
        .filter((row): row is ShelfieMemoryEntry => Boolean(row))
        .slice(0, 200);
}

export function readShelfieWorkspaceMemoryFromChatRecord(
    chatData: Record<string, unknown>
): ShelfieWorkspaceMemory {
    const memoryRoot = asRecord(chatData.agentWorkspaceMemory);
    const shelfie = asRecord(memoryRoot.shelfieGrocery);
    const entries = sanitizeShelfieMemoryEntries(shelfie.groceryMemory);
    const updatedAt = asString(shelfie.updatedAt);
    return {
        grocery_memory: entries,
        updated_at: updatedAt || null,
    };
}

export async function getShelfieWorkspaceMemory(params: {
    userId: string;
    chatId: string;
}): Promise<ShelfieWorkspaceMemory> {
    const chatRef = adminDb.collection("users").doc(params.userId).collection("chats").doc(params.chatId);
    const snapshot = await chatRef.get();
    if (!snapshot.exists) return { grocery_memory: [], updated_at: null };
    return readShelfieWorkspaceMemoryFromChatRecord(asRecord(snapshot.data()));
}

export async function saveShelfieWorkspaceMemory(params: {
    userId: string;
    chatId: string;
    groceryMemory: unknown;
}): Promise<ShelfieWorkspaceMemory> {
    const groceryMemory = sanitizeShelfieMemoryEntries(params.groceryMemory);
    const updatedAt = new Date().toISOString();
    const chatRef = adminDb.collection("users").doc(params.userId).collection("chats").doc(params.chatId);
    await chatRef.set(
        {
            agentWorkspaceMemory: {
                shelfieGrocery: {
                    groceryMemory,
                    updatedAt,
                },
            },
        },
        { merge: true }
    );
    return {
        grocery_memory: groceryMemory,
        updated_at: updatedAt,
    };
}
