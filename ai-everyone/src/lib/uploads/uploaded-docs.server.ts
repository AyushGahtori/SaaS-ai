import { randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { MAX_SINGLE_ATTACHMENT_BYTES } from "@/lib/uploads/attachment-policy";

export const MAX_UPLOAD_BYTES = MAX_SINGLE_ATTACHMENT_BYTES;
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export type UploadedDocSource = "computer" | "drive";

export interface PersistUploadInput {
    uid: string;
    source: UploadedDocSource;
    name: string;
    mimeType: string;
    size: number;
    driveFileId?: string;
    webViewLink?: string;
    dataBase64?: string;
}

export interface PersistUploadResult {
    docId: string;
    storagePath: string | null;
    expiresAt: string;
}

export interface UploadedDocRecord {
    docId: string;
    source: UploadedDocSource;
    name: string;
    mimeType: string;
    size: number;
    driveFileId?: string | null;
    webViewLink?: string | null;
    storagePath?: string | null;
    createdAt?: string | null;
    expiresAt?: string | null;
}

function sanitizeFileName(name: string): string {
    const trimmed = name.trim() || "uploaded-file";
    return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function userUploadsCollection(uid: string) {
    return adminDb.collection("users").doc(uid).collection("uploadedDocs");
}

function toIsoFromTimestamp(
    value: Timestamp | FieldValue | string | null | undefined
): string | null {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    if (typeof value === "string" && value.trim()) return value;
    return null;
}

function assertOwnedStoragePath(uid: string, storagePath: string): void {
    const normalized = storagePath.replace(/\\/g, "/");
    const ownedPrefix = `users/${uid}/uploaded-docs/`;
    if (!normalized.startsWith(ownedPrefix)) {
        throw new Error("Rejected storage read: upload does not belong to this user.");
    }
}

function toTimestampMs() {
    return Date.now();
}

function decodeDataBase64(dataBase64: string): Buffer {
    const cleaned = dataBase64.includes(",")
        ? dataBase64.slice(dataBase64.indexOf(",") + 1)
        : dataBase64;
    return Buffer.from(cleaned, "base64");
}

export async function cleanupExpiredUploadedDocs(uid: string): Promise<number> {
    const now = Timestamp.fromMillis(Date.now());
    const snapshot = await userUploadsCollection(uid)
        .where("expiresAt", "<=", now)
        .limit(50)
        .get();

    if (snapshot.empty) return 0;

    let cleaned = 0;
    await Promise.all(
        snapshot.docs.map(async (doc) => {
            const data = doc.data() as { storagePath?: string | null };
            if (data.storagePath) {
                await adminStorage
                    .bucket()
                    .file(data.storagePath)
                    .delete({ ignoreNotFound: true })
                    .catch(() => undefined);
            }
            await doc.ref.delete().catch(() => undefined);
            cleaned += 1;
        })
    );
    return cleaned;
}

export async function persistUploadedDoc(
    input: PersistUploadInput
): Promise<PersistUploadResult> {
    if (input.size > MAX_UPLOAD_BYTES) {
        throw new Error(
            `File "${input.name}" exceeds 20MB. Maximum allowed size is 20MB.`
        );
    }

    await cleanupExpiredUploadedDocs(input.uid);

    const docId = randomUUID();
    const nowMs = toTimestampMs();
    const expiresMs = nowMs + UPLOAD_TTL_MS;
    const expiresAt = Timestamp.fromMillis(expiresMs);
    const nowTs = Timestamp.fromMillis(nowMs);

    let storagePath: string | null = null;

    if (input.dataBase64) {
        const bytes = decodeDataBase64(input.dataBase64);
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw new Error(
                `File "${input.name}" exceeds 20MB. Maximum allowed size is 20MB.`
            );
        }
        storagePath = `users/${input.uid}/uploaded-docs/${docId}/${sanitizeFileName(
            input.name
        )}`;

        try {
            await adminStorage.bucket().file(storagePath).save(bytes, {
                contentType: input.mimeType || "application/octet-stream",
                resumable: false,
                metadata: {
                    metadata: {
                        uid: input.uid,
                        docId,
                        source: input.source,
                    },
                },
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown storage failure";
            if (message.toLowerCase().includes("bucket does not exist")) {
                throw new Error(
                    "Upload storage bucket is not provisioned. Enable Firebase Storage in this project and set FIREBASE_STORAGE_BUCKET to the created bucket name."
                );
            }
            throw error;
        }
    }

    await userUploadsCollection(input.uid)
        .doc(docId)
        .set({
            docId,
            source: input.source,
            name: input.name,
            mimeType: input.mimeType || "application/octet-stream",
            size: input.size,
            driveFileId: input.driveFileId || null,
            webViewLink: input.webViewLink || null,
            storagePath,
            createdAt: nowTs,
            expiresAt,
            updatedAt: FieldValue.serverTimestamp(),
        });

    return {
        docId,
        storagePath,
        expiresAt: new Date(expiresMs).toISOString(),
    };
}

export async function listRecentUploadedDocs(
    uid: string,
    limit = 10
): Promise<UploadedDocRecord[]> {
    await cleanupExpiredUploadedDocs(uid);

    const snapshot = await userUploadsCollection(uid)
        .orderBy("createdAt", "desc")
        .limit(Math.max(1, Math.min(limit, 25)))
        .get();

    return snapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
            docId: String(data.docId || doc.id),
            source: (data.source as UploadedDocSource) || "computer",
            name: String(data.name || "uploaded-file"),
            mimeType: String(data.mimeType || "application/octet-stream"),
            size: Number(data.size || 0),
            driveFileId: (data.driveFileId as string) || null,
            webViewLink: (data.webViewLink as string) || null,
            storagePath: (data.storagePath as string) || null,
            createdAt: toIsoFromTimestamp(data.createdAt as Timestamp | string),
            expiresAt: toIsoFromTimestamp(data.expiresAt as Timestamp | string),
        };
    });
}

export async function readStoredUploadedDocAsBase64(
    uid: string,
    storagePath: string
): Promise<string> {
    assertOwnedStoragePath(uid, storagePath);
    const [bytes] = await adminStorage.bucket().file(storagePath).download();
    if (bytes.length > MAX_UPLOAD_BYTES) {
        throw new Error("Stored upload exceeds 20MB limit and cannot be attached.");
    }
    return bytes.toString("base64");
}
