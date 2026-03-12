"use client";
// Horizontal scrolling section for trending agents.

import type { Agent } from "@/lib/firestore-agents";
import { AgentCard } from "./agent-card";

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
  if (agents.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-white/95 tracking-tight">{title}</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
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
