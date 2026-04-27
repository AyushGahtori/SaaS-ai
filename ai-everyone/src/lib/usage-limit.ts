import { adminDb } from "@/lib/firebase-admin";

// Just ONE general limit, exactly as Ayush requested!
const GENERAL_AI_LIMIT = Number(process.env.MAX_AI_REQUESTS_PER_MONTH) || 100;

export async function enforceUsageLimit(uid: string): Promise<void> {
    const userRef = adminDb.collection("users").doc(uid);

    await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const data = userDoc.data() || {};

        // Simple usage tracking without any "plan type" baggage
        let usage = data.usage || {
            aiMessagesUsed: 0,
            cycleEndDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        };

        const now = Date.now();

        // Reset logic if 30 days have passed
        if (now > usage.cycleEndDate) {
            usage.aiMessagesUsed = 0;
            usage.cycleEndDate = now + 30 * 24 * 60 * 60 * 1000;
        }

        // Compare against the ONE general limit
        if (usage.aiMessagesUsed >= GENERAL_AI_LIMIT) {
            throw new Error("LIMIT_REACHED");
        }

        // Safely add 1 to their shared count
        usage.aiMessagesUsed += 1;

        // Save back to Firebase
        transaction.set(userRef, { usage }, { merge: true });
    });
}
