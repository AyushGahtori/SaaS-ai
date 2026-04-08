import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    createHabit,
    deleteHabit,
    updateHabit,
} from "@/modules/bloom-ai/lib/server";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const name = String(body.name || "").trim();
        if (!name) {
            return NextResponse.json({ error: "name is required." }, { status: 400 });
        }

        const item = await createHabit(verifiedUser.uid, {
            name,
            category: String(body.category || "General").trim() || "General",
            color: String(body.color || "#B4FFC9"),
        });
        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Habits POST]", error);
        return NextResponse.json({ error: "Failed to create the habit." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const habitId = String(body.habitId || "").trim();
        if (!habitId) {
            return NextResponse.json({ error: "habitId is required." }, { status: 400 });
        }

        const item = await updateHabit(verifiedUser.uid, habitId, {
            ...(typeof body.name === "string" ? { name: body.name.trim() || "New habit" } : {}),
            ...(typeof body.category === "string" ? { category: body.category.trim() || "General" } : {}),
            ...(typeof body.color === "string" ? { color: body.color } : {}),
            ...(Array.isArray(body.completedDates)
                ? {
                      completedDates: body.completedDates
                          .map((item: unknown) => String(item))
                          .filter(Boolean),
                  }
                : {}),
        });
        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Habits PATCH]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update the habit." },
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
        const habitId = String(body.habitId || "").trim();
        if (!habitId) {
            return NextResponse.json({ error: "habitId is required." }, { status: 400 });
        }

        await deleteHabit(verifiedUser.uid, habitId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Bloom Habits DELETE]", error);
        return NextResponse.json({ error: "Failed to delete the habit." }, { status: 500 });
    }
}
