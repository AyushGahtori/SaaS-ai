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
import path from "path";
import fs from "fs";

let adminApp: App;

function normalizeBucketName(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Accept both "bucket-name" and "gs://bucket-name[/...]" formats.
    const noScheme = trimmed.replace(/^gs:\/\//i, "");
    const bucketOnly = noScheme.split("/")[0];
    return bucketOnly || undefined;
}

if (!getApps().length) {
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "./serviceAccountKey.json";
    const resolvedPath = path.resolve(process.cwd(), keyPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(
            `Firebase Admin: service account key not found at "${resolvedPath}". ` +
            `Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.`
        );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
    const bucketName = normalizeBucketName(
        process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            (serviceAccount.project_id
                ? `${serviceAccount.project_id}.appspot.com`
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
