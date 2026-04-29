import { resolveAgentWorkspaceRequest } from "@/lib/agents/workspace-router";
import { verifyAllCatalogAgentsHaveIntakeSchemas } from "@/lib/agents/workspace-intake";

const installedAgentIds = [
    "google-agent",
    "strata-agent",
    "startup-fundraising-agent",
    "smart-gtm-agent",
    "dia-helper-agent",
    "career-switch-agent",
    "travel-halper-agent",
    "devika-engineer-agent",
];

const accessibleAgentIds = installedAgentIds;
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

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
    const missingIntakeSchemas = verifyAllCatalogAgentsHaveIntakeSchemas();
    if (missingIntakeSchemas.length > 0) {
        console.error("[FAIL] Missing workspace intake schemas", missingIntakeSchemas);
        process.exitCode = 1;
    } else {
        console.log("[PASS] All non-bundle catalog agents have intake schemas");
    }

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
            hasGeminiKey
                ? result.ok &&
                result.agentId === "strata-agent" &&
                result.action === "ask" &&
                Boolean(result.agentRequest.symbol)
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Smart GTM workspace handles company URL GTM request",
        "smart-gtm-agent",
        "Analyze this company URL and build a go-to-market plan with audience, positioning, and channels. https://www.youtube.com/",
        (result) =>
            hasGeminiKey
                ? result.ok && result.agentId === "smart-gtm-agent" && result.action === "go_to_market"
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Dia Helper workspace generates diagrams without global routing",
        "dia-helper-agent",
        "create a low level diagram of youtube",
        (result) =>
            hasGeminiKey
                ? result.ok && result.agentId === "dia-helper-agent" && result.action === "generate_diagram"
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Career Switch workspace asks for required intake before execution",
        "career-switch-agent",
        "hey can you help me in career switching ??",
        (result) =>
            !result.ok &&
            result.status === "needs_clarification" &&
            Array.isArray(result.meta?.missing_fields) &&
            result.meta.missing_fields.includes("current_role") &&
            result.meta.missing_fields.includes("target_role")
    );

    await expectRoute(
        "Career Switch workspace accepts complete intake",
        "career-switch-agent",
        "current role is customer support, target role is data analyst, skills are excel and sql, 2 years experience, education is BCom",
        (result) =>
            hasGeminiKey
                ? result.ok &&
                result.agentId === "career-switch-agent" &&
                result.action === "generate_plan" &&
                Boolean(result.agentRequest.current_role) &&
                Boolean(result.agentRequest.target_role)
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Travel workspace asks for missing trip details before execution",
        "travel-halper-agent",
        "help me plan a trip",
        (result) =>
            !result.ok &&
            result.status === "needs_clarification" &&
            Array.isArray(result.meta?.missing_fields) &&
            result.meta.missing_fields.includes("destination") &&
            result.meta.missing_fields.includes("budget")
    );

    await expectRoute(
        "Travel workspace accepts complete trip intake",
        "travel-halper-agent",
        "Plan a trip from Delhi to Goa for 4 days under 30000 INR with 2 travelers",
        (result) =>
            hasGeminiKey
                ? result.ok &&
                result.agentId === "travel-halper-agent" &&
                result.action === "plan_trip" &&
                typeof result.agentRequest.prompt === "string"
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Devika workspace accepts architecture planning prompts",
        "devika-engineer-agent",
        "Plan the architecture for a multi-tenant SaaS billing module",
        (result) =>
            hasGeminiKey
                ? result.ok &&
                result.agentId === "devika-engineer-agent" &&
                result.action === "plan_project" &&
                typeof result.agentRequest.prompt === "string"
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Devika workspace accepts repository intake",
        "devika-engineer-agent",
        "Onboard this repo: https://github.com/example-org/service-core",
        (result) =>
            hasGeminiKey
                ? result.ok &&
                result.agentId === "devika-engineer-agent" &&
                result.action === "repo_intake" &&
                typeof result.agentRequest.repositoryUrl === "string"
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Devika workspace accepts bug debugging prompts",
        "devika-engineer-agent",
        "Fix this bug: TypeError reading status from undefined.",
        (result) =>
            hasGeminiKey
                ? result.ok &&
                result.agentId === "devika-engineer-agent" &&
                result.action === "fix_bug" &&
                typeof result.agentRequest.errorLog === "string"
                : !result.ok && result.status === "needs_clarification"
    );

    await expectRoute(
        "Devika workspace can request live agent status without extra input",
        "devika-engineer-agent",
        "Show the Devika agent status for my recent runs.",
        (result) =>
            result.ok &&
            result.agentId === "devika-engineer-agent" &&
            result.action === "agent_status"
    );

    await expectRoute(
        "Devika workspace can request snapshot history without extra input",
        "devika-engineer-agent",
        "Show my recent Devika snapshots.",
        (result) =>
            result.ok &&
            result.agentId === "devika-engineer-agent" &&
            result.action === "list_snapshots"
    );

    if (!hasGeminiKey) {
        console.log("[INFO] GEMINI_API_KEY is not set; ready-state extraction checks used safe fallback expectations.");
    }
}

main().catch((error) => {
    console.error("[FAIL] workspace routing verification crashed", error);
    process.exit(1);
});
