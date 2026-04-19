"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  PanelLeftCloseIcon,
  PanelLeftIcon,
  SearchIcon,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { DashboardCommand } from "./dashboard-command";
import { ReminderDrawer } from "./reminder-drawer";
import { BloomQuickAccessRail } from "@/modules/bloom-ai/ui/components/bloom-quick-access-rail";

export const DashboardNavbar = () => {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const isBloomRoute = pathname?.startsWith("/bloom");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isBloomRoute) {
    return null;
  }

  return (
    <>
      <DashboardCommand open={open} setOpen={setOpen} />
      <ReminderDrawer open={remindersOpen} onOpenChange={setRemindersOpen} />

      <div className="flex items-center gap-x-2 bg-black px-4 py-3">
        <Button
          className="size-9 border-white/8 bg-[#0C0D0D] p-0 text-white hover:border-primary/28 hover:bg-primary/10 hover:shadow-[0_10px_24px_rgb(94_60_220/24%)]"
          variant="outline"
          onClick={toggleSidebar}
        >
          {state === "collapsed" || isMobile ? (
            <PanelLeftIcon className="size-5" strokeWidth={2} />
          ) : (
            <PanelLeftCloseIcon className="size-5" strokeWidth={2} />
          )}
        </Button>

        <Button
          className="h-9 w-60 justify-start border-white/8 bg-[#0C0D0D] font-normal text-muted-foreground hover:border-primary/28 hover:bg-primary/10 hover:text-white hover:shadow-[0_10px_24px_rgb(94_60_220/24%)]"
          variant="outline"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
        >
          <SearchIcon className="size-4" strokeWidth={2} />
          <span className="ml-2">Search...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md border border-white/10 bg-white/8 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-[10px]">Ctrl</span>K
          </kbd>
        </Button>

        <div className="ml-auto">
          <Button variant="ghost" size="icon" asChild className="rounded-full text-muted-foreground hover:bg-primary/18 hover:text-white hover:shadow-[0_0_0_1px_rgb(134_95_255/28%),0_8px_18px_rgb(93_58_216/20%)]">
            <Link href="/upgrade">
              <Star className="size-5" stroke="currentColor" fill="currentColor" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      </div>

      <BloomQuickAccessRail onOpenReminders={() => setRemindersOpen(true)} />
    </>
  );
};
