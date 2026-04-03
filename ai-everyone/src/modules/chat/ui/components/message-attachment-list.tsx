"use client";

import { FileText } from "lucide-react";
import type { ChatAttachment } from "@/modules/chat/types";

interface MessageAttachmentListProps {
    attachments: ChatAttachment[];
}

export function MessageAttachmentList({ attachments }: MessageAttachmentListProps) {
    if (attachments.length === 0) return null;

    return (
        <div className="mb-2 flex flex-col gap-2">
            {attachments.map((attachment) => (
                <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs"
                >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-white/80" />
                    <div className="min-w-0">
                        <p className="truncate text-white">{attachment.name}</p>
                        <p className="text-white/50">
                            {(attachment.mimeType || "file").replace("application/", "").replace("text/", "")}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
