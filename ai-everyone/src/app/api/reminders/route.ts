import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { verifyFirebaseRequest } from "@/lib/server-auth";

function toIso(value: unknown): string | null {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value === "string") return value;
    return null;
}

function serializeReminder(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
) {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        title: data.title || "",
        datetime: data.datetime || "",
        status: data.status || "pending",
        priority: data.priority || "normal",
        tags: Array.isArray(data.tags) ? data.tags : [],
        createdAt: toIso(data.createdAt),
    };
}

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status");

    try {
        let query: FirebaseFirestore.Query = adminDb
            .collection("todos")
            .where("userId", "==", verifiedUser.uid);

        if (status) {
            query = query.where("status", "==", status);
        }

        const snapshot = await query.get();
        const reminders = snapshot.docs
            .map(serializeReminder)
            .sort((left, right) => String(left.datetime).localeCompare(String(right.datetime)));

        return NextResponse.json({ reminders });
    } catch (error) {
        console.error("[Reminders API GET]", error);
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
        const datetime = String(body.datetime || "").trim();

        if (!title) {
            return NextResponse.json({ error: "title is required." }, { status: 400 });
        }

        const docRef = adminDb.collection("todos").doc();
        await docRef.set({
            userId: verifiedUser.uid,
            title,
            datetime,
            status: "pending",
            priority: String(body.priority || "normal"),
            tags: Array.isArray(body.tags) ? body.tags : [],
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, reminderId: docRef.id });
    } catch (error) {
        console.error("[Reminders API POST]", error);
        return NextResponse.json({ error: "Failed to create reminder." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const reminderId = String(body.reminderId || "");
        if (!reminderId) {
            return NextResponse.json({ error: "reminderId is required." }, { status: 400 });
        }

        const docRef = adminDb.collection("todos").doc(reminderId);
        const snapshot = await docRef.get();
        if (!snapshot.exists || snapshot.data()?.userId !== verifiedUser.uid) {
            return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
        }

        const updates: Record<string, unknown> = {};
        if (typeof body.title === "string") updates.title = body.title.trim();
        if (typeof body.datetime === "string") updates.datetime = body.datetime.trim();
        if (typeof body.status === "string") updates.status = body.status;
        if (typeof body.priority === "string") updates.priority = body.priority;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid reminder fields provided." }, { status: 400 });
        }

        await docRef.update(updates);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Reminders API PATCH]", error);
        return NextResponse.json({ error: "Failed to update reminder." }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reminderId = req.nextUrl.searchParams.get("reminderId");
    if (!reminderId) {
        return NextResponse.json({ error: "reminderId is required." }, { status: 400 });
    }

    try {
        const docRef = adminDb.collection("todos").doc(reminderId);
        const snapshot = await docRef.get();
        if (!snapshot.exists || snapshot.data()?.userId !== verifiedUser.uid) {
            return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
        }

        await docRef.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Reminders API DELETE]", error);
        return NextResponse.json({ error: "Failed to delete reminder." }, { status: 500 });
    }
}
