"use client";
// All-agents responsive grid section.

import { useEffect, useMemo, useState } from "react";
import type { Agent } from "@/lib/firestore-agents";
import { AgentCard } from "./agent-card";

interface AgentsGridProps {
  agents: Agent[];
  installedAgentIds: string[];
  trialUsedAgentIds: string[];
  onInstall: (agentId: string) => Promise<void>;
  onUninstall: (agentId: string) => Promise<void>;
  onOpen: (agentId: string) => void;
  onUseTrial: (agentId: string, prompt: string) => Promise<void>;
  title?: string;
}

const getResponsiveColumnCount = () => {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
};

const useResponsiveColumnCount = () => {
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const updateColumnCount = () => setColumnCount(getResponsiveColumnCount());
    const smQuery = window.matchMedia("(min-width: 640px)");
    const lgQuery = window.matchMedia("(min-width: 1024px)");

    updateColumnCount();
    smQuery.addEventListener("change", updateColumnCount);
    lgQuery.addEventListener("change", updateColumnCount);

    return () => {
      smQuery.removeEventListener("change", updateColumnCount);
      lgQuery.removeEventListener("change", updateColumnCount);
    };
  }, []);

  return columnCount;
};

const distributeAgentsIntoColumns = (agents: Agent[], columnCount: number) => {
  const columns = Array.from({ length: columnCount }, () => [] as Agent[]);

  agents.forEach((agent, index) => {
    columns[index % columnCount]?.push(agent);
  });

  return columns;
};

export const AgentsGrid = ({
  agents,
  installedAgentIds,
  trialUsedAgentIds,
  onInstall,
  onUninstall,
  onOpen,
  onUseTrial,
  title = "All Agents",
}: AgentsGridProps) => {
  const columnCount = useResponsiveColumnCount();
  const agentColumns = useMemo(
    () => distributeAgentsIntoColumns(agents, columnCount),
    [agents, columnCount]
  );

  if (agents.length === 0) {
    return (
      <div className="ui-surface flex flex-col items-center justify-center rounded-2xl py-16 text-white/40">
        <p className="text-lg font-semibold">No agents found</p>
        <p className="mt-1 text-sm">Try adjusting your search</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-white/95 tracking-tight">{title}</h2>
      </div>

      <div className="grid grid-cols-1 items-start gap-x-6 sm:grid-cols-2 sm:gap-x-7 lg:grid-cols-3 xl:grid-cols-3">
        {agentColumns.map((columnAgents, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-col gap-5 sm:gap-6">
            {columnAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isInstalled={installedAgentIds.includes(agent.id)}
                isTrialUsed={trialUsedAgentIds.includes(agent.id)}
                onInstall={onInstall}
                onUninstall={onUninstall}
                onOpen={onOpen}
                onUseTrial={onUseTrial}
                showHoverDetails
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};
