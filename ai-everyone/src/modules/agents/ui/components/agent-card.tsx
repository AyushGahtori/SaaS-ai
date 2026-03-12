"use client";
// Reusable agent card component — used in grids and trending sections.
// Displays agent info, icon, category, rating, install count, and install button.

import { useState } from "react";
import { Star, Download, Check, Loader2 } from "lucide-react";
import type { Agent } from "@/lib/firestore-agents";

interface AgentCardProps {
  agent: Agent;
  isInstalled: boolean;
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
}

export const AgentCard = ({
  agent,
  isInstalled,
  onInstall,
  onUninstall,
}: AgentCardProps) => {
  const [loading, setLoading] = useState(false);
  const [installed, setInstalled] = useState(isInstalled);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (installed) {
        await onUninstall(agent.id);
        setInstalled(false);
      } else {
        await onInstall(agent.id);
        setInstalled(true);
      }
    } catch (err) {
      console.error("Install/uninstall failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="group relative flex flex-col rounded-xl bg-transparent p-3 transition-all duration-200 hover:bg-white/[0.04]"
      style={{ minHeight: 120 }}
    >
      <div className="flex gap-4">
        {/* Left: Icon */}
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-[#2b2b2b] p-2 ring-1 ring-white/10 group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={agent.iconUrl}
            alt={agent.name}
            className="h-full w-full object-contain drop-shadow-md"
          />
        </div>

        {/* Right: Info */}
        <div className="flex flex-col justify-center flex-1 py-1">
          <h3 className="mb-0.5 text-[14px] font-semibold text-white/95 line-clamp-1">
            {agent.name}
          </h3>
          <span className="mb-2 text-[12px] text-white/40">
            {agent.category}
          </span>
          
          <div className="flex items-center gap-2 mt-auto text-[11px] text-white/40 font-medium">
             <span className="flex items-center">
               <Star className="h-3 w-3 fill-white/40 mr-1" />
               {agent.rating.toFixed(1)}
             </span>
             <span>•</span>
             <span>{(agent.installCount / 1000).toFixed(1)}K</span>
          </div>
        </div>
      </div>

      {/* Hover action overlay */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex flex-col gap-2">
            <button
            onClick={handleClick}
            disabled={loading}
            className={`flex items-center justify-center gap-1.5 rounded px-4 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                installed
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-white text-black hover:bg-white/90 shadow-md"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin text-black" />
            ) : installed ? (
                <>
                <Check className="h-3 w-3" />
                Owned
                </>
            ) : (
                "Get"
            )}
            </button>
      </div>
    </div>
  );
};
