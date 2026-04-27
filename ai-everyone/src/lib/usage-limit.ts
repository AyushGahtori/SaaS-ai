import { adminDb } from "@/lib/firebase-admin";

const DEFAULT_GENERAL_AI_LIMIT = 100;
const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

function parseMonthlyAiLimit(): number {
    const rawLimit = process.env.MAX_AI_REQUESTS_PER_MONTH;
    if (!rawLimit || rawLimit.trim() === "") {
        return DEFAULT_GENERAL_AI_LIMIT;
    }

    const normalized = rawLimit.trim();
    if (!/^-?\d+$/.test(normalized)) {
        console.error(
            `[usage-limit] Invalid MAX_AI_REQUESTS_PER_MONTH="${rawLimit}". Falling back to ${DEFAULT_GENERAL_AI_LIMIT}.`
        );
        return DEFAULT_GENERAL_AI_LIMIT;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) {
        console.error(
            `[usage-limit] Failed to parse MAX_AI_REQUESTS_PER_MONTH="${rawLimit}". Falling back to ${DEFAULT_GENERAL_AI_LIMIT}.`
        );
        return DEFAULT_GENERAL_AI_LIMIT;
    }

    return Math.max(0, parsed);
}

const GENERAL_AI_LIMIT = parseMonthlyAiLimit();

export class UsageLimitError extends Error {
    constructor() {
        super("LIMIT_REACHED");
        this.name = "UsageLimitError";
    }
}

function coerceNonNegativeInt(value: unknown, fallback: number): number {
    const candidate =
        typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number.parseInt(value, 10)
                : Number.NaN;

    if (!Number.isFinite(candidate) || Number.isNaN(candidate)) {
        return fallback;
    }

    return Math.max(0, Math.floor(candidate));
}

function coerceCycleEndDate(value: unknown, now: number): number {
    let candidate: number;
    if (value && typeof value === "object" && "toMillis" in value) {
        const maybeTimestamp = value as { toMillis?: () => number };
        candidate = Number(maybeTimestamp.toMillis?.());
    } else if (typeof value === "number") {
        candidate = value;
    } else if (typeof value === "string") {
        candidate = Number.parseInt(value, 10);
    } else {
        candidate = Number.NaN;
    }

    if (!Number.isFinite(candidate) || Number.isNaN(candidate)) {
        return now + BILLING_CYCLE_MS;
    }

    return Math.max(0, Math.floor(candidate));
}

function normalizeUsage(
    rawData: Record<string, unknown> | undefined,
    now: number
): { aiMessagesUsed: number; cycleEndDate: number } {
    const rawUsage =
        rawData?.usage && typeof rawData.usage === "object"
            ? (rawData.usage as Record<string, unknown>)
            : {};

    return {
        aiMessagesUsed: coerceNonNegativeInt(rawUsage.aiMessagesUsed, 0),
        cycleEndDate: coerceCycleEndDate(rawUsage.cycleEndDate, now),
    };
}

function resetIfExpired(
    usage: { aiMessagesUsed: number; cycleEndDate: number },
    now: number
): { aiMessagesUsed: number; cycleEndDate: number } {
    if (now > usage.cycleEndDate) {
        return {
            aiMessagesUsed: 0,
            cycleEndDate: now + BILLING_CYCLE_MS,
        };
    }
    return usage;
}

function assertWithinLimit(aiMessagesUsed: number): void {
    if (aiMessagesUsed >= GENERAL_AI_LIMIT) {
        throw new UsageLimitError();
    }
}

export async function reserveUsageSlot(uid: string): Promise<void> {
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const now = Date.now();
    const data = (userDoc.data() || {}) as Record<string, unknown>;
    const usage = resetIfExpired(normalizeUsage(data, now), now);
    assertWithinLimit(usage.aiMessagesUsed);
}

export async function commitUsageSlot(uid: string): Promise<void> {
    const userRef = adminDb.collection("users").doc(uid);

    await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const now = Date.now();
        const data = (userDoc.data() || {}) as Record<string, unknown>;
        let usage = resetIfExpired(normalizeUsage(data, now), now);

        assertWithinLimit(usage.aiMessagesUsed);

        usage = {
            ...usage,
            aiMessagesUsed: usage.aiMessagesUsed + 1,
        };

        transaction.set(userRef, { usage }, { merge: true });
    });
}

export async function enforceUsageLimit(uid: string): Promise<void> {
    await commitUsageSlot(uid);
}
