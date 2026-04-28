"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Link2,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import type { Agent } from "@/lib/firestore-agents";
import { getAgentDetailContent } from "@/modules/agents/data/agent-details";

interface AgentCardProps {
  agent: Agent;
  isInstalled: boolean;
  isTrialUsed?: boolean;
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
  onOpen: (agentId: string) => void;
  onUseTrial?: (agentId: string, prompt: string) => Promise<void>;
  showHoverDetails?: boolean;
}

export const AgentCard = ({
  agent,
  isInstalled,
  isTrialUsed = false,
  onInstall,
  onUninstall,
  onOpen,
  onUseTrial,
  showHoverDetails = false,
}: AgentCardProps) => {
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    setInstalled(isInstalled);
  }, [isInstalled]);

  const installLabel = useMemo(() => {
    if (installed) {
      return "Open";
    }
    return agent.kind === "bundle" || agent.requiresConnection ? "Connect" : "Get";
  }, [agent.kind, agent.requiresConnection, installed]);

  const detailContent = useMemo(() => getAgentDetailContent(agent.id), [agent.id]);
  const formattedInstalls = `${(agent.installCount / 1000).toFixed(1)}K`;

  const handleClick = async () => {
    if (installed) {
      onOpen(agent.id);
      return;
    }

    setLoading(true);
    try {
      await onInstall(agent.id);
      setInstalled(true);
    } catch (err) {
      console.error("Install failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    if (!installed || loading) return;
    setLoading(true);
    try {
      await onUninstall(agent.id);
      setInstalled(false);
    } catch (err) {
      console.error("Uninstall failed", err);
    } finally {
      setLoading(false);
    }
  };

  const actionButtonClass = installed
    ? "border border-primary/28 bg-primary/16 text-white hover:bg-primary/24 hover:shadow-[0_10px_24px_rgb(92_53_229/24%)]"
    : "bg-primary text-primary-foreground shadow-[0_10px_24px_rgb(107_76_255/34%)] hover:bg-primary/95 hover:shadow-[0_14px_28px_rgb(107_76_255/40%)]";

  const renderActionContent = () => {
    if (loading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
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

  const renderActionButton = () => (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {renderActionContent()}
    </button>
  );

  const handleUseTrial = async () => {
    const prompt = detailContent?.examplePrompt;
    if (!prompt || !onUseTrial || isTrialUsed || trialLoading) return;

    setTrialLoading(true);
    try {
      await onUseTrial(agent.id, prompt);
    } finally {
      setTrialLoading(false);
    }
  };

  const renderTrialButton = () => {
    const prompt = detailContent?.examplePrompt;
    const disabled = isTrialUsed || trialLoading || !prompt || !onUseTrial;

    return (
      <button
        onClick={handleUseTrial}
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${
          isTrialUsed
            ? "cursor-not-allowed border-white/8 bg-white/[0.04] text-white/35"
            : "border-primary/24 bg-white/[0.055] text-white/82 hover:border-primary/36 hover:bg-primary/12 hover:text-white hover:shadow-[0_10px_24px_rgb(92_53_229/18%)]"
        } disabled:opacity-70`}
      >
        {trialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isTrialUsed ? "Already used" : "Use now"}
      </button>
    );
  };

  return (
    <div
      className="group ui-surface relative flex flex-col overflow-hidden rounded-2xl p-3 transition-[background-color,border-color,box-shadow] duration-300 ease-out hover:border-primary/30 hover:bg-primary/8 hover:shadow-[0_18px_38px_rgb(92_53_229/24%)] focus-within:border-primary/30 focus-within:bg-primary/8 focus-within:shadow-[0_18px_38px_rgb(92_53_229/24%)]"
      style={{ minHeight: 152 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

      <div className="relative flex gap-4">
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#171a2c] p-2 transition-shadow group-hover:shadow-[0_8px_24px_rgb(92_53_229/28%)] group-focus-within:shadow-[0_8px_24px_rgb(92_53_229/28%)]">
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

          {showHoverDetails ? (
            <div className="mt-2 hidden min-h-[58px] space-y-2 md:block">
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
                <span aria-hidden="true">&middot;</span>
                <span>{formattedInstalls}</span>
              </div>
            </div>
          ) : (
            <div className="relative mt-2 hidden min-h-[58px] md:block">
              <div className="absolute inset-0 space-y-2 transition-opacity duration-200 group-hover:pointer-events-none group-hover:opacity-0 group-focus-within:pointer-events-none group-focus-within:opacity-0">
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
                  <span aria-hidden="true">&middot;</span>
                  <span>{formattedInstalls}</span>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-end opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                {renderActionButton()}
              </div>
            </div>
          )}
        </div>
      </div>

      {showHoverDetails ? (
        <div className="hidden grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out group-hover:mt-4 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-within:mt-4 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100 md:grid">
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/8 pt-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/8 bg-white/[0.035] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-white/35">
                    <Star className="h-3 w-3" />
                    Rating
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white/85">
                    {agent.rating.toFixed(1)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.035] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-white/35">
                    <Download className="h-3 w-3" />
                    Downloads
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white/85">
                    {formattedInstalls}
                  </div>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.035] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-white/35">
                    <Sparkles className="h-3 w-3" />
                    Uses
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white/85">
                    {detailContent?.useCases.length ?? agent.tags?.length ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-[12px] leading-[1.45] text-white/58">
                {(detailContent?.descriptionLines ?? [agent.description]).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              {detailContent?.useCases.length ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                    <Target className="h-3 w-3" />
                    Use cases
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailContent.useCases.map((useCase) => (
                      <span
                        key={useCase}
                        className="rounded-full border border-primary/18 bg-primary/10 px-2 py-1 text-[10px] font-medium text-white/68"
                      >
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-white/8 bg-black/18 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  <MessageSquareQuote className="h-3 w-3" />
                  Example prompt
                </div>
              <p className="text-[12px] leading-relaxed text-white/70">
                {detailContent?.examplePrompt ?? agent.description}
              </p>
            </div>

              <div className="mt-3">{renderTrialButton()}</div>
              <div className="mt-2">{renderActionButton()}</div>
              {installed ? (
                <button
                  onClick={handleUninstall}
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2 text-[12px] font-semibold text-white/48 transition hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove from account
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
          <span aria-hidden="true">&middot;</span>
          <span>{formattedInstalls}</span>
        </div>

        {renderActionButton()}
      </div>
    </div>
  );
};
