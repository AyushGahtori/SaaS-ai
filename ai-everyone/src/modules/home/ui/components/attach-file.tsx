/**
 * AttachFile Component
 * 
 * This component provides the file attachment button for the home AI input bar.
 * It is placed on the LEFT side of the AI prompt input bar.
 * 
 * Currently the button is a UI-only element — no functionality is wired up yet.
 * TODO: Implement file attachment logic here (e.g., open a file picker, upload to cloud storage, etc.)
 */

"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon } from "lucide-react";

// Props interface — extend this when adding file attachment logic
interface AttachFileProps {
    onUploadFromComputer?: () => void;
    onUploadFromDrive?: () => void;
    disabled?: boolean;
}

/**
 * AttachFile button — renders a "+" icon button.
 * Placed on the left side of the AI prompt input bar.
 * Clicking this will eventually trigger a file picker or attachment flow.
 */
export const AttachFile = ({
    onUploadFromComputer,
    onUploadFromDrive,
    disabled = false,
}: AttachFileProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg border border-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                    aria-label="Attach file"
                    title="Attach file"
                    disabled={disabled}
                >
                    <PlusIcon className="size-4" stroke="white" strokeWidth={2} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-52 text-white"
            >
                <DropdownMenuItem
                    onClick={onUploadFromComputer}
                    className="cursor-pointer text-white"
                >
                    Upload from computer
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={onUploadFromDrive}
                    className="cursor-pointer text-white"
                >
                    Upload from Drive
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
