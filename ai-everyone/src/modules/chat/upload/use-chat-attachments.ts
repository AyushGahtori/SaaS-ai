"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { supportsFileUpload } from "@/lib/model-capabilities";
import type { ChatAttachment } from "@/modules/chat/types";
import type {
    ChatUploadAttachment,
    DrivePickerFile,
} from "@/modules/chat/upload/types";
import {
    fileToDataUrl,
    listDriveFiles,
    persistUploadedDoc,
    validateUploadSize,
} from "@/modules/chat/upload/api";

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const modelSupportsUpload = useMemo(
        () => supportsFileUpload(selectedModel),
        [selectedModel]
    );

    const pendingUploads = useMemo(
        () => attachments.filter((item) => item.uploadState === "uploading").length,
        [attachments]
    );
    const hasUploadError = useMemo(
        () => attachments.some((item) => item.uploadState === "error"),
        [attachments]
    );
    const readyAttachments = useMemo<ChatAttachment[]>(
        () =>
            attachments
                .filter((item) => item.uploadState === "ready")
                .map(({ uploadState: _uploadState, uploadError: _uploadError, ...rest }) => rest),
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

        for (const file of Array.from(files)) {
            const attachmentId = createAttachmentId("computer", file.name);
            try {
                validateUploadSize(file.size);
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
            const files = await listDriveFiles(query);
            setDriveFiles(files);
        } catch (error) {
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
        void fetchDriveResults(driveSearch);
    };

    const addDriveAttachment = async (file: DrivePickerFile) => {
        const parsedSize = Number(file.size || "0");
        if (parsedSize > 0) validateUploadSize(parsedSize);

        const attachmentId = createAttachmentId("drive", file.name);
        const initialAttachment: ChatUploadAttachment = {
            id: attachmentId,
            source: "drive",
            name: file.name,
            mimeType: file.mimeType,
            size: parsedSize > 0 ? parsedSize : undefined,
            driveFileId: file.id,
            webViewLink: file.webViewLink,
            uploadState: "uploading",
        };
        setAttachments((prev) => [...prev, initialAttachment]);
        setIsDriveDialogOpen(false);

        try {
            const persisted = await persistUploadedDoc({
                source: "drive",
                name: file.name,
                mimeType: file.mimeType,
                size: parsedSize > 0 ? parsedSize : 1,
                driveFileId: file.id,
                webViewLink: file.webViewLink,
            });
            updateAttachment(attachmentId, (current) => ({
                ...current,
                uploadState: "ready",
                uploadedDocId: persisted.uploadedDocId,
            }));
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to store Drive attachment.";
            updateAttachment(attachmentId, (current) => ({
                ...current,
                uploadState: "error",
                uploadError: message,
            }));
            setAttachError(message);
        }
    };

    const clearAttachments = () => setAttachments([]);

    useEffect(() => {
        if (!isDriveDialogOpen) return;
        const timeout = window.setTimeout(() => {
            void fetchDriveResults(driveSearch);
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [driveSearch, isDriveDialogOpen]);

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
        pendingUploads,
        hasUploadError,
        readyAttachments,
        modelSupportsUpload,
        fileInputRef,
        removeAttachment,
        openComputerPicker,
        openDrivePicker,
        handleComputerFilesSelected,
        addDriveAttachment,
        clearAttachments,
    };
}
