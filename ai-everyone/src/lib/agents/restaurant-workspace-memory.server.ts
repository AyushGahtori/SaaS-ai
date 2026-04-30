import { adminDb } from "@/lib/firebase-admin";

interface RestaurantMenuItemInput {
    name?: unknown;
    price?: unknown;
    contains?: unknown;
    description?: unknown;
}

export interface RestaurantMenuItem {
    name: string;
    price: number;
    contains: string;
    description: string;
}

export interface RestaurantWorkspaceMemory {
    menu_items: RestaurantMenuItem[];
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

function asNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const cleaned = value.replace(/[^0-9.\-]/g, "").trim();
        if (!cleaned) return 0;
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

export function sanitizeRestaurantMenuItems(input: unknown): RestaurantMenuItem[] {
    const rows = Array.isArray(input) ? (input as RestaurantMenuItemInput[]) : [];
    const normalized: RestaurantMenuItem[] = [];

    for (const row of rows) {
        const name = asString(row?.name);
        if (!name) continue;

        normalized.push({
            name,
            price: Math.max(0, asNumber(row?.price)),
            contains: asString(row?.contains),
            description: asString(row?.description),
        });
    }

    return normalized.slice(0, 500);
}

export function readRestaurantWorkspaceMemoryFromChatRecord(
    chatData: Record<string, unknown>
): RestaurantWorkspaceMemory {
    const memoryRoot = asRecord(chatData.agentWorkspaceMemory);
    const restaurantMemory = asRecord(memoryRoot.restaurantConcierge);
    const menuItems = sanitizeRestaurantMenuItems(restaurantMemory.menuItems);
    const updatedAt = asString(restaurantMemory.updatedAt);

    return {
        menu_items: menuItems,
        updated_at: updatedAt || null,
    };
}

export async function getRestaurantWorkspaceMemory(params: {
    userId: string;
    chatId: string;
}): Promise<RestaurantWorkspaceMemory> {
    const chatRef = adminDb.collection("users").doc(params.userId).collection("chats").doc(params.chatId);
    const snapshot = await chatRef.get();
    if (!snapshot.exists) {
        return {
            menu_items: [],
            updated_at: null,
        };
    }

    return readRestaurantWorkspaceMemoryFromChatRecord(asRecord(snapshot.data()));
}

export async function saveRestaurantWorkspaceMemory(params: {
    userId: string;
    chatId: string;
    menuItems: unknown;
}): Promise<RestaurantWorkspaceMemory> {
    const menuItems = sanitizeRestaurantMenuItems(params.menuItems);
    const updatedAt = new Date().toISOString();
    const chatRef = adminDb.collection("users").doc(params.userId).collection("chats").doc(params.chatId);

    await chatRef.set(
        {
            agentWorkspaceMemory: {
                restaurantConcierge: {
                    menuItems,
                    updatedAt,
                },
            },
        },
        { merge: true }
    );

    return {
        menu_items: menuItems,
        updated_at: updatedAt,
    };
}
