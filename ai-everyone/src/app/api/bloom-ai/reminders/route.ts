import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    createReminder,
    deleteReminder,
    listBloomReminders,
    updateReminder,
} from "@/modules/bloom-ai/lib/server";

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const reminders = await listBloomReminders(verifiedUser.uid);
        return NextResponse.json({ reminders });
    } catch (error) {
        console.error("[Bloom Reminders GET]", error);
        return NextResponse.json({ error: "Failed to load reminders." }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const title = String(body.title || "").trim();
        if (!title) {
            return NextResponse.json({ error: "title is required." }, { status: 400 });
        }

        const item = await createReminder(verifiedUser.uid, {
            title,
            details: String(body.details || "").trim(),
            scheduledFor: String(body.scheduledFor || "").trim(),
            priority: body.priority === "high" ? "high" : "normal",
        });

        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Reminders POST]", error);
        return NextResponse.json({ error: "Failed to create the reminder." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const reminderId = String(body.reminderId || "").trim();
        if (!reminderId) {
            return NextResponse.json({ error: "reminderId is required." }, { status: 400 });
        }

        const item = await updateReminder(verifiedUser.uid, reminderId, {
            ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
            ...(typeof body.details === "string" ? { details: body.details.trim() } : {}),
            ...(typeof body.scheduledFor === "string" ? { scheduledFor: body.scheduledFor.trim() } : {}),
            ...(body.priority === "high" || body.priority === "normal"
                ? { priority: body.priority }
                : {}),
            ...(body.status === "done" || body.status === "pending" ? { status: body.status } : {}),
        });

        return NextResponse.json({ item });
    } catch (error) {
        console.error("[Bloom Reminders PATCH]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update the reminder." },
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
        const reminderId = String(body.reminderId || "").trim();
        if (!reminderId) {
            return NextResponse.json({ error: "reminderId is required." }, { status: 400 });
        }

        await deleteReminder(verifiedUser.uid, reminderId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Bloom Reminders DELETE]", error);
        return NextResponse.json({ error: "Failed to delete the reminder." }, { status: 500 });
    }
}
