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

function createAttachmentId(prefix: string, name: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
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

    const handleComputerFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        if (!ensureModelSupportsUpload()) {
            event.target.value = "";
            return;
        }

        const selected = Array.from(files);
        let queuedThisBatch = 0;
        let queuedBytes = 0;

        for (const file of selected) {
            const attachmentId = createAttachmentId("computer", file.name);
            try {
                validateBeforeQueueing(
                    file.name,
                    file.type || "application/octet-stream",
                    file.size,
                    queuedThisBatch + 1,
                    queuedBytes
                );
                setAttachError(null);

                const dataUrl = await fileToDataUrl(file);

                const initialAttachment: ChatUploadAttachment = {
                    id: attachmentId,
                    source: "computer",
                    name: file.name,
                    mimeType: file.type || "application/octet-stream",
                    size: file.size,
                    dataBase64: dataUrl,
                    uploadState: "uploading",
                };
                setAttachments((prev) => [...prev, initialAttachment]);
                queuedThisBatch += 1;
                queuedBytes += file.size;

                const persisted = await persistUploadedDoc({
                    source: "computer",
                    name: file.name,
                    mimeType: file.type || "application/octet-stream",
                    size: file.size,
                    dataBase64: dataUrl,
                });

                updateAttachment(attachmentId, (current) => ({
                    ...current,
                    uploadState: "ready",
                    uploadedDocId: persisted.uploadedDocId,
                }));
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to upload selected file.";
                const failedAttachment: ChatUploadAttachment = {
                    id: attachmentId,
                    source: "computer",
                    name: file.name,
                    mimeType: file.type || "application/octet-stream",
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

        event.target.value = "";
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
                error instanceof Error ? error.message : "Failed to load Drive files.";
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
            const message =
                error instanceof Error
                    ? error.message
                    : "Drive sign-in failed. Please try again.";
            setAttachError(message);
        }
    };

    const addDriveAttachment = async (file: DrivePickerFile) => {
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

            const attachmentId = createAttachmentId("drive", file.name);
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
            const message =
                error instanceof Error ? error.message : "Failed to store Drive attachment.";
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
        openDrivePicker,
        handleComputerFilesSelected,
        addDriveAttachment,
        clearAttachments,
        restoreAttachments,
    };
}
