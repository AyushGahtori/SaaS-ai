/**
 * Memory Repository (Server-side, Admin SDK only)
 *
 * All Firestore reads and writes for the memory system go through here.
 * Uses the Firebase Admin SDK, so this file must only be imported in
 * server components, API routes, or server actions.
 *
 * Paths:
 *   users/{uid}/memories/{memoryId}
 *   users/{uid}/persona/main
 *   users/{uid}/memorySettings/main
 */

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
    MemoryItem,
    PersonaSummary,
    MemorySettings,
    MemoryType,
} from "@/lib/memory/types";
import {
    TYPE_PRIORITY,
    GLOBAL_MAX_MEMORIES,
    TEMP_MEMORY_TTL_DAYS,
} from "@/lib/memory/types";

// ---------------------------------------------------------------------------
// Collection references
// ---------------------------------------------------------------------------

const memoriesCol = (uid: string) =>
    adminDb.collection("users").doc(uid).collection("memories");

const personaDoc = (uid: string) =>
    adminDb.collection("users").doc(uid).collection("persona").doc("main");

const settingsDoc = (uid: string) =>
    adminDb.collection("users").doc(uid).collection("memorySettings").doc("main");

const userDoc = (uid: string) =>
    adminDb.collection("users").doc(uid);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISO(val: unknown): string {
    if (val instanceof Timestamp) return val.toDate().toISOString();
    if (typeof val === "string") return val;
    return new Date().toISOString();
}

function docToMemoryItem(id: string, data: FirebaseFirestore.DocumentData): MemoryItem {
    return {
        id,
        type: data.type,
        key: data.key,
        value: data.value,
        scope: data.scope,
        confidence: data.confidence ?? 0.5,
        source: data.source,
        status: data.status,
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
        expiresAt: data.expiresAt ? toISO(data.expiresAt) : null,
        sourceChatId: data.sourceChatId ?? null,
        sourceMessageId: data.sourceMessageId ?? null,
    };
}

// ---------------------------------------------------------------------------
// Memory CRUD
// ---------------------------------------------------------------------------

/**
 * Save a new memory item. Returns the generated document ID.
 * Does NOT perform deduplication — call deduper first.
 */
export async function saveMemory(uid: string, item: Omit<MemoryItem, "id">): Promise<string> {
    const now = FieldValue.serverTimestamp();
    const expiresAt = item.scope === "temporary"
        ? new Date(Date.now() + TEMP_MEMORY_TTL_DAYS * 24 * 60 * 60 * 1000)
        : null;

    const ref = await memoriesCol(uid).add({
        ...item,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    });

    console.log(`[MemoryRepo] saved memory id=${ref.id} key=${item.key} value=${item.value}`);
    return ref.id;
}

/**
 * Update a memory document's fields.
 */
