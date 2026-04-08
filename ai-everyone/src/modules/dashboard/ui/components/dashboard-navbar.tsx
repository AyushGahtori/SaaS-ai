"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  SearchIcon,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { DashboardCommand } from "./dashboard-command";
import { ReminderDrawer } from "./reminder-drawer";

export const DashboardNavbar = () => {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
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

  return (
    <>
      <DashboardCommand open={open} setOpen={setOpen} />
      <ReminderDrawer open={remindersOpen} onOpenChange={setRemindersOpen} />

      <div className="flex items-center gap-x-2 px-4 py-3">
        {!isBloomRoute ? (
          <Button
            className="size-9 border-white/5 p-0 hover:bg-white/5"
            style={{ backgroundColor: "#0C0D0D", borderColor: "rgba(255,255,255,0.05)" }}
            variant="outline"
            onClick={toggleSidebar}
          >
            {state === "collapsed" || isMobile ? (
              <PanelLeftIcon className="size-5" stroke="white" strokeWidth={2} />
            ) : (
              <PanelLeftCloseIcon className="size-5" stroke="white" strokeWidth={2} />
            )}
          </Button>
        ) : null}

        <Button
          className="h-9 w-60 justify-start border-white/5 font-normal text-muted-foreground hover:bg-white/5 hover:text-white"
          style={{ backgroundColor: "#0C0D0D", borderColor: "rgba(255,255,255,0.05)" }}
          variant="outline"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
        >
          <SearchIcon className="size-4" stroke="white" strokeWidth={2} />
          <span className="ml-2">Search...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border-none bg-white/10 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">#8984</span>k
          </kbd>
        </Button>

        <div className="ml-auto">
          <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-white/5">
            <Link href="/upgrade">
              <Star className="size-5" stroke="white" fill="white" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      </div>

      {!isBloomRoute ? (
        <div className="pointer-events-none fixed right-4 top-1/2 z-40 -translate-y-1/2">
          <div className="pointer-events-auto flex flex-col items-end gap-3">
            <Button
              onClick={() => setRailOpen((prev) => !prev)}
              className="size-10 rounded-full border border-white/10 bg-[#0C0D0D] text-white hover:bg-white/10"
              aria-label="Open quick switch"
            >
              {railOpen ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
            </Button>

            <div
              className={`flex flex-col items-end gap-2 transition-all duration-300 ${
                railOpen ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0 pointer-events-none"
              }`}
            >
              <Link
                href="/bloom"
                className="rounded-2xl border border-white/10 bg-[#0C0D0D] px-5 py-3 text-base font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-white/20 hover:bg-[#111]"
              >
                Bloom AI
              </Link>

              <button
                onClick={() => setRemindersOpen(true)}
                className="rounded-2xl border border-white/10 bg-[#0C0D0D] px-5 py-3 text-base font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-white/20 hover:bg-[#111]"
              >
                Reminders
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
