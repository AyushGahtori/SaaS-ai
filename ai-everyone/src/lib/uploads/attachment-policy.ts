/**
 * Shared file-attachment policy for chat uploads.
 * Keep this file framework-agnostic so both client and server can reuse it.
 */

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_SINGLE_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB total payload budget

const ALLOWED_EXTENSIONS = new Set([
    "pdf",
    "txt",
    "md",
    "csv",
    "json",
    "xml",
    "html",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "bmp",
    "heic",
    "heif",
    "tif",
    "tiff",
]);

const BLOCKED_MIME_PREFIXES = ["audio/", "video/"];

const ALLOWED_EXACT_MIME = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
]);

function extensionFromName(name: string): string {
    const lastDot = name.lastIndexOf(".");
    if (lastDot === -1) return "";
    return name.slice(lastDot + 1).trim().toLowerCase();
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachmentCount(totalCount: number): void {
    if (totalCount > MAX_ATTACHMENTS_PER_MESSAGE) {
        throw new Error(`You can upload at most ${MAX_ATTACHMENTS_PER_MESSAGE} files at once.`);
    }
}

export function validateSingleAttachmentSize(size: number, name: string): void {
    if (size <= 0 || !Number.isFinite(size)) {
        throw new Error(`File "${name}" has an invalid size.`);
    }
    if (size > MAX_SINGLE_ATTACHMENT_BYTES) {
        throw new Error(
            `File "${name}" is too large (${formatBytes(size)}). Max per file is ${formatBytes(
                MAX_SINGLE_ATTACHMENT_BYTES
            )}.`
        );
    }
}

export function validateTotalAttachmentSize(totalBytes: number): void {
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        throw new Error(
            `Total upload size is too large (${formatBytes(
                totalBytes
            )}). Max combined size is ${formatBytes(MAX_TOTAL_ATTACHMENT_BYTES)}.`
        );
    }
}

export function validateAttachmentType(name: string, mimeType?: string): void {
    const normalizedMime = (mimeType || "").toLowerCase().trim();
    const ext = extensionFromName(name);

    if (normalizedMime && BLOCKED_MIME_PREFIXES.some((prefix) => normalizedMime.startsWith(prefix))) {
        throw new Error(`File "${name}" is not supported for Gemini upload.`);
    }

    if (normalizedMime.startsWith("image/")) {
        return;
    }

    if (normalizedMime && ALLOWED_EXACT_MIME.has(normalizedMime)) {
        return;
    }

    if (ext && ALLOWED_EXTENSIONS.has(ext)) {
        return;
    }

    throw new Error(`File "${name}" is not a supported upload type.`);
}
