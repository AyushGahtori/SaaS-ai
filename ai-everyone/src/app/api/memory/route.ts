/**
 * /api/memory — Memory Management REST endpoint
 *
 * GET    /api/memory?userId=UID              → list active memories
 * DELETE /api/memory?userId=UID&memoryId=MID → soft-delete a memory
 * PATCH  /api/memory                          → edit a memory value
 */

import { NextRequest, NextResponse } from "next/server";
import {
    getActiveMemories,
    deleteMemory,
    updateMemory,
} from "@/lib/memory/memory-repository.server";
import { rebuildPersona } from "@/lib/memory/persona-builder";

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    try {
        const memories = await getActiveMemories(userId);
        return NextResponse.json({ memories });
    } catch (error) {
        console.error("[Memory API GET]", error);
        return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get("userId");
    const memoryId = req.nextUrl.searchParams.get("memoryId");

    if (!userId || !memoryId) {
        return NextResponse.json({ error: "userId and memoryId are required" }, { status: 400 });
    }

    try {
        await deleteMemory(userId, memoryId);

        // Rebuild persona after deletion (fire-and-forget)
        rebuildPersona(userId).catch((err) =>
            console.error("[Memory API DELETE] Persona rebuild error:", err)
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Memory API DELETE]", error);
        return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, memoryId, value } = body as {
            userId: string;
            memoryId: string;
            value: string;
        };

        if (!userId || !memoryId || value === undefined) {
            return NextResponse.json(
                { error: "userId, memoryId, and value are required" },
                { status: 400 }
            );
        }

        await updateMemory(userId, memoryId, { value, source: "system" });

        // Rebuild persona after edit (fire-and-forget)
        rebuildPersona(userId).catch((err) =>
            console.error("[Memory API PATCH] Persona rebuild error:", err)
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Memory API PATCH]", error);
        return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
    }
}
