import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    createNote,
    deleteNote,
    updateNote,
} from "@/modules/bloom-ai/lib/server";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const title = String(body.title || "").trim() || "Untitled note";
        const item = await createNote(verifiedUser.uid, {
            title,
            content: String(body.content || ""),
            labels: Array.isArray(body.labels) ? body.labels.map((item: unknown) => String(item)).filter(Boolean) : [],
        });
        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Notes POST]", error);
        return NextResponse.json({ error: "Failed to create the note." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const noteId = String(body.noteId || "").trim();
        if (!noteId) {
            return NextResponse.json({ error: "noteId is required." }, { status: 400 });
        }

        const item = await updateNote(verifiedUser.uid, noteId, {
            ...(typeof body.title === "string" ? { title: body.title.trim() || "Untitled note" } : {}),
            ...(typeof body.content === "string" ? { content: body.content } : {}),
            ...(Array.isArray(body.labels)
                ? { labels: body.labels.map((item: unknown) => String(item)).filter(Boolean) }
                : {}),
            ...(body.status === "active" || body.status === "archived" || body.status === "deleted"
                ? { status: body.status }
                : {}),
        });
        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Notes PATCH]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update the note." },
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
        const noteId = String(body.noteId || "").trim();
        if (!noteId) {
            return NextResponse.json({ error: "noteId is required." }, { status: 400 });
        }

        await deleteNote(verifiedUser.uid, noteId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Bloom Notes DELETE]", error);
        return NextResponse.json({ error: "Failed to delete the note." }, { status: 500 });
    }
}
