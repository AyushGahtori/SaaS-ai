"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { supportsFileUpload } from "@/lib/model-capabilities";
import {
    validateAttachmentCount,
    validateAttachmentType,
    validateSingleAttachmentSize,
    validateTotalAttachmentSize,
} from "@/lib/uploads/attachment-policy";
import type { ChatAttachment } from "@/modules/chat/types";
import type {
    ChatUploadAttachment,
    DrivePickerFile,
    UploadFailure,
} from "@/modules/chat/upload/types";
import {
    downloadDriveFileAsDataUrl,
    isDriveAuthRequiredError,
    fileToDataUrl,
    listDriveFiles,
    persistUploadedDoc,
} from "@/modules/chat/upload/api";
import { useDriveUploadAuth } from "@/modules/chat/upload/use-drive-upload-auth";
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";

const MAX_VERCEL_PERSIST_UPLOAD_BYTES = 3 * 1024 * 1024;

function createAttachmentId(prefix: string, name: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
}

function inferExtensionFromMimeType(mimeType: string): string {
    const normalized = mimeType.toLowerCase().trim();
    if (!normalized) return "bin";
    if (normalized === "application/pdf") return "pdf";
    if (normalized === "image/jpeg") return "jpg";
    if (normalized.startsWith("image/")) {
        const extension = normalized.slice("image/".length).split("+")[0].trim();
        return extension || "png";
    }
    return "bin";
}

function shouldFallbackToLocalAttachment(error: unknown): boolean {
    if (
        typeof error === "object" &&
        error !== null &&
        "status" in error
    ) {
        const status = (error as { status?: unknown }).status;
        if (status === 413 || status === 500 || status === 502 || status === 503 || status === 504) {
            return true;
        }
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message) return false;

    return (
        message.includes("failed to fetch") ||
        message.includes("network") ||
        message.includes("load failed") ||
        message.includes("bucket") ||
        message.includes("timed out") ||
        message.includes("500") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504") ||
        message.includes("413") ||
        message.includes("payload too large") ||
        message.includes("request entity too large") ||
        message.includes("body exceeded") ||
        message.includes("function_payload_too_large") ||
        message.includes("storage failure")
    );
}

function shouldSkipCloudPersistence(size: number): boolean {
    return size > MAX_VERCEL_PERSIST_UPLOAD_BYTES;
}

function toLocalReadyAttachment(
    attachment: ChatUploadAttachment
): ChatUploadAttachment {
    return {
        ...attachment,
        uploadState: "ready",
        uploadError: undefined,
        uploadedDocId: undefined,
    };
}

