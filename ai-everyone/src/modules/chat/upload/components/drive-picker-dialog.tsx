"use client";

import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DrivePickerFile } from "@/modules/chat/upload/types";

interface DrivePickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    query: string;
    onQueryChange: (query: string) => void;
    files: DrivePickerFile[];
    isLoading: boolean;
    onSelectFile: (file: DrivePickerFile) => void;
}

export function DrivePickerDialog({
    open,
    onOpenChange,
    query,
    onQueryChange,
    files,
    isLoading,
    onSelectFile,
}: DrivePickerDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl bg-[#101214] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Upload from Drive</DialogTitle>
                    <DialogDescription className="text-white/60">
                        Select a file from Drive and attach it to this prompt.
                    </DialogDescription>
                </DialogHeader>

                <Input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Search files by name"
                    className="border-[#243246] bg-[#121a2b] text-cyan-50 placeholder:text-cyan-200/40 focus-visible:ring-cyan-400/40"
                />

                <div className="max-h-72 overflow-y-auto rounded-md border border-white/10">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-6 text-sm text-white/60">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Drive files...
                        </div>
                    ) : files.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-white/60">No files found.</div>
                    ) : (
                        files.map((file) => (
                            <button
                                key={file.id}
                                className="flex w-full items-start justify-between gap-3 border-b border-white/5 px-4 py-3 text-left hover:bg-white/5"
                                onClick={() => onSelectFile(file)}
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white">{file.name}</p>
                                    <p className="truncate text-xs text-white/50">{file.mimeType}</p>
                                </div>
                                <span className="text-xs text-white/40 shrink-0">
                                    {file.modifiedTime
                                        ? new Date(file.modifiedTime).toLocaleDateString()
                                        : ""}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

