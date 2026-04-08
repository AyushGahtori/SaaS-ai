"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BLOOM_ROUTE } from "@/modules/bloom-ai/constants/navigation";
import { bloomSlideTransition } from "@/modules/bloom-ai/animations/transitions";

interface BloomQuickAccessRailProps {
    onOpenReminders: () => void;
}

export function BloomQuickAccessRail({ onOpenReminders }: BloomQuickAccessRailProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="pointer-events-none fixed right-4 top-1/2 z-40 -translate-y-1/2">
            <div className="pointer-events-auto flex flex-col items-end gap-3">
                <Button
                    onClick={() => setOpen((current) => !current)}
                    className="size-10 rounded-full border border-white/10 bg-[#0C0D0D] text-white hover:bg-white/10"
                    aria-label="Open Bloom AI quick switch"
                >
                    {open ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
                </Button>

                <div
                    className={cn(
                        bloomSlideTransition,
                        "flex flex-col items-end gap-2",
                        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
                    )}
                >
                    <Link
                        href={BLOOM_ROUTE}
                        className="rounded-2xl border border-white/10 bg-[#0C0D0D] px-5 py-3 text-base font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-white/20 hover:bg-[#111]"
                    >
                        Bloom AI
                    </Link>

                    <button
                        type="button"
                        onClick={onOpenReminders}
                        className="rounded-2xl border border-white/10 bg-[#0C0D0D] px-5 py-3 text-base font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-white/20 hover:bg-[#111]"
                    >
                        Daily Reminders
                    </button>
                </div>
            </div>
        </div>
    );
}
