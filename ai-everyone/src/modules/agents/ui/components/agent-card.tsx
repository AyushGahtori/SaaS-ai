"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, Loader2, Star } from "lucide-react";
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

  const actionButtonClass = installed
    ? "bg-white/10 text-white hover:bg-white/20"
    : "bg-white text-black hover:bg-white/90 shadow-md";

  const renderActionContent = () => {
    if (loading) {
      return <Loader2 className="h-4 w-4 animate-spin text-black" />;
    }

    return (
      <>
        {installed ? (
          <Check className="h-4 w-4" />
        ) : agent.kind === "bundle" || agent.requiresConnection ? (
          <Link2 className="h-4 w-4" />
        ) : null}
        {installLabel}
      </>
    );
  };

  return (
    <div
      className="group relative flex flex-col rounded-xl bg-transparent p-3 transition-all duration-200 hover:bg-white/[0.04]"
      style={{ minHeight: 152 }}
    >
      <div className="flex gap-4">
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-[#2b2b2b] p-2 ring-1 ring-white/10 transition-shadow group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={agent.iconUrl}
            alt={agent.name}
            className="h-full w-full object-contain drop-shadow-md"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
          <h3 className="mb-0.5 line-clamp-1 text-[14px] font-semibold text-white/95">
            {agent.name}
          </h3>
          <span className="text-[12px] text-white/40">{agent.category}</span>

          <div className="relative mt-2 hidden min-h-[58px] md:block">
            <div className="absolute inset-0 space-y-2 transition-opacity duration-200 group-hover:pointer-events-none group-hover:opacity-0">
              {agent.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
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

              <div className="flex items-center gap-2 text-[11px] font-medium text-white/40">
                <span className="flex items-center">
                  <Star className="mr-1 h-3 w-3 fill-white/40" />
                  {agent.rating.toFixed(1)}
                </span>
                <span>•</span>
                <span>{(agent.installCount / 1000).toFixed(1)}K</span>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-end opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
              <button
                onClick={handleClick}
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {renderActionContent()}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-2 md:hidden">
        {agent.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
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

        <div className="flex items-center gap-2 text-[11px] font-medium text-white/40">
          <span className="flex items-center">
            <Star className="mr-1 h-3 w-3 fill-white/40" />
            {agent.rating.toFixed(1)}
          </span>
          <span>•</span>
          <span>{(agent.installCount / 1000).toFixed(1)}K</span>
        </div>

        <button
          onClick={handleClick}
          disabled={loading}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {renderActionContent()}
        </button>
      </div>
    </div>
  );
};

