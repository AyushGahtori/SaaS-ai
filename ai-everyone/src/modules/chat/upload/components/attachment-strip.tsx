"use client";

import { FileText, Loader2, TriangleAlert, X } from "lucide-react";
import type { ChatUploadAttachment } from "@/modules/chat/upload/types";

interface AttachmentStripProps {
    attachments: ChatUploadAttachment[];
    onRemove: (attachmentId: string) => void;
}

export function AttachmentStrip({ attachments, onRemove }: AttachmentStripProps) {
    if (attachments.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 px-1">
            {attachments.map((attachment) => (
                <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85"
                >
                    <div className="flex h-4 w-4 items-center justify-center">
                        {attachment.uploadState === "uploading" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                        ) : attachment.uploadState === "error" ? (
                            <TriangleAlert className="h-3.5 w-3.5 text-red-400" />
                        ) : (
                            <FileText className="h-3.5 w-3.5 text-white/80" />
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="max-w-[220px] truncate">{attachment.name}</p>
                        <p className="text-[10px] text-white/50">
                            {attachment.uploadState === "uploading"
                                ? "Uploading..."
                                : attachment.uploadState === "error"
                                ? attachment.uploadError || "Upload failed"
                                : "Ready"}
                        </p>
                    </div>

                    <button
                        className="text-white/50 hover:text-white"
                        onClick={() => onRemove(attachment.id)}
                        aria-label={`Remove ${attachment.name}`}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}