export function useChatAttachments(selectedModel: string) {
    const [attachments, setAttachments] = useState<ChatUploadAttachment[]>([]);
    const [attachError, setAttachError] = useState<string | null>(null);
    const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
    const [driveSearch, setDriveSearch] = useState("");
    const [driveFiles, setDriveFiles] = useState<DrivePickerFile[]>([]);
    const [isLoadingDrive, setIsLoadingDrive] = useState(false);
    const [showDriveSigninOverlay, setShowDriveSigninOverlay] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {
        isReady: isDriveSigninReady,
        isSigningIn: isDriveSigningIn,
        authError: driveSigninError,
        requireDriveAccessToken,
        signInForDriveUpload,
        clearDriveUploadSession,
    } = useDriveUploadAuth();

    const modelSupportsUpload = useMemo(
        () => supportsFileUpload(selectedModel),
        [selectedModel]
    );

    const pendingUploads = useMemo(
        () => attachments.filter((item) => item.uploadState === "uploading").length,
        [attachments]
    );
    const readyAttachments = useMemo<ChatAttachment[]>(
        () =>
            attachments
                .filter((item) => item.uploadState === "ready")
                .map(({ uploadState: _uploadState, uploadError: _uploadError, ...rest }) => rest),
        [attachments]
    );
    const failedAttachments = useMemo<UploadFailure[]>(
        () =>
            attachments
                .filter((item) => item.uploadState === "error")
                .map((item) => ({
                    name: item.name,
                    reason: item.uploadError || "Upload failed",
                })),
        [attachments]
    );

    const ensureModelSupportsUpload = (): boolean => {
        if (modelSupportsUpload) return true;
        setAttachError("This model does not support file upload. Switch to a Gemini model.");
        return false;
    };

    const updateAttachment = (
        attachmentId: string,
        updater: (current: ChatUploadAttachment) => ChatUploadAttachment
    ) => {
        setAttachments((prev) =>
            prev.map((item) => (item.id === attachmentId ? updater(item) : item))
        );
    };

    const removeAttachment = (attachmentId: string) => {
        setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
    };

    const getCurrentTotalBytes = () =>
        attachments.reduce((sum, item) => sum + (Number(item.size || 0) > 0 ? Number(item.size) : 0), 0);

    const validateBeforeQueueing = (
        name: string,
        mimeType: string,
        size: number,
        additionalCount: number,
        additionalBytes: number
    ) => {
        validateAttachmentCount(attachments.length + additionalCount);
        validateAttachmentType(name, mimeType);
        validateSingleAttachmentSize(size, name);
        validateTotalAttachmentSize(getCurrentTotalBytes() + additionalBytes + size);
    };

    const openComputerPicker = () => {
        if (!ensureModelSupportsUpload()) return;
        setAttachError(null);
        fileInputRef.current?.click();
    };

    const queueComputerFiles = async (selected: File[]) => {
        if (selected.length === 0) return;
        if (!ensureModelSupportsUpload()) return;

        let queuedThisBatch = 0;
        let queuedBytes = 0;

        for (let index = 0; index < selected.length; index += 1) {
            const file = selected[index];
            const mimeType = file.type || "application/octet-stream";
            const fileName =
                file.name?.trim() ||
                `pasted-file-${Date.now()}-${index + 1}.${inferExtensionFromMimeType(mimeType)}`;
            const attachmentId = createAttachmentId("computer", fileName);
            let dataUrl: string | null = null;
            try {
                validateBeforeQueueing(
                    fileName,
                    mimeType,
                    file.size,
                    queuedThisBatch + 1,
                    queuedBytes
                );
                setAttachError(null);

                dataUrl = await fileToDataUrl(file);

                const initialAttachment: ChatUploadAttachment = {
                    id: attachmentId,
                    source: "computer",
                    name: fileName,
                    mimeType,
                    size: file.size,
                    dataBase64: dataUrl,
                    uploadState: "uploading",
                };
                setAttachments((prev) => [...prev, initialAttachment]);
                queuedThisBatch += 1;
                queuedBytes += file.size;

                if (shouldSkipCloudPersistence(file.size)) {
                    updateAttachment(attachmentId, toLocalReadyAttachment);
                    continue;
                }

                const persisted = await persistUploadedDoc({
                    source: "computer",
                    name: fileName,
                    mimeType,
                    size: file.size,
                    dataBase64: dataUrl,
                });

                updateAttachment(attachmentId, (current) => ({
                    ...current,
                    uploadState: "ready",
                    uploadedDocId: persisted.uploadedDocId,
                }));
            } catch (error) {
                const message = normalizeUserFacingError(error, {
                    surface: "upload",
                    fallbackMessage: "Failed to upload selected file.",
                }).message;

                if (dataUrl && shouldFallbackToLocalAttachment(error)) {
                    const safeDataUrl = dataUrl;
                    setAttachments((prev) => {
                        const exists = prev.some((item) => item.id === attachmentId);
                        if (exists) {
                            return prev.map((item) =>
                                item.id === attachmentId ? toLocalReadyAttachment(item) : item
                            );
                        }
                        return [
                            ...prev,
                            toLocalReadyAttachment({
                                id: attachmentId,
                                source: "computer",
                                name: fileName,
                                mimeType,
                                size: file.size,
                                dataBase64: safeDataUrl,
                                uploadState: "ready",
                            }),
                        ];
                    });
                    continue;
                }

                const failedAttachment: ChatUploadAttachment = {
                    id: attachmentId,
                    source: "computer",
                    name: fileName,
                    mimeType,
                    size: file.size,
                    uploadState: "error",
                    uploadError: message,
                };

                setAttachments((prev) => {
                    const exists = prev.some((item) => item.id === attachmentId);
                    if (exists) {
                        return prev.map((item) =>
                            item.id === attachmentId
                                ? { ...item, uploadState: "error", uploadError: message }
                                : item
                        );
                    }
                    return [...prev, failedAttachment];
                });
                setAttachError(message);
            }
        }
    };

    const handleComputerFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files ? Array.from(event.target.files) : [];
        event.target.value = "";
        if (selected.length === 0) return;
        await queueComputerFiles(selected);
    };

    const handleDroppedFiles = async (files: File[]) => {
        await queueComputerFiles(files);
    };

    const fetchDriveResults = async (query = "") => {
        setIsLoadingDrive(true);
        setAttachError(null);
        try {
            const driveAccessToken = await requireDriveAccessToken();
            const files = await listDriveFiles(driveAccessToken, query);
            setDriveFiles(files);
            setShowDriveSigninOverlay(false);
        } catch (error) {
            if (isDriveAuthRequiredError(error)) {
                setIsDriveDialogOpen(false);
                setShowDriveSigninOverlay(true);
                setDriveFiles([]);
                setAttachError(null);
                return;
            }
            const message =
                normalizeUserFacingError(error, {
                    surface: "upload",
                    fallbackMessage: "Failed to load Drive files.",
                }).message;
            setDriveFiles([]);
            setAttachError(message);
        } finally {
            setIsLoadingDrive(false);
        }
    };

    const openDrivePicker = () => {
        if (!ensureModelSupportsUpload()) return;
        setIsDriveDialogOpen(true);
        setShowDriveSigninOverlay(false);
        void fetchDriveResults(driveSearch);
    };

    const signInForDrivePicker = async () => {
        try {
            await signInForDriveUpload();
            setShowDriveSigninOverlay(false);
            setAttachError(null);
            setIsDriveDialogOpen(true);
            void fetchDriveResults(driveSearch);
        } catch (error) {
            const message = normalizeUserFacingError(error, {
                surface: "upload",
                fallbackMessage: "Drive sign-in failed. Please try again.",
            }).message;
            setAttachError(message);
        }
    };

    const addDriveAttachment = async (file: DrivePickerFile) => {
        let attachmentId: string | null = null;
        try {
            const driveAccessToken = await requireDriveAccessToken();
            const downloaded = await downloadDriveFileAsDataUrl(driveAccessToken, file);
            validateBeforeQueueing(
                file.name,
                downloaded.mimeType || file.mimeType || "application/octet-stream",
                downloaded.size,
                1,
                0
            );

            attachmentId = createAttachmentId("drive", file.name);
            const initialAttachment: ChatUploadAttachment = {
                id: attachmentId,
                source: "computer",
                name: file.name,
                mimeType: downloaded.mimeType || file.mimeType || "application/octet-stream",
                size: downloaded.size,
                dataBase64: downloaded.dataBase64,
                uploadState: "uploading",
            };
            setAttachments((prev) => [...prev, initialAttachment]);
            setIsDriveDialogOpen(false);

            if (shouldSkipCloudPersistence(downloaded.size)) {
                updateAttachment(attachmentId, toLocalReadyAttachment);
                return;
            }

            const persisted = await persistUploadedDoc({
                source: "computer",
                name: file.name,
                mimeType: downloaded.mimeType || file.mimeType || "application/octet-stream",
                size: downloaded.size,
                dataBase64: downloaded.dataBase64,
            });

            updateAttachment(attachmentId, (current) => ({
                ...current,
                uploadState: "ready",
                uploadedDocId: persisted.uploadedDocId,
            }));
        } catch (error) {
            if (isDriveAuthRequiredError(error)) {
                clearDriveUploadSession();
                setIsDriveDialogOpen(false);
                setShowDriveSigninOverlay(true);
                setAttachError(null);
                return;
            }

            if (shouldFallbackToLocalAttachment(error)) {
                if (attachmentId) {
                    updateAttachment(attachmentId, toLocalReadyAttachment);
                    return;
                }
                return;
            }

            const message =
                normalizeUserFacingError(error, {
                    surface: "upload",
                    fallbackMessage: "Failed to store Drive attachment.",
                }).message;
            setAttachError(message);
        }
    };

    const clearAttachments = () => setAttachments([]);
    const restoreAttachments = (snapshot: ChatUploadAttachment[]) =>
        setAttachments(snapshot);

    useEffect(() => {
        if (!isDriveDialogOpen) return;
        if (showDriveSigninOverlay) return;
        const timeout = window.setTimeout(() => {
            void fetchDriveResults(driveSearch);
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [driveSearch, isDriveDialogOpen, showDriveSigninOverlay]);

    useEffect(() => {
        if (modelSupportsUpload) {
            setAttachError(null);
            return;
        }
        if (attachments.length > 0) {
            setAttachError("This model does not support file upload. Switch to a Gemini model.");
        }
    }, [attachments.length, modelSupportsUpload]);

    return {
        attachments,
        attachError,
        setAttachError,
        isDriveDialogOpen,
        setIsDriveDialogOpen,
        driveSearch,
        setDriveSearch,
        driveFiles,
        isLoadingDrive,
        showDriveSigninOverlay,
        setShowDriveSigninOverlay,
        signInForDrivePicker,
        isDriveSigninReady,
        isDriveSigningIn,
        driveSigninError,
        pendingUploads,
        readyAttachments,
        failedAttachments,
        modelSupportsUpload,
        fileInputRef,
        removeAttachment,
        openComputerPicker,
        addComputerFiles: queueComputerFiles,
        openDrivePicker,
        handleComputerFilesSelected,
        handleDroppedFiles,
        addDriveAttachment,
        clearAttachments,
        restoreAttachments,
    };
}
