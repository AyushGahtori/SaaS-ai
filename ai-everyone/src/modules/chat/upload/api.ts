import { auth } from "@/lib/firebase";
import {
    MAX_SINGLE_ATTACHMENT_BYTES,
} from "@/lib/uploads/attachment-policy";
import type { DrivePickerFile } from "@/modules/chat/upload/types";

export const MAX_UPLOAD_BYTES = MAX_SINGLE_ATTACHMENT_BYTES;
export const DRIVE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const DRIVE_AUTH_REQUIRED_CODE = "DRIVE_AUTH_REQUIRED";

type CodedError = Error & { code?: string };

function createDriveAuthRequiredError(
    message = "Drive sign-in is required for chat uploads."
): CodedError {
    const error = new Error(message) as CodedError;
    error.code = DRIVE_AUTH_REQUIRED_CODE;
    return error;
}

function isUnauthorizedStatus(status: number): boolean {
    return status === 401 || status === 403;
}

function toSafeDriveErrorMessage(
    status: number,
    fallback: string,
    payload: unknown
): string {
    if (isUnauthorizedStatus(status)) {
        return "Your Drive chat-upload session expired. Please sign in to Drive again.";
    }

    if (payload && typeof payload === "object") {
        const casted = payload as { error?: { message?: string } | string };
        if (typeof casted.error === "string" && casted.error.trim()) {
            return casted.error.trim();
        }
        if (
            casted.error &&
            typeof casted.error === "object" &&
            typeof casted.error.message === "string" &&
            casted.error.message.trim()
        ) {
            return casted.error.message.trim();
        }
    }

    return fallback;
}

function sanitizeDriveQuery(value: string): string {
    return value.trim().replace(/'/g, "\\'");
}

function resolveDriveExportMimeType(sourceMimeType: string): string | null {
    switch (sourceMimeType) {
        case "application/vnd.google-apps.document":
            return "text/plain";
        case "application/vnd.google-apps.presentation":
            return "text/plain";
        case "application/vnd.google-apps.spreadsheet":
            return "text/csv";
        default:
            return null;
    }
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read Drive file."));
        reader.readAsDataURL(blob);
    });
}

async function getBearerToken(): Promise<string> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Authentication expired. Please sign in again.");
    return token;
}

export function isDriveAuthRequiredError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    return (error as CodedError).code === DRIVE_AUTH_REQUIRED_CODE;
}

export async function listDriveFiles(
    driveAccessToken: string,
    query = ""
): Promise<DrivePickerFile[]> {
    if (!driveAccessToken?.trim()) {
        throw createDriveAuthRequiredError();
    }

    const driveUrl = new URL("https://www.googleapis.com/drive/v3/files");
    driveUrl.searchParams.set("pageSize", "20");
    driveUrl.searchParams.set("orderBy", "modifiedTime desc");
    driveUrl.searchParams.set(
        "fields",
        "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)"
    );

    const queryParts = ["trashed = false"];
    if (query.trim()) {
        queryParts.push(`name contains '${sanitizeDriveQuery(query)}'`);
    }
    driveUrl.searchParams.set("q", queryParts.join(" and "));

    const response = await fetch(driveUrl.toString(), {
        headers: { Authorization: `Bearer ${driveAccessToken}` },
    });

    const payload = (await response.json().catch(() => ({}))) as {
        files?: DrivePickerFile[];
        error?: unknown;
    };

    if (!response.ok) {
        const message = toSafeDriveErrorMessage(
            response.status,
            "Failed to fetch Drive files.",
            payload
        );
        if (isUnauthorizedStatus(response.status)) {
            throw createDriveAuthRequiredError(message);
        }
        throw new Error(message);
    }

    return payload.files || [];
}

export async function downloadDriveFileAsDataUrl(
    driveAccessToken: string,
    file: DrivePickerFile
): Promise<{ dataBase64: string; mimeType: string; size: number }> {
    if (!driveAccessToken?.trim()) {
        throw createDriveAuthRequiredError();
    }

    const exportMimeType = resolveDriveExportMimeType(file.mimeType);
    const requestUrl = exportMimeType
        ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(
              exportMimeType
          )}`
        : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

    const response = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${driveAccessToken}` },
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
            error?: unknown;
        };
        const message = toSafeDriveErrorMessage(
            response.status,
            `Failed to download "${file.name}" from Drive.`,
            payload
        );
        if (isUnauthorizedStatus(response.status)) {
            throw createDriveAuthRequiredError(message);
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    const size = Number(blob.size || 0);
    if (size <= 0) {
        throw new Error(`"${file.name}" appears empty or unreadable.`);
    }
    if (size > MAX_UPLOAD_BYTES) {
        throw new Error(`"${file.name}" exceeds 20MB. Maximum allowed size is 20MB.`);
    }

    const dataBase64 = await blobToDataUrl(blob);
    return {
        dataBase64,
        mimeType: exportMimeType || file.mimeType || blob.type || "application/octet-stream",
        size,
    };
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

