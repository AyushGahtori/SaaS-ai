"use client";
// All-agents responsive grid section.

import type { Agent } from "@/lib/firestore-agents";
import { AgentCard } from "./agent-card";

interface AgentsGridProps {
  agents: Agent[];
  installedAgentIds: string[];
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
}

export const AgentsGrid = ({
  agents,
  installedAgentIds,
  onInstall,
  onUninstall,
}: AgentsGridProps) => {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30">
        <p className="text-lg font-semibold">No agents found</p>
        <p className="mt-1 text-sm">Try adjusting your search</p>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-white/95 tracking-tight">All Agents</h2>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isInstalled={installedAgentIds.includes(agent.id)}
            onInstall={onInstall}
            onUninstall={onUninstall}
          />
        ))}
      </div>
    </section>
  );
};
