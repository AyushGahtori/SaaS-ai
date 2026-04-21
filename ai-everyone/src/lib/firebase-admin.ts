/**
 * Firebase Admin SDK initialization (server-side only).
 *
 * Used by Next.js API routes and server actions to write to Firestore
 * collections that are not writable by client-side rules (e.g. agentTasks).
 *
 * The service account key path is read from FIREBASE_SERVICE_ACCOUNT_KEY env var.
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import fs from "fs";
import { resolveServiceAccountPath } from "@/lib/firebase-admin-path";

let adminApp: App;
type ServiceAccountPayload = {
    project_id?: string;
    private_key?: string;
    [key: string]: string | undefined;
};

function normalizeBucketName(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Accept both "bucket-name" and "gs://bucket-name[/...]" formats.
    const noScheme = trimmed.replace(/^gs:\/\//i, "");
    const bucketOnly = noScheme.split("/")[0];
    return bucketOnly || undefined;
}

function parseServiceAccountJson(
    raw: string,
    sourceLabel: string
): ServiceAccountPayload | null {
    try {
        const parsed = JSON.parse(raw) as ServiceAccountPayload;
        if (parsed.private_key) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        }
        return parsed;
    } catch (error) {
        console.warn(`[FirebaseAdmin] Failed to parse service account JSON from ${sourceLabel}:`, error);
        return null;
    }
}

function resolveServiceAccount(): {
    serviceAccount: ServiceAccountPayload | null;
    sourceLabel: string;
} {
    const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

    if (rawCredential?.startsWith("{")) {
        return {
            serviceAccount: parseServiceAccountJson(rawCredential, "FIREBASE_SERVICE_ACCOUNT_KEY"),
            sourceLabel: "FIREBASE_SERVICE_ACCOUNT_KEY",
        };
    }

    const resolvedPath = resolveServiceAccountPath();
    if (!fs.existsSync(resolvedPath)) {
        return {
            serviceAccount: null,
            sourceLabel: resolvedPath,
        };
    }

    const rawFile = fs.readFileSync(resolvedPath, "utf-8");
    return {
        serviceAccount: parseServiceAccountJson(rawFile, resolvedPath),
        sourceLabel: resolvedPath,
    };
}

export { resolveServiceAccountPath } from "@/lib/firebase-admin-path";

if (!getApps().length) {
    const { serviceAccount, sourceLabel } = resolveServiceAccount();

    if (!serviceAccount) {
        console.warn(
            `Firebase Admin: no valid service account found (${sourceLabel}). ` +
            `Proceeding without explicit credentials; Firebase-dependent requests may fail at runtime.`
        );
    }

    const bucketName = normalizeBucketName(
        process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            (serviceAccount?.project_id
                ? `${serviceAccount.project_id}.appspot.com`
                : undefined)
    );

    adminApp = initializeApp(
        {
            ...(serviceAccount
                ? { credential: cert(serviceAccount as Parameters<typeof cert>[0]) }
                : {}),
            ...(bucketName ? { storageBucket: bucketName } : {}),
        },
        "admin"
    );
} else {
    adminApp = getApps()[0]!;
}

/** Admin Firestore instance - bypasses client security rules. */
export const adminDb: Firestore = getFirestore(adminApp);
export const adminStorage: Storage = getStorage(adminApp);

export default adminApp;
