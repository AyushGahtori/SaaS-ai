import { auth } from "@/lib/firebase";
import {
    MAX_SINGLE_ATTACHMENT_BYTES,
} from "@/lib/uploads/attachment-policy";
import type { DrivePickerFile } from "@/modules/chat/upload/types";

export const MAX_UPLOAD_BYTES = MAX_SINGLE_ATTACHMENT_BYTES;

async function getBearerToken(): Promise<string> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Authentication expired. Please sign in again.");
    return token;
}

export async function listDriveFiles(query = ""): Promise<DrivePickerFile[]> {
    const token = await getBearerToken();
    const params = new URLSearchParams({ pageSize: "20" });
    if (query.trim()) params.set("q", query.trim());

    const response = await fetch(`/api/drive/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as {
        files?: DrivePickerFile[];
        error?: string;
    };
    if (!response.ok) {
        throw new Error(payload.error || "Failed to load Drive files.");
    }
    return payload.files || [];
}

export async function persistUploadedDoc(input: {
    source: "computer" | "drive";
    name: string;
    mimeType: string;
    size: number;
    dataBase64?: string;
    driveFileId?: string;
    webViewLink?: string;
}): Promise<{ uploadedDocId: string; expiresAt: string }> {
    const token = await getBearerToken();
    const response = await fetch("/api/uploads", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as {
        uploadedDocId?: string;
        expiresAt?: string;
        error?: string;
    };
    if (!response.ok) {
        throw new Error(payload.error || "Failed to store uploaded document.");
    }
    if (!payload.uploadedDocId || !payload.expiresAt) {
        throw new Error("Upload API returned an invalid payload.");
    }
    return {
        uploadedDocId: payload.uploadedDocId,
        expiresAt: payload.expiresAt,
    };
}

export function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read selected file."));
        reader.readAsDataURL(file);
    });
}

