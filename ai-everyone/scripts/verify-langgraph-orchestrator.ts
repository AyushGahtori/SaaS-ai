import { deterministicRoute } from "../src/lib/orchestrator/langgraph/registry";
import { resolveContextualEntities } from "../src/lib/orchestrator/langgraph/resolver";
import type {
    ConversationContext,
    LangGraphOrchestrationState,
    ResolvedEntities,
    RouteDecision,
} from "../src/lib/orchestrator/langgraph/types";

function assert(condition: unknown, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

const gmailContext: ConversationContext = {
    recent_messages: [],
    recent_agent_tasks: [],
    recent_agent_outputs: {
        gmail: {
            emails: [],
        },
    },
    entity_index: {
        gmail_emails: [
            {
                index: 1,
                id: "msg-1",
                message_id: "msg-1",
                kind: "gmail_email",
                agentId: "google-agent",
                action: "list_emails",
                sender: '"coderabbitai[bot]" <notifications@github.com>',
                subject: "Re: [AyushGahtori/SaaS-ai] feat: Rebuild agent orchestration",
            },
            {
                index: 2,
                id: "msg-2",
                message_id: "msg-2",
                kind: "gmail_email",
                agentId: "google-agent",
                action: "list_emails",
                sender: "Vercel <notifications@vercel.com>",
                subject: "Failed preview deployment on team Ayush's projects",
            },
            {
                index: 3,
                id: "msg-3",
                message_id: "msg-3",
                kind: "gmail_email",
                agentId: "google-agent",
                action: "list_emails",
                sender: "Vercel <notifications@vercel.com>",
                subject: "Preview deployment recovered",
            },
        ],
        drive_files: [],
        todo_tasks: [],
        generic_items: [],
    },
    last_agent_id: "google-agent",
    last_action: "list_emails",
    last_referenced_entity: {
        index: 2,
        id: "msg-2",
        message_id: "msg-2",
        kind: "gmail_email",
        agentId: "google-agent",
        action: "read_email",
        sender: "Vercel <notifications@vercel.com>",
        subject: "Failed preview deployment on team Ayush's projects",
    },
};

function stateFor(input: string, route: RouteDecision): LangGraphOrchestrationState {
    return {
        user_input: input,
        normalized_input: input,
        chat_id: "chat-test",
        user_id: "user-test",
        installed_agent_ids: ["google-agent", "strata-agent"],
        accessible_agent_ids: ["google-agent", "strata-agent"],
        conversation_context: gmailContext,
        route,
        resolved_entities: {
            entity_source: "none",
            message_id: null,
            row_index: null,
            subject: null,
            sender: null,
            thread_id: null,
            matched_entity: null,
            candidate_entities: [],
        },
        validation: {
            is_valid: false,
            missing_fields: [],
            clarification_needed: false,
        },
        agent_request: {},
        agent_response: null,
        created_task: null,
        final_response: "",
        status: "success",
        failure: null,
        metadata: {},
    };
}

function resolve(input: string): ResolvedEntities {
    const route = deterministicRoute(input, gmailContext);
    return resolveContextualEntities(stateFor(input, route));
}

const listRoute = deterministicRoute("retrieve my last 5 mails", gmailContext);
assert(listRoute.target_agent === "google-agent", "Gmail list should route to google-agent.");
assert(listRoute.target_action === "list_emails", "Gmail list should route to list_emails.");
assert(listRoute.parameters.limit === "5", "Gmail list should preserve requested count.");

const first = resolve("summarize the first one");
assert(first.message_id === "msg-1", "Ordinal follow-up should resolve row 1 to msg-1.");

const subject = resolve("summarize the email with subject Failed preview deployment");
assert(subject.message_id === "msg-2", "Subject follow-up should resolve the matching message ID.");

const contextual = resolve("summarize this one");
assert(contextual.message_id === "msg-2", "Contextual reference should resolve the last referenced Gmail row.");

const ambiguous = resolve("summarize the email from Vercel");
assert(!ambiguous.message_id, "Ambiguous sender should not invent a message ID.");
assert(ambiguous.candidate_entities?.length === 2, "Ambiguous sender should return the two Vercel candidates.");

const stara = deterministicRoute("use the stara agent and give me details about apple", gmailContext);
assert(stara.target_agent === "strata-agent", "Explicit Stara request should route to strata-agent.");
assert(stara.target_action === "ask", "Stara detail request should route to ask.");
assert(stara.parameters.symbol === "AAPL", "Stara Apple request should deterministically extract AAPL.");

const fundCorrection = deterministicRoute(
    "for this you have to use the funds agent Find seed investors for my B2B AI startup and draft the first outreach email.",
    gmailContext
);
assert(fundCorrection.target_agent === "startup-fundraising-agent", "Explicit Funds request must not route to Gmail.");
assert(fundCorrection.target_action === "plan_outreach", "Funds investor outreach request should route to outreach planning.");
assert(fundCorrection.parameters.startup_name === "B2B AI startup", "Funds route should extract the startup descriptor.");

const gtmUrl = deterministicRoute(
    "Analyze this company URL and build a go-to-market plan with audience, positioning, and channels. https://www.youtube.com/",
    gmailContext
);
assert(gtmUrl.target_agent === "smart-gtm-agent", "GTM URL request must not route to ShopGenie.");
assert(gtmUrl.target_action === "go_to_market", "GTM URL request should route to Smart GTM go_to_market.");

const explicitGtmCorrection = deterministicRoute(
    "no pls use the smart gtm agent for this Analyze this company URL and build a go-to-market plan with audience, positioning, and channels. https://www.youtube.com/",
    gmailContext
);
assert(explicitGtmCorrection.target_agent === "smart-gtm-agent", "Explicit Smart GTM correction must override unrelated keyword routes.");

const emergency = deterministicRoute("use the emergency agent pls for heart attack", gmailContext);
assert(emergency.target_agent === "emergency-response-agent", "Explicit emergency request should route to Emergency Response Agent.");
assert(emergency.parameters.description === "heart attack", "Emergency route should carry a usable description.");

const travelPlanner = deterministicRoute("I want to use the travel planner agent", gmailContext);
assert(travelPlanner.target_agent === "travel-halper-agent", "Explicit travel planner request must not route to Google Maps.");
assert(travelPlanner.target_action === "plan_trip", "Travel planner request should route to trip planning.");

const dayPlannerCorrection = deterministicRoute("sorry sorry I ment day planner", gmailContext);
assert(dayPlannerCorrection.target_agent === "day-planner-agent", "Explicit day planner correction should route to Day Planner.");

const seoOnly = deterministicRoute("ok lets leave that Seo agent pls", gmailContext);
assert(seoOnly.target_agent === "seo-agent", "Explicit SEO request should still route to SEO Agent.");
assert(!seoOnly.parameters.topic, "Bare SEO-agent selection must not turn the correction text into a fake topic.");

const diaGenerate = deterministicRoute("using the dia helper agent give me a low level diagram of youtube", gmailContext);
assert(diaGenerate.target_agent === "dia-helper-agent", "Explicit Dia Helper request should route to Dia Helper.");
assert(diaGenerate.target_action === "generate_diagram", "New Dia Helper diagram request should generate instead of update.");

console.log("LangGraph orchestrator deterministic checks passed.");
