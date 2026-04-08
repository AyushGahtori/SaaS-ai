import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    createJournalEntry,
    deleteJournalEntry,
    updateJournalEntry,
} from "@/modules/bloom-ai/lib/server";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const title = String(body.title || "").trim() || "Journal entry";
        const content = String(body.content || "").trim();
        if (!content) {
            return NextResponse.json({ error: "content is required." }, { status: 400 });
        }

        const item = await createJournalEntry(verifiedUser.uid, {
            title,
            content,
            mood:
                body.mood === "energized" ||
                body.mood === "calm" ||
                body.mood === "focused"
                    ? body.mood
                    : "reflective",
            entryDate: String(body.entryDate || new Date().toISOString()),
        });

        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Journal POST]", error);
        return NextResponse.json({ error: "Failed to create the journal entry." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const entryId = String(body.entryId || "").trim();
        if (!entryId) {
            return NextResponse.json({ error: "entryId is required." }, { status: 400 });
        }

        const item = await updateJournalEntry(verifiedUser.uid, entryId, {
            ...(typeof body.title === "string" ? { title: body.title.trim() || "Journal entry" } : {}),
            ...(typeof body.content === "string" ? { content: body.content.trim() } : {}),
            ...(typeof body.entryDate === "string" ? { entryDate: body.entryDate } : {}),
            ...(body.mood === "reflective" ||
            body.mood === "energized" ||
            body.mood === "calm" ||
            body.mood === "focused"
                ? { mood: body.mood }
                : {}),
        });

        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Journal PATCH]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update the journal entry." },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const entryId = String(body.entryId || "").trim();
        if (!entryId) {
            return NextResponse.json({ error: "entryId is required." }, { status: 400 });
        }

        await deleteJournalEntry(verifiedUser.uid, entryId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Bloom Journal DELETE]", error);
        return NextResponse.json({ error: "Failed to delete the journal entry." }, { status: 500 });
    }
}
