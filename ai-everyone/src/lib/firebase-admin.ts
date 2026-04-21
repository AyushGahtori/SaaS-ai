/**
 * Firebase Admin SDK initialization (server-side only).
 *
 * Used by Next.js API routes and server actions to write to Firestore
 * collections that are not writable by client-side rules (e.g. agentTasks).
 *
 * Service account credentials are loaded from FIREBASE_SERVICE_ACCOUNT_JSON /
 * FIREBASE_SERVICE_ACCOUNT_KEY JSON first, then from a resolved key file path.
 */

import { initializeApp, getApps, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import fs from "fs";
import { resolveServiceAccountPath } from "@/lib/firebase-admin-path";

let adminApp: App;

type ServiceAccountShape = ServiceAccount & {
    project_id?: string;
    projectId?: string;
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

export { resolveServiceAccountPath } from "@/lib/firebase-admin-path";

function readServiceAccountFromEnv(): ServiceAccountShape | null {
    const rawJsonFromJsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || "";
    const rawJsonFromKeyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() || "";
    const rawJson = rawJsonFromJsonEnv || rawJsonFromKeyEnv;
    if (!rawJson) return null;

    if (!rawJson.startsWith("{")) {
        const source = rawJsonFromJsonEnv
            ? "FIREBASE_SERVICE_ACCOUNT_JSON"
            : "FIREBASE_SERVICE_ACCOUNT_KEY";
        throw new Error(
            `Firebase Admin: ${source} must contain a JSON object, but received a non-JSON value.`
        );
    }

    try {
        return JSON.parse(rawJson) as ServiceAccountShape;
    } catch (error) {
        const source = rawJsonFromJsonEnv
            ? "FIREBASE_SERVICE_ACCOUNT_JSON"
            : "FIREBASE_SERVICE_ACCOUNT_KEY";
        throw new Error(
            `Firebase Admin: invalid JSON in ${source}. ` +
            `${error instanceof Error ? error.message : "Unknown parse error"}`
        );
    }
}

function readServiceAccountFromFile(): ServiceAccountShape {
    const resolvedPath = resolveServiceAccountPath();
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(
            `Firebase Admin: service account key not found at "${resolvedPath}". ` +
            `Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or FIREBASE_SERVICE_ACCOUNT_KEY in .env.`
        );
    }

    return JSON.parse(fs.readFileSync(resolvedPath, "utf-8")) as ServiceAccountShape;
}

export function loadServiceAccount(): ServiceAccountShape {
    return readServiceAccountFromEnv() || readServiceAccountFromFile();
}

if (!getApps().length) {
    const serviceAccount = loadServiceAccount();
    const serviceAccountProjectId = serviceAccount.project_id || serviceAccount.projectId;
    const bucketName = normalizeBucketName(
        process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            (serviceAccountProjectId
                ? `${serviceAccountProjectId}.appspot.com`
                : undefined)
    );

    adminApp = initializeApp({
        credential: cert(serviceAccount),
        ...(bucketName ? { storageBucket: bucketName } : {}),
    }, "admin");
} else {
    adminApp = getApps()[0]!;
}

/** Admin Firestore instance — bypasses client security rules. */
export const adminDb: Firestore = getFirestore(adminApp);
export const adminStorage: Storage = getStorage(adminApp);

export default adminApp;
