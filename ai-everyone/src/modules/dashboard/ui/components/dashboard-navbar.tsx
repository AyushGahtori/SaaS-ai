"use client";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { PanelLeftIcon, PanelLeftCloseIcon, Search, SearchIcon } from "lucide-react";
import { useState } from "react";
import { DashboardCommand } from "./dashboard-command";
import { useEffect } from "react";

export const DashboardNavbar = () => {

    const { state, toggleSidebar, isMobile } = useSidebar(); // to re-render on sidebar state change
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen(open => !open);
            }
        };
        document.addEventListener("keydown", handleKeyDown);    

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return ( 
        <>
            <DashboardCommand open={open} setOpen={setOpen} />
            <div className="flex px-4 gap-x-2 items-center py-3 border-b bg-background">
                <Button className="size-9" variant="outline" onClick={toggleSidebar}>
                    {(state === "collapsed" || isMobile) ? <PanelLeftIcon className="size-5" /> : <PanelLeftCloseIcon className="size-5" />}
                </Button>

                <Button
                    className="h-9 w-60 justify-start font-normal text-muted-foreground hover:text-muted-foreground"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(open => !open)}
                >
                    <SearchIcon />
                    <span className="ml-2">Search...</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-xs">#8984</span>K
                    </kbd>
                </Button>
            </div>
        </>
    )
};    