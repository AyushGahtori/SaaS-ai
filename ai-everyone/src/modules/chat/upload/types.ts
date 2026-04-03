import type { ChatAttachment } from "@/modules/chat/types";

export type UploadState = "uploading" | "ready" | "error";

export interface ChatUploadAttachment extends ChatAttachment {
    uploadState: UploadState;
    uploadError?: string;
    uploadedDocId?: string;
}

export interface DrivePickerFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    webViewLink?: string;
    size?: string;
}

export interface UploadFailure {
    name: string;
    reason: string;
}

