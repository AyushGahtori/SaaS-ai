"use client";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { PanelLeftIcon, PanelLeftCloseIcon, Search, SearchIcon, Star } from "lucide-react";
import { useState } from "react";
import { DashboardCommand } from "./dashboard-command";
import { useEffect } from "react";
import Link from "next/link";

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
            <div className="flex px-4 gap-x-2 items-center py-3">
                <Button className="size-9 border-white/5 hover:bg-white/5 p-0 flex items-center justify-center" style={{ backgroundColor: "#0C0D0D", borderColor: "rgba(255,255,255,0.05)" }} variant="outline" onClick={toggleSidebar}>
                    {(state === "collapsed" || isMobile) ? <PanelLeftIcon className="size-5" stroke="white" strokeWidth={2} /> : <PanelLeftCloseIcon className="size-5" stroke="white" strokeWidth={2} />}
                </Button>

                <Button
                    className="h-9 w-60 justify-start font-normal text-muted-foreground border-white/5 hover:bg-white/5"
                    style={{ backgroundColor: "#0C0D0D", borderColor: "rgba(255,255,255,0.05)" }}
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(open => !open)}
                >
                    <SearchIcon className="size-4" stroke="white" strokeWidth={2} />
                    <span className="ml-2">Search...</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border-none bg-white/10 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-xs">#8984</span>k
                    </kbd>
                </Button>

                <div className="ml-auto">
                    <Button variant="ghost" size="icon" asChild className="hover:bg-white/5 rounded-full">
                        <Link href="/upgrade">
                            <Star className="size-5" stroke="white" fill="white" strokeWidth={2} />
                        </Link>
                    </Button>
                </div>
            </div>
        </>
    )
};    