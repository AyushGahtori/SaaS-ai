"use client";
// Horizontal scrolling section for trending agents.

import { useRef, useState, useEffect } from "react";
import type { Agent } from "@/lib/firestore-agents";
import { AgentCard } from "./agent-card";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AgentsTrendingSectionProps {
  title: string;
  agents: Agent[];
  installedAgentIds: string[];
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
}

export const AgentsTrendingSection = ({
  title,
  agents,
  installedAgentIds,
  onInstall,
  onUninstall,
}: AgentsTrendingSectionProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      // Use a small threshold to avoid rounding issues
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [agents]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = (320 + 16) * 4; // 4 cards + gap
      scrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = (320 + 16) * 4;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (agents.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-white/95 tracking-tight">{title}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            className={`p-1.5 rounded-full bg-white/10 transition-all ${
              !canScrollLeft 
                ? "opacity-50 cursor-not-allowed" 
                : "hover:bg-white/20 hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            <ChevronLeft className="h-5 w-5 text-white/90" />
          </button>
          <button
            onClick={scrollRight}
            disabled={!canScrollRight}
            className={`p-1.5 rounded-full bg-white/10 transition-all ${
              !canScrollRight 
                ? "opacity-50 cursor-not-allowed" 
                : "hover:bg-white/20 hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            <ChevronRight className="h-5 w-5 text-white/90" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="w-[320px] min-w-[320px] snap-start"
          >
            <AgentCard
              agent={agent}
              isInstalled={installedAgentIds.includes(agent.id)}
              onInstall={onInstall}
              onUninstall={onUninstall}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
