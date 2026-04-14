"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AttachFileProps {
    onUploadFromComputer?: () => void;
    onUploadFromDrive?: () => void;
    disabled?: boolean;
}

export function AttachFile({
    onUploadFromComputer,
    onUploadFromDrive,
    disabled = false,
}: AttachFileProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-full text-white hover:bg-white/10 hover:text-white"
                    aria-label="Attach file"
                    title="Attach file"
                    disabled={disabled}
                >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-52 border border-white/10 bg-[#0C0D0D] text-white backdrop-blur-md"
            >
                <DropdownMenuItem
                    onClick={onUploadFromComputer}
                    className="cursor-pointer text-white focus:bg-white/10 focus:text-white"
                >
                    Upload from computer
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={onUploadFromDrive}
                    className="cursor-pointer text-white focus:bg-white/10 focus:text-white"
                >
                    Upload from Drive
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
