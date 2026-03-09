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
import { PlusIcon } from "lucide-react";

// Props interface — extend this when adding file attachment logic
interface AttachFileProps {
    // TODO: Add props such as onFileSelect, acceptedFileTypes, etc. when implementing functionality
    onClick?: () => void;
}

/**
 * AttachFile button — renders a "+" icon button.
 * Placed on the left side of the AI prompt input bar.
 * Clicking this will eventually trigger a file picker or attachment flow.
 */
export const AttachFile = ({ onClick }: AttachFileProps) => {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            onClick={onClick}
            aria-label="Attach file"
            title="Attach file"
        >
            {/* Plus / Attach icon from lucide-react */}
            <PlusIcon className="size-4" stroke="white" strokeWidth={2} />
        </Button>
    );
};