export async function updateMemory(
    uid: string,
    memoryId: string,
    fields: Partial<Omit<MemoryItem, "id" | "createdAt">>
): Promise<void> {
    await memoriesCol(uid).doc(memoryId).update({
        ...fields,
        updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Mark a memory as superseded (old fact replaced by new evidence).
 */
export async function markSuperseded(uid: string, memoryId: string): Promise<void> {
    await updateMemory(uid, memoryId, { status: "superseded" });
    console.log(`[MemoryRepo] marked superseded id=${memoryId}`);
}

/**
 * Soft-delete a memory (user-initiated).
 */
export async function deleteMemory(uid: string, memoryId: string): Promise<void> {
    await updateMemory(uid, memoryId, { status: "deleted" });
}

/**
 * Fetch all active memories for a user.
 */
export async function getActiveMemories(uid: string): Promise<MemoryItem[]> {
    const snap = await memoriesCol(uid)
        .where("status", "==", "active")
        .get();

    const items = snap.docs.map((d) => docToMemoryItem(d.id, d.data()));
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Fetch a single memory by ID.
 */
export async function getMemoryById(uid: string, memoryId: string): Promise<MemoryItem | null> {
    const snap = await memoriesCol(uid).doc(memoryId).get();
    if (!snap.exists) return null;
    return docToMemoryItem(snap.id, snap.data()!);
}

/**
 * Find an active memory by key (returns null if not found).
 */
export async function getActiveMemoryByKey(uid: string, key: string): Promise<MemoryItem | null> {
    const snap = await memoriesCol(uid)
        .where("status", "==", "active")
        .where("key", "==", key)
        .limit(1)
        .get();

    if (snap.empty) return null;
    const d = snap.docs[0];
    return docToMemoryItem(d.id, d.data());
}

// ---------------------------------------------------------------------------
// Policy enforcement
// ---------------------------------------------------------------------------

/**
 * Scan for expired temporary memories and mark them as expired.
 * Call this asynchronously after saving new memories.
 */
export async function applyExpiryPolicy(uid: string): Promise<void> {
    const now = Timestamp.now();
    const snap = await memoriesCol(uid)
        .where("status", "==", "active")
        .where("scope", "==", "temporary")
        .get();

    const batch = adminDb.batch();
    let count = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
            batch.update(doc.ref, {
                status: "expired",
                updatedAt: FieldValue.serverTimestamp(),
            });
            count++;
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`[MemoryRepo] expired ${count} memories for uid=${uid}`);
    }
}

/**
 * Enforce the global memory cap.
 * If active memories exceed GLOBAL_MAX_MEMORIES, delete the lowest priority / confidence ones.
 */
export async function enforceCapPolicy(uid: string): Promise<void> {
    const memories = await getActiveMemories(uid);

    if (memories.length <= GLOBAL_MAX_MEMORIES) return;

    // Sort by priority descending (low priority number = keep), then confidence descending
    const sorted = [...memories].sort((a, b) => {
        const pa = TYPE_PRIORITY[a.type as MemoryType] ?? 99;
        const pb = TYPE_PRIORITY[b.type as MemoryType] ?? 99;
        if (pa !== pb) return pb - pa; // higher priority number → evict first
        return a.confidence - b.confidence; // lower confidence → evict first
    });

    const toEvict = sorted.slice(0, memories.length - GLOBAL_MAX_MEMORIES);
    const batch = adminDb.batch();

    for (const m of toEvict) {
        if (m.id) {
            batch.update(memoriesCol(uid).doc(m.id), {
                status: "deleted",
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    }

    await batch.commit();
    console.log(`[MemoryRepo] evicted ${toEvict.length} memories for uid=${uid}`);
}

// ---------------------------------------------------------------------------
// Persona document
// ---------------------------------------------------------------------------

export async function getPersona(uid: string): Promise<PersonaSummary | null> {
    const snap = await personaDoc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
        summary: data.summary ?? "",
        updatedAt: toISO(data.updatedAt),
        topFacts: data.topFacts ?? [],
        version: data.version ?? 0,
        generatedFrom: data.generatedFrom ?? [],
        role: data.role,
        current_focus: data.current_focus,
        answer_style: data.answer_style,
    };
}

export async function savePersona(uid: string, persona: Omit<PersonaSummary, "updatedAt">): Promise<void> {
    await personaDoc(uid).set({
        ...persona,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

// ---------------------------------------------------------------------------
// User doc — onboarding flag
// ---------------------------------------------------------------------------

export async function markOnboardingComplete(uid: string): Promise<void> {
    await userDoc(uid).update({ onboardingComplete: true });
}

// ---------------------------------------------------------------------------
// Memory Settings
// ---------------------------------------------------------------------------

export async function getMemorySettings(uid: string): Promise<MemorySettings> {
    const snap = await settingsDoc(uid).get();
    if (!snap.exists) {
        return { maxTotalMemories: GLOBAL_MAX_MEMORIES, tempMemoryTTLDays: TEMP_MEMORY_TTL_DAYS, requireConfirmation: false };
    }
    const data = snap.data()!;
    return {
        maxTotalMemories: data.maxTotalMemories ?? GLOBAL_MAX_MEMORIES,
        tempMemoryTTLDays: data.tempMemoryTTLDays ?? TEMP_MEMORY_TTL_DAYS,
        requireConfirmation: data.requireConfirmation ?? false,
    };
}

/**
 * Seed predefined skeleton documents for a brand-new user.
 * Called in firebaseAuth.ts on first sign-in.
 * Uses merge:true so it won't overwrite if already seeded.
 */
export async function seedNewUserMemoryDocs(uid: string): Promise<void> {
    const batch = adminDb.batch();

    // persona/main skeleton
    batch.set(personaDoc(uid), {
        summary: "",
        updatedAt: FieldValue.serverTimestamp(),
        topFacts: [],
        version: 0,
        generatedFrom: [],
        role: null,
        current_focus: null,
        answer_style: null,
    }, { merge: true });

    // memorySettings/main defaults
    batch.set(settingsDoc(uid), {
        maxTotalMemories: GLOBAL_MAX_MEMORIES,
        tempMemoryTTLDays: TEMP_MEMORY_TTL_DAYS,
        requireConfirmation: false,
    }, { merge: true });

    await batch.commit();
    console.log(`[MemoryRepo] seeded skeleton docs for uid=${uid}`);
}
