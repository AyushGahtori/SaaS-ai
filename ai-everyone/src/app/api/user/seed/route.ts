/**
 * POST /api/user/seed
 *
 * Called fire-and-forget from the client auth layer when a new user
 * signs up for the first time. Initializes predefined memory skeleton
 * documents in Firestore using the Admin SDK.
 *
 * Idempotent: uses merge:true so calling it multiple times is safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { seedNewUserMemoryDocs } from "@/lib/memory/memory-repository.server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId } = body as { userId: string };

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        await seedNewUserMemoryDocs(userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[UserSeed API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Seeding failed" },
            { status: 500 }
        );
    }
}
