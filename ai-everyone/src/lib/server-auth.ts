import { getAuth } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import adminApp from "@/lib/firebase-admin";

export interface VerifiedFirebaseUser {
    uid: string;
    email: string | null;
    name: string | null;
}

function isFirebaseCredentialError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes("default credentials") ||
        message.includes("could not load the default credentials") ||
        (message.includes("credential") && message.includes("fetch"))
    );
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
        if (isFirebaseCredentialError(error)) {
            throw new Error(
                "[ServerAuth] Firebase Admin credentials are missing or invalid at runtime."
            );
        }
        console.error("[ServerAuth] Firebase token verification failed:", error);
        return null;
    }
}
