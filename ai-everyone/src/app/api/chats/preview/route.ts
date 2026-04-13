import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyFirebaseRequest } from "@/lib/server-auth";

interface ChatPreviewResponse {
    id: string;
    title: string;
    updatedAt: string;
}

function toIso(value: unknown): string {
    if (value && typeof value === "object" && "toDate" in value) {
        const maybeTimestamp = value as { toDate: () => Date };
        return maybeTimestamp.toDate().toISOString();
    }
    if (typeof value === "string") return value;
    return new Date().toISOString();
}

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const snapshot = await adminDb
            .collection("users")
            .doc(verifiedUser.uid)
            .collection("chats")
            .orderBy("updatedAt", "desc")
            .limit(50)
            .get();

        const chats: ChatPreviewResponse[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                title: typeof data.title === "string" && data.title.trim() ? data.title : "New Chat",
                updatedAt: toIso(data.updatedAt),
            };
        });

        return NextResponse.json(
            { chats },
            {
                headers: {
                    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
                },
            }
        );
    } catch (error) {
        console.error("[Chat Preview API] Failed to fetch chats:", error);
        return NextResponse.json({ error: "Failed to fetch chat previews." }, { status: 500 });
    }
}
