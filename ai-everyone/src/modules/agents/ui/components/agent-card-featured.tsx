"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, Link2, Loader2, Star } from "lucide-react";
import type { Agent } from "@/lib/firestore-agents";

interface AgentCardFeaturedProps {
  agent: Agent;
  isInstalled: boolean;
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
  large?: boolean;
}

export const AgentCardFeatured = ({
  agent,
  isInstalled,
  onInstall,
  onUninstall,
  large = false,
}: AgentCardFeaturedProps) => {
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
      className={`group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 backdrop-blur-md transition-all duration-300 hover:border-white/[0.18] hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] ${
        large ? "min-h-[340px]" : "min-h-[160px]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] via-transparent to-cyan-500/[0.04] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="absolute inset-0 z-0 scale-125 opacity-20 transition-transform duration-700 group-hover:scale-[1.35] group-hover:opacity-30">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[60px]"
          style={{ backgroundImage: `url(${agent.iconUrl})` }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={agent.iconUrl}
          alt=""
          className="h-full w-full object-cover mix-blend-overlay"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      <div className="absolute left-6 top-6 z-20 flex w-[calc(100%-48px)] items-start justify-between gap-2">
        <span className="rounded bg-[#0f7b0f] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
          {agent.category}
        </span>
        {!large ? (
          <div className="h-10 w-10 overflow-hidden rounded-[10px] bg-white/5 p-1 ring-1 ring-white/10 backdrop-blur-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agent.iconUrl} alt={agent.name} className="h-full w-full object-contain" />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-auto flex flex-col items-start pt-32">
        <h3 className={`mb-1 font-bold tracking-tight text-white/95 ${large ? "text-[28px] leading-tight" : "text-[20px] leading-snug"}`}>
          {agent.name}
        </h3>

        <p className={`mb-5 text-white/60 ${large ? "max-w-sm text-[15px] line-clamp-2" : "text-[13px] line-clamp-1"}`}>
          {agent.description}
        </p>

        {agent.tags?.length ? (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {agent.tags.slice(0, large ? 4 : 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-white/65"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex w-full items-center justify-between gap-4">
          <button
            onClick={handleClick}
            disabled={loading}
            className={`flex items-center justify-center gap-2 rounded px-5 py-2 text-[13px] font-semibold tracking-wide transition-all duration-200 ${
              installed
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-white text-black hover:bg-white/90"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              <>
                {installed ? (
                  <Check className="h-4 w-4" />
                ) : agent.kind === "bundle" || agent.requiresConnection ? (
                  <Link2 className="h-4 w-4" />
                ) : null}
                {installLabel}
              </>
            )}
          </button>

          <div className="flex items-center gap-3 text-[11px] font-medium text-white/50">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-white/50" />
              {agent.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {(agent.installCount / 1000).toFixed(1)}K
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
