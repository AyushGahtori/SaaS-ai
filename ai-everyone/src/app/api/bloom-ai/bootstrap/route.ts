import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import { getBloomWorkspaceSnapshot } from "@/modules/bloom-ai/lib/server";

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const snapshot = await getBloomWorkspaceSnapshot(verifiedUser.uid);
        return NextResponse.json(snapshot, {
            headers: {
                "Cache-Control": "private, max-age=20, stale-while-revalidate=120",
            },
        });
    } catch (error) {
        console.error("[Bloom Bootstrap]", error);
        return NextResponse.json(
            { error: "Failed to load the Bloom AI workspace." },
            { status: 500 }
        );
    }
}
