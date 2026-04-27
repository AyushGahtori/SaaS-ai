import { agentDescriptionLines } from "./descriptions";
import { agentExamplePrompts } from "./example-prompts";
import { agentUseCases } from "./use-cases";
import type { AgentDetailContent } from "./types";

export function getAgentDetailContent(agentId: string): AgentDetailContent | undefined {
  const descriptionLines = agentDescriptionLines[agentId];
  const examplePrompt = agentExamplePrompts[agentId];
  const useCases = agentUseCases[agentId];

  if (!descriptionLines || !examplePrompt || !useCases) {
    return undefined;
  }

  return {
    descriptionLines,
    examplePrompt,
    useCases,
  };
}

export type { AgentDetailContent };

