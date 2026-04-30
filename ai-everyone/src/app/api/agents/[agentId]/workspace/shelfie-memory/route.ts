import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    getShelfieWorkspaceMemory,
    saveShelfieWorkspaceMemory,
} from "@/lib/agents/shelfie-workspace-memory.server";

function decodeAgentId(raw: string): string {
    return decodeURIComponent(raw || "").trim();
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ agentId: string }> }
) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId: rawAgentId } = await context.params;
    const agentId = decodeAgentId(rawAgentId);
    if (agentId !== "shelfie-grocery-agent") {
        return NextResponse.json({ error: "Unsupported workspace memory route." }, { status: 404 });
    }

    const chatId = req.nextUrl.searchParams.get("chatId")?.trim();
    if (!chatId) {
        return NextResponse.json({ error: "chatId is required." }, { status: 400 });
    }

    try {
        const memory = await getShelfieWorkspaceMemory({
            userId: verifiedUser.uid,
            chatId,
        });
        return NextResponse.json({ chatId, ...memory });
    } catch (error) {
        console.error("[ShelfieWorkspaceMemory GET] failed", { error, chatId });
        return NextResponse.json({ error: "Failed to load Shelfie memory." }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ agentId: string }> }
) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId: rawAgentId } = await context.params;
    const agentId = decodeAgentId(rawAgentId);
    if (agentId !== "shelfie-grocery-agent") {
        return NextResponse.json({ error: "Unsupported workspace memory route." }, { status: 404 });
    }

    try {
        const body = (await req.json()) as { chatId?: string; grocery_memory?: unknown };
        const chatId = (body.chatId || "").trim();
        if (!chatId) {
            return NextResponse.json({ error: "chatId is required." }, { status: 400 });
        }

        const memory = await saveShelfieWorkspaceMemory({
            userId: verifiedUser.uid,
            chatId,
            groceryMemory: body.grocery_memory,
        });
        return NextResponse.json({ chatId, ...memory });
    } catch (error) {
        console.error("[ShelfieWorkspaceMemory PUT] failed", { error });
        return NextResponse.json({ error: "Failed to save Shelfie memory." }, { status: 500 });
    }
}
