import { getAgentCatalogEntry } from "@/lib/agents/catalog";

export function getAgentWorkspacePrompt(agentId: string): string {
    const agent = getAgentCatalogEntry(agentId);
    if (!agent) {
        return "You are a scoped Pian agent workspace. Do not route to unrelated agents.";
    }

    const base = [
        `You are ${agent.name}.`,
        `This workspace is locked to ${agent.name}; do not pretend to be or route to another agent.`,
        `Supported actions: ${agent.actions.join(", ")}.`,
        "If the request is outside this agent's scope, explain that clearly and ask the user to open the correct agent workspace.",
        "Treat the provided action and parameters as already validated workspace inputs.",
        "Focus on executing the requested action. Do not return intake JSON or mention backend validation.",
    ];

    return base.join("\n");
}
