import { resolveAgentWorkspaceRequest } from "@/lib/agents/workspace-router";

const installedAgentIds = [
    "google-agent",
    "strata-agent",
    "startup-fundraising-agent",
    "smart-gtm-agent",
    "dia-helper-agent",
];

const accessibleAgentIds = installedAgentIds;

async function expectRoute(
    label: string,
    agentId: string,
    userInput: string,
    expectation: (result: Awaited<ReturnType<typeof resolveAgentWorkspaceRequest>>) => boolean
) {
    const result = await resolveAgentWorkspaceRequest({
        userId: "workspace-routing-verification",
        chatId: "workspace-routing-verification",
        agentId,
        userInput,
        model: "gemini-3-flash-preview",
        llmProvider: "gemini",
        installedAgentIds,
        accessibleAgentIds,
        recentMessages: [{ role: "user", content: userInput }],
    });

    if (!expectation(result)) {
        console.error(`[FAIL] ${label}`, result);
        process.exitCode = 1;
        return;
    }

    console.log(`[PASS] ${label}`);
}

async function main() {
    await expectRoute(
        "Funds workspace blocks Gmail inbox work",
        "startup-fundraising-agent",
        "read my last 5 gmail emails",
        (result) => !result.ok && result.status === "out_of_scope"
    );

    await expectRoute(
        "Smart GTM workspace blocks explicit ShopGenie correction",
        "smart-gtm-agent",
        "no pls use the shopgenie agent for this",
        (result) => !result.ok && result.status === "out_of_scope"
    );

    await expectRoute(
        "Stara workspace stays on Stara for Apple stock data",
        "strata-agent",
        "use the stara agent I need data of the apple stock",
        (result) =>
            result.ok &&
            result.agentId === "strata-agent" &&
            result.action === "ask" &&
            result.agentRequest.symbol === "AAPL"
    );

    await expectRoute(
        "Smart GTM workspace handles company URL GTM request",
        "smart-gtm-agent",
        "Analyze this company URL and build a go-to-market plan with audience, positioning, and channels. https://www.youtube.com/",
        (result) => result.ok && result.agentId === "smart-gtm-agent" && result.action === "go_to_market"
    );

    await expectRoute(
        "Dia Helper workspace generates diagrams without global routing",
        "dia-helper-agent",
        "create a low level diagram of youtube",
        (result) => result.ok && result.agentId === "dia-helper-agent" && result.action === "generate_diagram"
    );
}

main().catch((error) => {
    console.error("[FAIL] workspace routing verification crashed", error);
    process.exit(1);
});
