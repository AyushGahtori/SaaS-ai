import { NextRequest, NextResponse } from "next/server";
import { rebuildPersona } from "@/lib/memory/persona-builder";
import {
    deleteMemory,
    getActiveMemories,
    getMemorySettings,
    getPersona,
    saveMemory,
    updateMemory,
    updateMemorySettings,
} from "@/lib/memory/memory-repository.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import type { MemoryScope, MemoryType } from "@/lib/memory/types";

const ALLOWED_MEMORY_TYPES = new Set<MemoryType>([
    "identity",
    "role",
    "goal",
    "preference",
    "context",
    "skill",
    "project",
    "education",
]);

const ALLOWED_SCOPES = new Set<MemoryScope>(["stable", "temporary"]);

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [memories, persona, settings] = await Promise.all([
            getActiveMemories(verifiedUser.uid),
            getPersona(verifiedUser.uid),
            getMemorySettings(verifiedUser.uid),
        ]);

        return NextResponse.json({ memories, persona, settings });
    } catch (error) {
        console.error("[Memory API GET]", error);
        return NextResponse.json({ error: "Failed to fetch memory state." }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const type = String(body.type || "") as MemoryType;
        const key = String(body.key || "").trim();
        const value = String(body.value || "").trim();
        const scope = String(body.scope || "stable") as MemoryScope;
        const confidence = typeof body.confidence === "number" ? body.confidence : 1;

        if (!ALLOWED_MEMORY_TYPES.has(type) || !key || !value || !ALLOWED_SCOPES.has(scope)) {
            return NextResponse.json(
                { error: "type, key, value, and a valid scope are required." },
                { status: 400 }
            );
        }

        const memoryId = await saveMemory(verifiedUser.uid, {
            type,
            key,
            value,
            scope,
            confidence,
            source: "system",
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: null,
            sourceChatId: null,
            sourceMessageId: null,
        });

        rebuildPersona(verifiedUser.uid).catch((err) =>
            console.error("[Memory API POST] Persona rebuild error:", err)
        );

        return NextResponse.json({ success: true, memoryId });
    } catch (error) {
        console.error("[Memory API POST]", error);
        return NextResponse.json({ error: "Failed to create memory." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        if (body.target === "settings") {
            await updateMemorySettings(verifiedUser.uid, {
                maxTotalMemories:
                    typeof body.maxTotalMemories === "number" ? body.maxTotalMemories : undefined,
                tempMemoryTTLDays:
                    typeof body.tempMemoryTTLDays === "number" ? body.tempMemoryTTLDays : undefined,
                requireConfirmation:
                    typeof body.requireConfirmation === "boolean" ? body.requireConfirmation : undefined,
            });

            return NextResponse.json({ success: true });
        }

        const memoryId = String(body.memoryId || "");
        if (!memoryId) {
            return NextResponse.json({ error: "memoryId is required." }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (typeof body.value === "string") updates.value = body.value.trim();
        if (typeof body.key === "string" && body.key.trim()) updates.key = body.key.trim();
        if (typeof body.type === "string" && ALLOWED_MEMORY_TYPES.has(body.type)) updates.type = body.type;
        if (typeof body.scope === "string" && ALLOWED_SCOPES.has(body.scope)) updates.scope = body.scope;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
        }

        await updateMemory(verifiedUser.uid, memoryId, {
            ...updates,
            source: "system",
        });

        rebuildPersona(verifiedUser.uid).catch((err) =>
            console.error("[Memory API PATCH] Persona rebuild error:", err)
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Memory API PATCH]", error);
        return NextResponse.json({ error: "Failed to update memory state." }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memoryId = req.nextUrl.searchParams.get("memoryId");
    if (!memoryId) {
        return NextResponse.json({ error: "memoryId is required." }, { status: 400 });
    }

    try {
        await deleteMemory(verifiedUser.uid, memoryId);

        rebuildPersona(verifiedUser.uid).catch((err) =>
            console.error("[Memory API DELETE] Persona rebuild error:", err)
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Memory API DELETE]", error);
        return NextResponse.json({ error: "Failed to delete memory." }, { status: 500 });
    }
}
