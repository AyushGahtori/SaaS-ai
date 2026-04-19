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
                    className={`interactive-lift flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-[border-color,background-color,box-shadow,color] ${
                        attachment.uploadState === "error"
                            ? "border-red-400/30 bg-red-500/10 text-red-100"
                            : attachment.uploadState === "uploading"
                            ? "border-violet-300/35 bg-violet-500/10 text-violet-50 shadow-[0_8px_22px_rgb(98_62_224/18%)]"
                            : "border-white/10 bg-white/5 text-white/85 hover:border-primary/30 hover:bg-primary/10"
                    }`}
                >
                    <div className="flex h-4 w-4 items-center justify-center">
                        {attachment.uploadState === "uploading" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-200" />
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
                        className="rounded-full p-0.5 text-white/55 hover:bg-white/10 hover:text-white"
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

