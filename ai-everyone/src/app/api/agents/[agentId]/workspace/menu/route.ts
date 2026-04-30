import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    getRestaurantWorkspaceMemory,
    saveRestaurantWorkspaceMemory,
} from "@/lib/agents/restaurant-workspace-memory.server";

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
    if (agentId !== "restaurant-concierge-agent") {
        return NextResponse.json({ error: "Unsupported workspace memory route." }, { status: 404 });
    }

    const chatId = req.nextUrl.searchParams.get("chatId")?.trim();
    if (!chatId) {
        return NextResponse.json({ error: "chatId is required." }, { status: 400 });
    }

    try {
        const memory = await getRestaurantWorkspaceMemory({
            userId: verifiedUser.uid,
            chatId,
        });
        return NextResponse.json({ chatId, ...memory });
    } catch (error) {
        console.error("[RestaurantWorkspaceMenu GET] failed", { error, chatId });
        return NextResponse.json({ error: "Failed to load restaurant menu memory." }, { status: 500 });
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
    if (agentId !== "restaurant-concierge-agent") {
        return NextResponse.json({ error: "Unsupported workspace memory route." }, { status: 404 });
    }

    try {
        const body = (await req.json()) as { chatId?: string; menu_items?: unknown };
        const chatId = (body.chatId || "").trim();
        if (!chatId) {
            return NextResponse.json({ error: "chatId is required." }, { status: 400 });
        }

        const memory = await saveRestaurantWorkspaceMemory({
            userId: verifiedUser.uid,
            chatId,
            menuItems: body.menu_items,
        });

        return NextResponse.json({ chatId, ...memory });
    } catch (error) {
        console.error("[RestaurantWorkspaceMenu PUT] failed", { error });
        return NextResponse.json({ error: "Failed to save restaurant menu memory." }, { status: 500 });
    }
}
