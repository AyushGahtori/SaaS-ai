import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    createConversation,
    deleteConversation,
    upsertConversationMetadata,
} from "@/modules/bloom-ai/lib/server";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Chat";
        const conversation = await createConversation(verifiedUser.uid, title);
        return NextResponse.json({ conversation });
    } catch (error) {
        console.error("[Bloom Conversations POST]", error);
        return NextResponse.json({ error: "Failed to create a conversation." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const conversationId = String(body.conversationId || "").trim();
        if (!conversationId) {
            return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
        }

        const conversation = await upsertConversationMetadata(verifiedUser.uid, conversationId, {
            ...(typeof body.title === "string" ? { title: body.title.trim() || "New Chat" } : {}),
            ...(typeof body.isPinned === "boolean" ? { isPinned: body.isPinned } : {}),
            ...(typeof body.isArchived === "boolean" ? { isArchived: body.isArchived } : {}),
        });
        return NextResponse.json({ conversation });
    } catch (error) {
        console.error("[Bloom Conversations PATCH]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update the conversation." },
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
        const conversationId = String(body.conversationId || "").trim();
        if (!conversationId) {
            return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
        }

        await deleteConversation(verifiedUser.uid, conversationId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Bloom Conversations DELETE]", error);
        return NextResponse.json({ error: "Failed to delete the conversation." }, { status: 500 });
    }
}
