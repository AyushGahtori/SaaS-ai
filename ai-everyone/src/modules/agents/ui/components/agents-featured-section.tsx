"use client";
// Featured agents hero section — Microsoft Store inspired layout.
// 1 large card on the left, 2 smaller cards stacked on the right.

import type { Agent } from "@/lib/firestore-agents";
import { AgentCardFeatured } from "./agent-card-featured";

interface AgentsFeaturedSectionProps {
  agents: Agent[];
  installedAgentIds: string[];
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
}

export const AgentsFeaturedSection = ({
  agents,
  installedAgentIds,
  onInstall,
  onUninstall,
}: AgentsFeaturedSectionProps) => {
  if (agents.length === 0) return null;

  const hero = agents[0]!;
  const side = agents.slice(1, 3);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-white/95 tracking-tight">Featured</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Large hero card */}
        <AgentCardFeatured
          agent={hero}
          large
          isInstalled={installedAgentIds.includes(hero.id)}
          onInstall={onInstall}
          onUninstall={onUninstall}
        />

        {/* Two stacked smaller cards */}
        <div className="flex flex-col gap-4">
          {side.map((agent) => (
            <AgentCardFeatured
              key={agent.id}
              agent={agent}
              isInstalled={installedAgentIds.includes(agent.id)}
              onInstall={onInstall}
              onUninstall={onUninstall}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
