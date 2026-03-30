import { getAuth } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import adminApp from "@/lib/firebase-admin";

export interface VerifiedFirebaseUser {
    uid: string;
    email: string | null;
    name: string | null;
}

function getBearerToken(req: NextRequest): string | null {
    const header = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!header) return null;

    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

export async function verifyFirebaseRequest(
    req: NextRequest
): Promise<VerifiedFirebaseUser | null> {
    const token = getBearerToken(req);
    if (!token) return null;

    try {
        const decoded = await getAuth(adminApp).verifyIdToken(token);
        return {
            uid: decoded.uid,
            email: decoded.email || null,
            name: decoded.name || null,
        };
    } catch (error) {
        console.error("[ServerAuth] Firebase token verification failed:", error);
        return null;
    }
}
