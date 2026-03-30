"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, Link2, Loader2, Star } from "lucide-react";
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

  useEffect(() => {
    setInstalled(isInstalled);
  }, [isInstalled]);

  const installLabel = useMemo(() => {
    if (installed) {
      return agent.kind === "bundle" || agent.requiresConnection ? "Connected" : "Installed";
    }
    return agent.kind === "bundle" || agent.requiresConnection ? "Connect" : "Get";
  }, [agent.kind, agent.requiresConnection, installed]);

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
      style={{ minHeight: 140 }}
    >
      <div className="flex gap-4">
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-[#2b2b2b] p-2 ring-1 ring-white/10 group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={agent.iconUrl}
            alt={agent.name}
            className="h-full w-full object-contain drop-shadow-md"
          />
        </div>

        <div className="flex flex-col justify-center flex-1 py-1">
          <h3 className="mb-0.5 text-[14px] font-semibold text-white/95 line-clamp-1">
            {agent.name}
          </h3>
          <span className="mb-2 text-[12px] text-white/40">{agent.category}</span>

          {agent.tags?.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {agent.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/55"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-auto flex items-center gap-2 text-[11px] font-medium text-white/40">
            <span className="flex items-center">
              <Star className="mr-1 h-3 w-3 fill-white/40" />
              {agent.rating.toFixed(1)}
            </span>
            <span>•</span>
            <span>{(agent.installCount / 1000).toFixed(1)}K</span>
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
          ) : (
            <>
              {installed ? (
                <Check className="h-3 w-3" />
              ) : agent.kind === "bundle" || agent.requiresConnection ? (
                <Link2 className="h-3 w-3" />
              ) : null}
              {installLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
