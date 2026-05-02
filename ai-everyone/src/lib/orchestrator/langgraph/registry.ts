import {
    AGENT_CATALOG,
    getAgentCatalogEntry,
    type AgentCatalogEntry,
} from "@/lib/agents/catalog";
import {
    extractEmailAddress,
    getNumericRequestCount,
    includesAny,
    normalizeForMatch,
} from "./text";
import type { ConversationContext, RouteDecision } from "./types";

export interface AgentActionCapability {
    name: string;
    required: string[];
    optional: string[];
    entityType?: "gmail_email" | "drive_file" | "todo_task" | "generic";
    aliases?: string[];
}

export interface AgentCapability {
    id: string;
    name: string;
    route: string;
    provider: AgentCatalogEntry["provider"];
    requiresConnection: boolean;
    actions: Record<string, AgentActionCapability>;
    defaultAction: string;
    aliases: string[];
}

export const AGENT_ENDPOINTS: Record<string, string> = {
    "teams-agent": "/teams/action",
    "email-agent": "/email/action",
    "calendar-agent": "/calendar/action",
    "todo-agent": "/todo/action",
    "google-agent": "/google/action",
    "notion-agent": "/notion/action",
    "maps-agent": "/maps/action",
    "emergency-response-agent": "/emergency/action",
    "strata-agent": "/strata/action",
    "canva-agent": "/canva/action",
    "day-planner-agent": "/dayplanner/action",
    "discord-agent": "/discord/action",
    "dropbox-agent": "/dropbox/action",
    "freshdesk-agent": "/freshdesk/action",
    "github-agent": "/github/action",
    "gitlab-agent": "/gitlab/action",
    "greenhouse-agent": "/greenhouse/action",
    "jira-agent": "/jira/action",
    "linkedin-agent": "/linkedin/action",
    "zoom-agent": "/zoom/action",
    "dia-helper-agent": "/diahelper/action",
    "shopgenie-agent": "/shopgenie/action",
    "career-switch-agent": "/career-switch/action",
    "startup-fundraising-agent": "/fundraising/action",
    "smart-gtm-agent": "/smartgtm/action",
    "seo-agent": "/seo/action",
    "dashboard-designer-agent": "/dashboarddesigner/action",
    "ats-agent": "/ats/action",
    "building-construction-agent": "/building/action",
    "lms-agent": "/lms/action",
    "travel-halper-agent": "/travelhalper/action",
    "restaurant-concierge-agent": "/restaurant/action",
    "devika-engineer-agent": "/devika/action",
    "data-analyst-agent": "/dataanalyst/action",
    "cyber-soc-agent": "/cybersoc/action",
    "shelfie-grocery-agent": "/shelfie/action",
    "leadgen-agent": "/leadgen/action",
    "marketing-agent": "/marketing/action",
    "aria-podcast-agent": "/aria/action",
    "pr-copilot-review-agent": "/pr-copilot/action",
    "pian-labs-alos-agent": "/alos/action",
};

const EXTRA_ACTIONS: Record<string, Record<string, AgentActionCapability>> = {
    "google-agent": {
        list_emails: { name: "list_emails", required: ["agent_type"], optional: ["parameters", "limit", "count", "maxResults"], entityType: "gmail_email" },
        read_email: { name: "read_email", required: ["agent_type", "message_id"], optional: ["parameters"], entityType: "gmail_email" },
        search_emails: { name: "search_emails", required: ["agent_type", "parameters"], optional: ["limit", "count"], entityType: "gmail_email" },
        send_email: { name: "send_email", required: ["agent_type", "parameters"], optional: ["to", "subject", "body"] },
        reply_email: { name: "reply_email", required: ["agent_type", "message_id", "parameters"], optional: [] },
        mark_as_read: { name: "mark_as_read", required: ["agent_type", "message_id"], optional: ["parameters"], entityType: "gmail_email" },
        list_files: { name: "list_files", required: ["agent_type"], optional: ["parameters", "limit", "count", "maxResults"], entityType: "drive_file" },
        list_pdf_files: { name: "list_pdf_files", required: ["agent_type"], optional: ["parameters", "limit", "count", "maxResults"], entityType: "drive_file" },
        read_file: { name: "read_file", required: ["agent_type", "file_id"], optional: ["parameters"], entityType: "drive_file" },
        search_files: { name: "search_files", required: ["agent_type", "parameters"], optional: ["limit", "count"], entityType: "drive_file" },
        list_events: { name: "list_events", required: ["agent_type"], optional: ["parameters"] },
        create_event: { name: "create_event", required: ["agent_type", "parameters"], optional: [] },
        create_meet: { name: "create_meet", required: ["agent_type", "parameters"], optional: [] },
        list_tasks: { name: "list_tasks", required: ["agent_type"], optional: ["parameters"] },
        create_task: { name: "create_task", required: ["agent_type", "parameters"], optional: [] },
        web_search: { name: "web_search", required: ["agent_type", "parameters"], optional: [] },
    },
    "strata-agent": {
        ask: { name: "ask", required: ["question"], optional: ["symbol"] },
    },
    "restaurant-concierge-agent": {
        run_restaurant_concierge: { name: "run_restaurant_concierge", required: ["prompt"], optional: ["message", "query"] },
        browse_menu: { name: "browse_menu", required: [], optional: ["category", "dietaryFilter"] },
        search_menu: { name: "search_menu", required: ["query"], optional: ["prompt"] },
        get_item_details: { name: "get_item_details", required: ["itemName"], optional: ["prompt"] },
        get_recommendations: { name: "get_recommendations", required: [], optional: [] },
        get_order_summary: { name: "get_order_summary", required: [], optional: [] },
        get_session_analytics: { name: "get_session_analytics", required: [], optional: [] },
        reset_session: { name: "reset_session", required: [], optional: [] },
        suggest_items: { name: "suggest_items", required: ["query"], optional: ["prompt"] },
        request_human_help: { name: "request_human_help", required: ["reason"], optional: [] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
    "shelfie-grocery-agent": {
        run_shelfie_grocery_agent: { name: "run_shelfie_grocery_agent", required: ["prompt"], optional: ["message", "query", "session_id"] },
        get_history: { name: "get_history", required: ["session_id"], optional: ["sessionId", "chatId"] },
        list_sessions: { name: "list_sessions", required: [], optional: ["limit"] },
        reset_session: { name: "reset_session", required: ["session_id"], optional: ["sessionId", "chatId"] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
    "leadgen-agent": {
        run_leadgen: { name: "run_leadgen", required: ["prompt"], optional: ["message", "query", "session_id"] },
        list_leads: { name: "list_leads", required: [], optional: ["session_id", "limit", "skip"] },
        get_history: { name: "get_history", required: ["session_id"], optional: ["sessionId", "chatId"] },
        clear_session: { name: "clear_session", required: ["session_id"], optional: ["sessionId", "chatId"] },
        new_session: { name: "new_session", required: [], optional: [] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
    "marketing-agent": {
        run_marketing_agent: { name: "run_marketing_agent", required: ["prompt"], optional: ["message", "query", "session_id", "product_name", "brand_guidelines", "image_base64", "file_data_url"] },
        generate_campaign: { name: "generate_campaign", required: ["prompt"], optional: ["session_id", "product_name", "brand_guidelines"] },
        analyze_product: { name: "analyze_product", required: ["prompt"], optional: ["session_id", "image_base64", "file_data_url"] },
        edit_poster: { name: "edit_poster", required: ["prompt"], optional: ["session_id", "image_base64", "file_data_url"] },
        list_sessions: { name: "list_sessions", required: [], optional: ["limit"] },
        get_history: { name: "get_history", required: ["session_id"], optional: ["limit"] },
        get_product_analysis: { name: "get_product_analysis", required: ["session_id"], optional: [] },
        save_product_analysis: { name: "save_product_analysis", required: ["session_id", "analysis"], optional: [] },
        list_providers: { name: "list_providers", required: [], optional: [] },
        switch_provider: { name: "switch_provider", required: ["provider"], optional: [] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
    "aria-podcast-agent": {
        chat: { name: "chat", required: ["prompt"], optional: ["message", "query", "session_id", "mode"] },
        creator_script: { name: "creator_script", required: ["prompt"], optional: ["session_id"] },
        host_conversation: { name: "host_conversation", required: ["prompt"], optional: ["session_id"] },
        switch_mode: { name: "switch_mode", required: ["mode"], optional: ["session_id"] },
        voice_input: { name: "voice_input", required: ["audio_base64"], optional: ["session_id", "mime_type"] },
        text_to_speech: { name: "text_to_speech", required: ["text"], optional: ["prompt", "message"] },
        get_history: { name: "get_history", required: ["session_id"], optional: [] },
        clear_history: { name: "clear_history", required: ["session_id"], optional: [] },
        list_sessions: { name: "list_sessions", required: [], optional: ["limit"] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
    "pr-copilot-review-agent": {
        review_pr: { name: "review_pr", required: ["repo", "pr_number"], optional: ["dry_run", "repository", "repository_full_name"] },
        dry_run_review: { name: "dry_run_review", required: ["repo", "pr_number"], optional: ["repository", "repository_full_name"] },
        webhook_status: { name: "webhook_status", required: [], optional: [] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
    "pian-labs-alos-agent": {
        run_alos: { name: "run_alos", required: ["prompt"], optional: ["message", "query"] },
        describe_workspace: { name: "describe_workspace", required: [], optional: [] },
        summarize_entity: { name: "summarize_entity", required: ["entity"], optional: ["limit"] },
        list_records: { name: "list_records", required: ["entity"], optional: ["limit", "filters"] },
        create_record: { name: "create_record", required: ["entity", "record"], optional: [] },
        update_records: { name: "update_records", required: ["entity", "filters", "updates"], optional: [] },
        check_route_weather: { name: "check_route_weather", required: ["origin", "destination"], optional: [] },
        onboard_csv: { name: "onboard_csv", required: ["entity", "csv_text"], optional: [] },
        onboard_excel: { name: "onboard_excel", required: ["file_data_url"], optional: [] },
        pull_rest_api: { name: "pull_rest_api", required: ["url", "entity"], optional: ["json_path"] },
        clone_mongo: { name: "clone_mongo", required: ["source_mongodb_uri", "source_database"], optional: ["collections", "limit"] },
        start_empty: { name: "start_empty", required: [], optional: [] },
        ask_user: { name: "ask_user", required: ["question"], optional: [] },
        list_capabilities: { name: "list_capabilities", required: [], optional: [] },
    },
};

const DEFAULT_REQUIRED_BY_ACTION: Record<string, string[]> = {
    send_message: ["contact", "message"],
    schedule_meeting: ["title", "attendees", "date", "time", "notification_preference"],
    make_call: ["contact"],
    add_task: ["title"],
    add_to_plan: ["title"],
    list_tasks_by_date: ["datetime"],
    delete_task: ["title"],
    mark_done: ["title"],
    get_directions: ["origin", "destination"],
    search_places: ["query"],
    geocode: ["address"],
    distance_matrix: ["origins", "destinations"],
    assess_emergency: ["description"],
    activate_emergency: ["lat", "lng"],
    search_pages: ["query"],
    get_page: ["pageId"],
    create_page: ["title", "content"],
    append_to_page: ["pageId", "content"],
    create_design: ["title"],
    create_folder: ["path"],
    move_file: ["from_path", "to_path"],
    create_ticket: ["subject", "description"],
    check_ticket_status: ["ticket_id"],
    search_solutions: ["keyword"],
    search_repositories: ["query"],
    get_issue: ["owner", "repo", "issueNumber"],
    create_issue: ["owner", "repo", "title"],
    get_candidate_resume: ["candidate_id"],
    schedule_interview: ["candidate_id", "interviewer_email", "start_time", "end_time"],
    get_issue_status: ["issue_key"],
    search_issues: ["jql"],
    schedule_post: ["content"],
    create_meeting: ["topic"],
    get_meeting_summary: ["meetingId"],
    send_plan_email: ["receiverEmail"],
    generate_diagram: ["prompt"],
    update_diagram: ["editInstruction"],
    recommend_product: ["query"],
    shop_search: ["query"],
    run_shopgenie: ["query"],
    search_investors: ["startup_name"],
    plan_outreach: ["startup_name"],
    track_conversation: ["startup_name", "investor_name", "update"],
    term_sheet_guidance: ["startup_name"],
    generate_fundraising_plan: ["startup_name"],
    research_company: ["company_url"],
    go_to_market: ["company_url"],
    channel: ["company_url"],
    generate_brief: ["topic"],
    audit: ["url"],
    optimize_article: ["topic"],
    design_dashboard: ["prompt"],
    refine_dashboard: ["prompt"],
    update_dashboard: ["prompt"],
    analyze_candidate: ["resumeText"],
    save_interview_transcript: ["transcript"],
    compare_candidates: ["candidates"],
    learner_detail: ["learnerName"],
    generate_plan: ["prompt"],
    plan_trip: ["prompt"],
    run_devika_agent: ["prompt"],
    plan_project: ["prompt"],
    research_plan: ["prompt"],
    implement_feature: ["featureRequest"],
    fix_bug: ["errorLog"],
    run_project: ["prompt"],
    deploy_project: ["prompt"],
    generate_report: ["prompt"],
    answer_question: ["question"],
    repo_intake: ["repositoryUrl"],
    browser_strategy: ["prompt"],
    token_estimate: ["prompt"],
    monitor: ["data"],
    autonomous: ["goal"],
    analyze_log: ["log"],
    run_restaurant_concierge: ["prompt"],
    search_menu: ["query"],
    get_item_details: ["itemName"],
    suggest_items: ["query"],
    request_human_help: ["reason"],
    run_shelfie_grocery_agent: ["prompt"],
    get_history: ["session_id"],
    reset_session: ["session_id"],
    run_leadgen: ["prompt"],
    run_marketing_agent: ["prompt"],
    generate_campaign: ["prompt"],
    analyze_product: ["prompt"],
    edit_poster: ["prompt"],
    get_product_analysis: ["session_id"],
    save_product_analysis: ["session_id", "analysis"],
    chat: ["prompt"],
    creator_script: ["prompt"],
    host_conversation: ["prompt"],
    text_to_speech: ["text"],
    review_pr: ["repo", "pr_number"],
    dry_run_review: ["repo", "pr_number"],
    run_alos: ["prompt"],
    summarize_entity: ["entity"],
    list_records: ["entity"],
    create_record: ["entity", "record"],
    update_records: ["entity", "filters", "updates"],
    check_route_weather: ["origin", "destination"],
    onboard_csv: ["entity", "csv_text"],
    onboard_excel: ["file_data_url"],
    pull_rest_api: ["url", "entity"],
    clone_mongo: ["source_mongodb_uri", "source_database"],
    ask_user: ["question"],
};

const ACTIONS_WITH_PROMPT_FALLBACK = new Set([
    "generate_plan",
    "generate_brief",
    "design_dashboard",
    "refine_dashboard",
    "update_dashboard",
    "plan_trip",
    "recommend_product",
    "shop_search",
    "run_shopgenie",
    "ask",
    "generate_diagram",
    "run_devika_agent",
    "plan_project",
    "research_plan",
    "implement_feature",
    "run_project",
    "deploy_project",
    "generate_report",
    "answer_question",
    "autonomous",
    "run_restaurant_concierge",
    "suggest_items",
    "run_shelfie_grocery_agent",
    "run_leadgen",
    "run_marketing_agent",
    "generate_campaign",
    "analyze_product",
    "edit_poster",
    "chat",
    "creator_script",
    "host_conversation",
    "run_alos",
]);

function makeAliases(agent: AgentCatalogEntry): string[] {
    const base = [
        agent.id,
        agent.id.replace(/-agent$/i, ""),
        agent.name,
        agent.name.replace(/\s+agent$/i, ""),
    ];

    if (agent.id === "strata-agent") base.push("stara", "strata", "finance analytics");
    if (agent.id === "google-agent") base.push("gmail", "google mail", "google drive", "google calendar", "google meet", "google tasks");
    if (agent.id === "travel-halper-agent") base.push("travel helper", "travel halper", "travel planner", "trip planner");
    if (agent.id === "restaurant-concierge-agent") base.push("restaurant concierge", "restaurant agent", "food ordering", "menu ordering");
    if (agent.id === "shelfie-grocery-agent") base.push("shelfie", "grocery agent", "grocery assistant", "shopping list agent");
    if (agent.id === "leadgen-agent") base.push("leadgen", "lead gen", "lead generation", "sales leads", "prospecting");
    if (agent.id === "marketing-agent") base.push("marketing", "campaign agent", "poster agent", "creative agent", "brand agent");
    if (agent.id === "aria-podcast-agent") base.push("aria", "podcast agent", "podcast host", "podcast script", "voice show");
    if (agent.id === "pr-copilot-review-agent") base.push("pr copilot", "pr review", "pull request reviewer", "code review agent");
    if (agent.id === "pian-labs-alos-agent") base.push("alos", "pian labs alos", "logistics operations", "shipment operations");
    if (agent.id === "dia-helper-agent") base.push("dia", "diagram helper", "mermaid");
    if (agent.id === "shopgenie-agent") base.push("shop genie", "shopping");
    if (agent.id === "todo-agent") base.push("todo", "to do", "reminder", "reminders");
    if (agent.id === "startup-fundraising-agent") base.push("fund", "funds", "fund agent", "funds agent", "fundraising agent", "investor agent");
    if (agent.id === "smart-gtm-agent") base.push("smart gtm", "smart gtm agent", "gtm agent", "go to market agent", "go-to-market agent");
    if (agent.id === "emergency-response-agent") base.push("emergency agent", "emergency response", "medical emergency agent");
    if (agent.id === "day-planner-agent") base.push("day planner", "daily planner", "planner agent");
    if (agent.id === "dashboard-designer-agent") base.push("dashboard designer", "dashboard designer agent");
    if (agent.id === "cyber-soc-agent") base.push("cyber soc", "cyber soc agent", "soc agent", "security operations center");

    return Array.from(new Set(base.map((alias) => normalizeForMatch(alias)).filter(Boolean)));
}

function makeCapabilities(agent: AgentCatalogEntry): AgentCapability {
    const actions: Record<string, AgentActionCapability> = {};
    for (const action of agent.actions) {
        actions[action] = {
            name: action,
            required: DEFAULT_REQUIRED_BY_ACTION[action] || [],
            optional: [],
        };
    }

    for (const [action, capability] of Object.entries(EXTRA_ACTIONS[agent.id] || {})) {
        actions[action] = capability;
    }

    if (!actions.list_capabilities) {
        actions.list_capabilities = {
            name: "list_capabilities",
            required: [],
            optional: [],
        };
    }

    const defaultAction =
        agent.id === "google-agent"
            ? "list_emails"
            : agent.id === "strata-agent"
                ? "ask"
                : agent.actions[0] || "ask";

    return {
        id: agent.id,
        name: agent.name,
        route: AGENT_ENDPOINTS[agent.id],
        provider: agent.provider,
        requiresConnection: agent.requiresConnection,
        actions,
        defaultAction,
        aliases: makeAliases(agent),
    };
}

export const AGENT_CAPABILITY_REGISTRY: Record<string, AgentCapability> =
    Object.fromEntries(AGENT_CATALOG.map((agent) => [agent.id, makeCapabilities(agent)]));

export function getAgentCapability(agentId: string): AgentCapability | null {
    return AGENT_CAPABILITY_REGISTRY[agentId] || null;
}

export function getActionCapability(agentId: string, action: string): AgentActionCapability | null {
    return getAgentCapability(agentId)?.actions[action] || null;
}

function baseParams(text: string): Record<string, unknown> {
    return { prompt: text, parameters: text };
}

function googleIntent(agentType: string, action: string, text: string, reason: string): RouteDecision {
    const count = getNumericRequestCount(text);
    const parameters: Record<string, unknown> = {
        agent_type: agentType,
        parameters: text,
        strict_resolution: true,
    };
    if (count && count > 0) {
        const limit = String(Math.min(count, 20));
        parameters.limit = limit;
        parameters.count = limit;
        parameters.maxResults = limit;
        parameters.pageSize = limit;
    }
    return {
        target_agent: "google-agent",
        target_action: action,
        route_confidence: "high",
        route_reason: reason,
        parameters,
        is_agent_request: true,
    };
}

function simpleIntent(agentId: string, action: string, text: string, reason: string, parameters: Record<string, unknown> = {}): RouteDecision {
    return {
        target_agent: agentId,
        target_action: action,
        route_confidence: "high",
        route_reason: reason,
        parameters: { ...baseParams(text), ...parameters },
        is_agent_request: true,
    };
}

function noRoute(reason = "No deterministic agent route matched."): RouteDecision {
    return {
        target_agent: null,
        target_action: null,
        route_confidence: "low",
        route_reason: reason,
        parameters: {},
        is_agent_request: false,
    };
}

function inferGmailAction(lower: string): string {
    if (/\b(mark|archive)\b.*\b(read|seen)\b/.test(lower)) return "mark_as_read";
    if (/\b(reply|respond)\b/.test(lower)) return "reply_email";
    if (/\b(search|find)\b/.test(lower)) return "search_emails";
    if (/\b(send|compose|mail|email)\b/.test(lower) && /\b(to|@)\b/.test(lower)) return "send_email";
    if (/\b(summarize|summarise|summary|read|open)\b/.test(lower) && getNumericRequestCount(lower) === null) return "read_email";
    return "list_emails";
}

function inferDriveAction(lower: string): string {
    if (/\b(search|find)\b/.test(lower)) return "search_files";
    if (/\b(read|summarize|summarise|summary|open)\b/.test(lower) && getNumericRequestCount(lower) === null) return "read_file";
    if (/\bpdf|pdfs\b/.test(lower)) return "list_pdf_files";
    return "list_files";
}

function extractSymbol(text: string): string | undefined {
    const companySymbols: Record<string, string> = {
        apple: "AAPL",
        microsoft: "MSFT",
        google: "GOOGL",
        alphabet: "GOOGL",
        amazon: "AMZN",
        tesla: "TSLA",
        meta: "META",
        facebook: "META",
        nvidia: "NVDA",
    };
    const lower = normalizeForMatch(text);
    for (const [name, symbol] of Object.entries(companySymbols)) {
        if (new RegExp(`\\b${name}\\b`).test(lower)) return symbol;
    }
    const ticker = text.match(/\b[A-Z]{2,5}\b/);
    return ticker?.[0];
}

function extractUrl(text: string): string | undefined {
    return text.match(/https?:\/\/[^\s)]+/i)?.[0];
}

function aliasRegex(alias: string): RegExp {
    const escaped = alias
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\ /g, "[\\s-]+");
    return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`);
}

const BROAD_STANDALONE_ALIASES = new Set([
    "email",
    "calendar",
    "maps",
    "map",
    "travel",
    "fund",
    "funds",
    "gtm",
    "dia",
    "seo",
    "ats",
    "lms",
    "todo",
    "shopping",
]);

function isExplicitAliasMatch(alias: string, lower: string): boolean {
    if (!alias) return false;
    if (BROAD_STANDALONE_ALIASES.has(alias)) {
        return aliasRegex(`${alias} agent`).test(lower);
    }
    return aliasRegex(alias).test(lower);
}

function findExplicitAgentMention(lower: string): AgentCapability | null {
    for (const capability of Object.values(AGENT_CAPABILITY_REGISTRY)) {
        const mentioned = capability.aliases.some((alias) => isExplicitAliasMatch(alias, lower));
        if (mentioned) return capability;
    }
    return null;
}

function stripExplicitAgentCommand(text: string, capability: AgentCapability): string {
    let cleaned = text;
    for (const alias of capability.aliases.sort((a, b) => b.length - a.length)) {
        const escaped = alias
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\\ /g, "[\\s-]+");
        cleaned = cleaned.replace(
            new RegExp(`\\b(?:use|using|ask|run|route(?:\\s+to)?|switch(?:\\s+to)?|try|activate)?\\s*(?:the\\s+)?${escaped}(?:\\s+agent)?\\b`, "ig"),
            " "
        );
    }
    return cleaned
        .replace(/\b(?:hey|hi|hello|please|pls|no|nope|sorry|actually|i meant|i ment|i want to|for this|you have to|can you|could you|would you|ok|okay|lets|let's|leave that)\b/gi, " ")
        .replace(/^\s*(?:for|to|with)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function routeByExplicitAgentMention(text: string, lower: string): RouteDecision | null {
    const capability = findExplicitAgentMention(lower);
    if (!capability) return null;

    const taskText = stripExplicitAgentCommand(text, capability);

    if (capability.id === "google-agent") {
        const routingText = taskText || text;
        if (/\b(gmail|email|emails|mail|mails|inbox|message|messages)\b/.test(lower)) {
            return googleIntent("gmail", inferGmailAction(lower), routingText, `Matched explicit ${capability.name} mention.`);
        }
        if (/\b(drive|docs?|documents?|files?|folder|folders|pdf|pdfs)\b/.test(lower)) {
            return googleIntent("drive", inferDriveAction(lower), routingText, `Matched explicit ${capability.name} mention.`);
        }
        if (/\b(calendar|agenda|events?)\b/.test(lower)) {
            return googleIntent("calendar", /\b(create|schedule|add|book)\b/.test(lower) ? "create_event" : "list_events", routingText, `Matched explicit ${capability.name} mention.`);
        }
        if (/\b(meet|meeting link|video call)\b/.test(lower)) {
            return googleIntent("meet", "create_meet", routingText, `Matched explicit ${capability.name} mention.`);
        }
        return googleIntent("gmail", inferGmailAction(lower), routingText, `Matched explicit ${capability.name} mention.`);
    }

    if (capability.id === "strata-agent") {
        const symbol = extractSymbol(text);
        const action = /\b(workspace|open)\b/.test(lower)
            ? "open_workspace"
            : /\b(dashboard|snapshot)\b/.test(lower)
                ? "dashboard"
                : /\b(trend|forecast)\b/.test(lower)
                    ? "trends"
                    : /\b(category|categories|breakdown)\b/.test(lower)
                        ? "categories"
                        : /\b(insight|why|explain|detail|details|price|process|data)\b/.test(lower)
                            ? "ask"
                            : capability.defaultAction;
        return simpleIntent(capability.id, action, taskText, `Matched explicit ${capability.name} mention.`, {
            ...(taskText ? { question: taskText } : {}),
            ...(symbol ? { symbol } : {}),
            explicit_agent_mention: capability.id,
            raw_user_input: text,
        });
    }

    if (capability.id === "startup-fundraising-agent") {
        const route = routeFundraisingIntent(taskText, lower, `Matched explicit ${capability.name} mention.`);
        route.parameters = {
            ...route.parameters,
            explicit_agent_mention: capability.id,
            raw_user_input: text,
        };
        return route;
    }

    if (capability.id === "smart-gtm-agent") {
        const route = routeSmartGtmIntent(taskText, lower, `Matched explicit ${capability.name} mention.`);
        route.parameters = {
            ...route.parameters,
            explicit_agent_mention: capability.id,
            raw_user_input: text,
        };
        return route;
    }

    if (capability.id === "emergency-response-agent") {
        const route = routeEmergencyIntent(taskText || text, `Matched explicit ${capability.name} mention.`);
        route.parameters = {
            ...route.parameters,
            explicit_agent_mention: capability.id,
            raw_user_input: text,
        };
        return route;
    }

    const action = chooseActionForAgent(capability.id, lower);
    return simpleIntent(capability.id, action, taskText, `Matched explicit ${capability.name} mention.`, {
        explicit_agent_mention: capability.id,
        raw_user_input: text,
    });
}

function routeByRecentCorrection(text: string, lower: string, context?: ConversationContext): RouteDecision | null {
    if (findExplicitAgentMention(lower)) return null;
    if (!/\b(this|that|same|again|retry|try again|redo|do it|use that|for this)\b/.test(lower)) return null;

    const messages = [...(context?.recent_messages || [])].reverse();
    for (const message of messages) {
        if (message.role !== "user") continue;
        const messageLower = normalizeForMatch(message.content);
        if (!/\b(no|nope|wrong|instead|use|switch|i meant|for this|try again|redo)\b/.test(messageLower)) continue;
        const capability = findExplicitAgentMention(messageLower);
        if (!capability) continue;
        const action = chooseActionForAgent(capability.id, lower);
        return simpleIntent(capability.id, action, text, `Matched recent correction to ${capability.name}.`, {
            correction_agent_mention: capability.id,
            correction_source: message.content,
        });
    }

    return null;
}

export function chooseActionForAgent(agentId: string, lower: string): string {
    const capability = getAgentCapability(agentId);
    if (
        capability?.actions.list_capabilities &&
        /\b(capabilities|what can you do|what can you help|what do you do|supported actions|supported functions|functions)\b/.test(lower)
    ) {
        return "list_capabilities";
    }

    switch (agentId) {
        case "teams-agent":
            if (/\b(schedule|meeting|calendar)\b/.test(lower)) return "schedule_meeting";
            if (/\b(call|phone)\b/.test(lower)) return "make_call";
            return "send_message";
        case "email-agent":
            if (/\b(send|compose)\b/.test(lower)) return "send_email";
            if (/\b(search|find)\b/.test(lower)) return "search_emails";
            if (/\b(reply)\b/.test(lower)) return "reply_to_email";
            if (/\b(summarize|summary|read|open)\b/.test(lower)) return "read_email";
            return "read_inbox";
        case "calendar-agent":
            if (/\b(create|schedule|add|book)\b/.test(lower)) return "create_calendar_event";
            if (/\b(conflict|free|available)\b/.test(lower)) return "check_conflicts";
            return "get_calendar_events";
        case "todo-agent":
            if (/\b(done|complete|finished)\b/.test(lower)) return "mark_done";
            if (/\b(delete|remove)\b/.test(lower)) return "delete_task";
            if (/\b(list|show|what)\b/.test(lower)) return "list_tasks";
            return "add_task";
        case "day-planner-agent":
            if (/\b(week|weekly)\b/.test(lower)) return "get_weekly_overview";
            if (/\b(add|put|schedule)\b/.test(lower)) return "add_to_plan";
            return "get_daily_plan";
        case "maps-agent":
            if (/\b(direction|route|navigate|from .+ to )\b/.test(lower)) return "get_directions";
            if (/\b(distance|how far|travel time)\b/.test(lower)) return "distance_matrix";
            if (/\b(geocode|coordinates|lat|lng)\b/.test(lower)) return "geocode";
            return "search_places";
        case "freshdesk-agent":
            if (/\b(status|ticket #?\d+)\b/.test(lower)) return "check_ticket_status";
            if (/\b(solution|kb|knowledge)\b/.test(lower)) return "search_solutions";
            if (/\b(list|recent)\b/.test(lower)) return "list_tickets";
            return "create_ticket";
        case "github-agent":
            if (/\b(create|open)\b.*\bissue\b/.test(lower)) return "create_issue";
            if (/\bissue\b.*#?\d+/.test(lower)) return "get_issue";
            if (/\b(search|find)\b/.test(lower)) return "search_repositories";
            return "list_repositories";
        case "gitlab-agent":
            if (/\b(create|open)\b.*\bissue\b/.test(lower)) return "create_issue";
            if (/\bissue\b.*#?\d+/.test(lower)) return "get_issue";
            return "list_projects";
        case "jira-agent":
            if (/\b(create|open)\b.*\b(issue|bug|task|story)\b/.test(lower)) return "create_issue";
            if (/\bstatus\b|\b[A-Z][A-Z0-9]+-\d+\b/.test(lower)) return "get_issue_status";
            if (/\b(search|jql)\b/.test(lower)) return "search_issues";
            return "list_issues";
        case "linkedin-agent":
            if (/\b(analy[sz]e|engagement)\b/.test(lower)) return "analyze_engagement";
            return "schedule_post";
        case "zoom-agent":
            if (/\b(summary|transcript)\b/.test(lower)) return "get_meeting_summary";
            if (/\b(list|upcoming)\b/.test(lower)) return "list_upcoming_meetings";
            return "create_meeting";
        case "seo-agent":
            if (/\b(audit|review)\b/.test(lower) && extractUrl(lower)) return "audit";
            if (/\b(optimi[sz]e|improve)\b/.test(lower)) return "optimize_article";
            return "generate_brief";
        case "smart-gtm-agent":
            if (/\b(channel)\b/.test(lower)) return "channel";
            if (/\b(gtm|go to market|go-to-market)\b/.test(lower)) return "go_to_market";
            return "research_company";
        case "startup-fundraising-agent":
            if (/\b(investor|investors)\b/.test(lower) && /\b(find|search|list)\b/.test(lower)) return "search_investors";
            if (/\b(outreach|email|message)\b/.test(lower)) return "plan_outreach";
            if (/\b(term sheet)\b/.test(lower)) return "term_sheet_guidance";
            if (/\b(track|update|follow up)\b/.test(lower)) return "track_conversation";
            return "generate_fundraising_plan";
        case "devika-engineer-agent":
            if (/\b(repo|repository)\b/.test(lower) && extractUrl(lower)) return "repo_intake";
            if (/\b(agent status|status summary|health|run summary)\b/.test(lower)) return "agent_status";
            if (/\b(snapshot|snapshots|history|recent runs|recent executions)\b/.test(lower)) return "list_snapshots";
            if (/\b(token|tokens|estimate tokens|token estimate)\b/.test(lower)) return "token_estimate";
            if (/\b(browser|website flow|ui flow|click through|form flow)\b/.test(lower)) return "browser_strategy";
            if (/\b(research|best practice|best practices|compare approaches)\b/.test(lower)) return "research_plan";
            if (/\b(fix|bug|error|stack trace)\b/.test(lower)) return "fix_bug";
            if (/\b(implement|build feature)\b/.test(lower)) return "implement_feature";
            if (/\b(deploy|release)\b/.test(lower)) return "deploy_project";
            if (/\b(run|start)\b/.test(lower)) return "run_project";
            if (/\b(report)\b/.test(lower)) return "generate_report";
            return "plan_project";
        case "restaurant-concierge-agent":
            if (/\b(reset|start over|clear session|new order)\b/.test(lower)) return "reset_session";
            if (/\b(human|manager|complaint|escalate|support)\b/.test(lower)) return "request_human_help";
            if (/\b(current order|order summary|cart|what did i order|show order)\b/.test(lower)) return "get_order_summary";
            if (/\b(log|analytics|session state|history)\b/.test(lower)) return "get_session_analytics";
            if (/\bsuggest(?:ion)?\s+for\b|\bsuggest(?:\s+\w+){0,4}\s+items?\b/.test(lower)) return "suggest_items";
            if (/\b(recommend|suggest|pair with|popular|chef)\b/.test(lower)) return "get_recommendations";
            if (/\b(item details|details for|tell me about|ingredients|price of|what is)\b/.test(lower)) return "get_item_details";
            if (/\b(search|find)\b/.test(lower) && /\b(menu|dish|food|item|drink|dessert)\b/.test(lower)) return "search_menu";
            if (/\b(menu|vegetarian|vegan|gluten|dessert|beverage|appetizer|main course|pickup|delivery)\b/.test(lower)) return "browse_menu";
            return "run_restaurant_concierge";
        case "data-analyst-agent":
            if (/\b(capabilities|can you do)\b/.test(lower)) return "list_capabilities";
            if (/\b(anomaly|monitor|detect)\b/.test(lower)) return "monitor";
            return "autonomous";
        case "shelfie-grocery-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(reset|clear|new session|start over)\b/.test(lower)) return "reset_session";
            if (/\b(history|previous session|load session|chat history)\b/.test(lower)) return "get_history";
            if (/\b(sessions|recent sessions|list sessions)\b/.test(lower)) return "list_sessions";
            return "run_shelfie_grocery_agent";
        case "cyber-soc-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(channel|channels)\b/.test(lower)) return "list_windows_channels";
            if (/\b(history|past|previous|recent analyses)\b/.test(lower)) return "get_history";
            if (/\b(dashboard|overview|stats|metrics)\b/.test(lower)) return "dashboard_overview";
            if (/\b(fetch|get|show|list)\b/.test(lower) && /\b(log|logs|windows)\b/.test(lower)) return "fetch_windows_logs";
            if (/\b(analy[sz]e|investigate|triage)\b/.test(lower) && /\b(log|logs|windows|event)\b/.test(lower)) {
                return /\b(windows|event|realtime)\b/.test(lower) ? "analyze_windows_logs" : "analyze_log";
            }
            return "analyze_log";
        case "leadgen-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(list|show|saved|stored|records?)\b/.test(lower) && /\b(leads?|prospects?)\b/.test(lower)) return "list_leads";
            if (/\b(history|previous|session)\b/.test(lower)) return "get_history";
            if (/\b(clear|reset)\b/.test(lower)) return "clear_session";
            if (/\b(new session|fresh session)\b/.test(lower)) return "new_session";
            return "run_leadgen";
        case "marketing-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(provider|model)\b/.test(lower) && /\b(switch|change)\b/.test(lower)) return "switch_provider";
            if (/\b(provider|models)\b/.test(lower)) return "list_providers";
            if (/\b(history|previous|session)\b/.test(lower)) return "get_history";
            if (/\b(sessions|recent sessions)\b/.test(lower)) return "list_sessions";
            if (/\b(analy[sz]e)\b/.test(lower) && /\b(product|image|brand)\b/.test(lower)) return "analyze_product";
            if (/\b(edit|revise|change)\b/.test(lower) && /\b(poster|creative|image)\b/.test(lower)) return "edit_poster";
            if (/\b(campaign|launch|ad|copy|poster|creative)\b/.test(lower)) return "generate_campaign";
            return "run_marketing_agent";
        case "aria-podcast-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(text to speech|tts|speak|voiceover|audio)\b/.test(lower)) return "text_to_speech";
            if (/\b(clear|reset)\b/.test(lower) && /\b(history|session)\b/.test(lower)) return "clear_history";
            if (/\b(history|previous|session)\b/.test(lower)) return "get_history";
            if (/\b(sessions|recent sessions)\b/.test(lower)) return "list_sessions";
            if (/\b(switch|mode|host mode|creator mode)\b/.test(lower)) return "switch_mode";
            if (/\b(script|outline|episode|segments?)\b/.test(lower)) return "creator_script";
            if (/\b(host|conversation|interview|podcast)\b/.test(lower)) return "host_conversation";
            return "chat";
        case "pr-copilot-review-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(webhook|token|configured|status)\b/.test(lower)) return "webhook_status";
            if (/\b(post|publish|comment)\b/.test(lower) && /\b(review|pr|pull request)\b/.test(lower)) return "review_pr";
            return "dry_run_review";
        case "pian-labs-alos-agent":
            if (/\b(capabilities|can you do|help|actions)\b/.test(lower)) return "list_capabilities";
            if (/\b(registry|entities|schema|fields|workspace)\b/.test(lower)) return "describe_workspace";
            if (/\b(summarize|summary|overview)\b/.test(lower) && /\b(entity|shipments?|vehicles?|warehouses?)\b/.test(lower)) return "summarize_entity";
            if (/\b(list|show|find|records?)\b/.test(lower) && /\b(shipments?|vehicles?|warehouses?|records?)\b/.test(lower)) return "list_records";
            if (/\b(create|add|insert)\b/.test(lower) && /\b(record|shipment|vehicle|warehouse)\b/.test(lower)) return "create_record";
            if (/\b(update|edit|change)\b/.test(lower) && /\b(record|shipment|vehicle|warehouse)\b/.test(lower)) return "update_records";
            if (/\b(csv|spreadsheet|excel|onboard|import)\b/.test(lower)) return /\bexcel|xlsx|workbook\b/.test(lower) ? "onboard_excel" : "onboard_csv";
            if (/\b(rest api|api endpoint|pull api)\b/.test(lower)) return "pull_rest_api";
            if (/\b(clone|mongo|database)\b/.test(lower)) return "clone_mongo";
            if (/\b(empty|seed|start)\b/.test(lower)) return "start_empty";
            if (/\b(route|distance|eta|shipment path|weather|rain|wind|storm)\b/.test(lower)) return "check_route_weather";
            return "run_alos";
        case "dia-helper-agent":
            if (/\b(update|edit|change|add|more detail|details)\b/.test(lower)) return "update_diagram";
            return "generate_diagram";
        default:
            return getAgentCapability(agentId)?.defaultAction || "ask";
    }
}

function routeFundraisingIntent(text: string, lower: string, reason: string): RouteDecision {
    const action = /\b(term sheet|safe|valuation cap|pro rata)\b/.test(lower)
        ? "term_sheet_guidance"
        : /\b(track|update|follow up|pipeline|conversation)\b/.test(lower)
            ? "track_conversation"
            : /\b(outreach|email|message|draft|sequence)\b/.test(lower)
                ? "plan_outreach"
                : /\b(investor|investors|vc|funds?)\b/.test(lower) && /\b(find|search|list|identify)\b/.test(lower)
                    ? "search_investors"
                    : "generate_fundraising_plan";

    return simpleIntent(
        "startup-fundraising-agent",
        action,
        text,
        reason,
        enrichParameters("startup-fundraising-agent", action, text, {})
    );
}

function routeSmartGtmIntent(text: string, lower: string, reason: string): RouteDecision {
    const action = /\b(channel|channels|distribution|partnership|partner)\b/.test(lower) && !/\b(go to market|go-to-market|gtm)\b/.test(lower)
        ? "channel"
        : /\b(gtm|go to market|go-to-market|positioning|audience|market plan)\b/.test(lower)
            ? "go_to_market"
            : "research_company";

    return simpleIntent(
        "smart-gtm-agent",
        action,
        text,
        reason,
        enrichParameters("smart-gtm-agent", action, text, {})
    );
}

function routeEmergencyIntent(text: string, reason: string): RouteDecision {
    return simpleIntent("emergency-response-agent", "assess_emergency", text, reason, {
        description: text,
    });
}

export function enrichParameters(agentId: string, action: string, text: string, params: Record<string, unknown>): Record<string, unknown> {
    const next = { ...params };
    const lower = normalizeForMatch(text);
    const email = extractEmailAddress(text);
    const url = extractUrl(text);
    const count = getNumericRequestCount(text);

    if (count && !next.limit) next.limit = Math.min(count, 20);
    if (email) {
        next.email = email;
        next.receiverEmail = email;
        next.recipientEmail = email;
        next.contact = next.contact || email;
    }
    if (url) {
        next.url = url;
        next.company_url = url;
        next.companyUrl = url;
        next.repositoryUrl = url;
    }
    if (ACTIONS_WITH_PROMPT_FALLBACK.has(action)) {
        const required = getActionCapability(agentId, action)?.required || [];
        for (const field of required) {
            if (!next[field]) next[field] = text;
        }
    }
    if (agentId === "strata-agent") {
        next.question = next.question || text;
        const symbol = extractSymbol(text);
        if (symbol) next.symbol = symbol;
    }
    if (agentId === "startup-fundraising-agent") {
        const startupMatch =
            text.match(/\bmy\s+(.{2,80}?\s+startup)\b/i) ||
            text.match(/\b(?:for|about)\s+(.{2,80}?\s+startup)\b/i);
        next.startup_name = next.startup_name || startupMatch?.[1]?.trim() || text;
        if (/\bpre[-\s]?seed\b/.test(lower)) next.stage = next.stage || "pre-seed";
        else if (/\bseed\b/.test(lower)) next.stage = next.stage || "seed";
        else if (/\bseries\s*a\b/.test(lower)) next.stage = next.stage || "series a";
        if (/\bb2b\b/.test(lower) && /\bai\b/.test(lower)) next.industry = next.industry || "b2b ai";
        else if (/\bsaas\b/.test(lower)) next.industry = next.industry || "saas";
        else if (/\bai\b/.test(lower)) next.industry = next.industry || "ai";
        next.preferred_channel = next.preferred_channel || (/\blinkedin\b/.test(lower) ? "linkedin" : "email");
        next.query = next.query || text;
    }
    if (agentId === "smart-gtm-agent") {
        next.query = next.query || text;
        if (url) {
            next.companyUrl = next.companyUrl || url;
            next.url = next.url || url;
            next.company_url = next.company_url || url;
        } else {
            const companyMatch = text.match(/\b(?:for|about|analyze)\s+([A-Z][A-Za-z0-9 .&-]{2,60})\b/);
            if (companyMatch?.[1]) next.companyName = next.companyName || companyMatch[1].trim();
        }
        if (action === "go_to_market") next.mode = next.mode || "gtm";
        if (action === "channel") next.mode = next.mode || "channel";
        if (action === "research_company") next.mode = next.mode || "research";
    }
    if (agentId === "restaurant-concierge-agent") {
        next.prompt = next.prompt || text;
        next.message = next.message || text;
        if (action === "search_menu" || action === "suggest_items") {
            next.query = next.query || text;
        }
        if (action === "get_item_details") {
            next.itemName = next.itemName || text;
        }
        if (action === "request_human_help") {
            next.reason = next.reason || text;
        }
        if (/\bvegetarian\b/.test(lower)) next.dietaryFilter = next.dietaryFilter || "vegetarian";
        else if (/\bvegan\b/.test(lower)) next.dietaryFilter = next.dietaryFilter || "vegan";
        else if (/\bgluten[- ]?free\b/.test(lower)) next.dietaryFilter = next.dietaryFilter || "gluten-free";

        if (/\b(?:appetizer|starter)\b/.test(lower)) next.category = next.category || "appetizers";
        else if (/\b(?:main|entree)\b/.test(lower)) next.category = next.category || "mains";
        else if (/\b(?:salad)\b/.test(lower)) next.category = next.category || "salads";
        else if (/\b(?:beverage|drink|chai|lassi)\b/.test(lower)) next.category = next.category || "beverages";
        else if (/\b(?:dessert|sweet|gulab jamun|rasmalai)\b/.test(lower)) next.category = next.category || "desserts";
    }
    if (agentId === "shelfie-grocery-agent") {
        next.prompt = next.prompt || text;
        next.message = next.message || text;
        next.query = next.query || text;

        const sessionMatch = text.match(/\bsession(?:\s+id)?\s*[:#-]?\s*([A-Za-z0-9._:-]{6,})/i);
        if (sessionMatch?.[1]) {
            next.session_id = next.session_id || sessionMatch[1];
        }
    }
    if (agentId === "leadgen-agent") {
        next.prompt = next.prompt || text;
        next.message = next.message || text;
        next.query = next.query || text;
        const sessionMatch = text.match(/\bsession(?:\s+id)?\s*[:#-]?\s*([A-Za-z0-9._:-]{6,})/i);
        if (sessionMatch?.[1]) next.session_id = next.session_id || sessionMatch[1];
    }
    if (agentId === "marketing-agent") {
        next.prompt = next.prompt || text;
        next.message = next.message || text;
        next.query = next.query || text;
        const sessionMatch = text.match(/\bsession(?:\s+id)?\s*[:#-]?\s*([A-Za-z0-9._:-]{6,})/i);
        if (sessionMatch?.[1]) next.session_id = next.session_id || sessionMatch[1];
        const productMatch = text.match(/\b(?:for|about|product)\s+([A-Z][A-Za-z0-9 .&-]{2,60})\b/);
        if (productMatch?.[1]) next.product_name = next.product_name || productMatch[1].trim();
    }
    if (agentId === "aria-podcast-agent") {
        next.prompt = next.prompt || text;
        next.message = next.message || text;
        next.query = next.query || text;
        if (action === "text_to_speech") next.text = next.text || text;
        if (/\bcreator\b/.test(lower)) next.mode = next.mode || "creator";
        if (/\bhost\b/.test(lower)) next.mode = next.mode || "host";
    }
    if (agentId === "pr-copilot-review-agent") {
        const repoMatch = text.match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/);
        const prMatch = text.match(/\b(?:pr|pull request)\s*#?\s*(\d+)\b/i);
        if (repoMatch?.[1]) {
            next.repo = next.repo || repoMatch[1];
            next.repository = next.repository || repoMatch[1];
        }
        if (prMatch?.[1]) next.pr_number = next.pr_number || Number(prMatch[1]);
        if (action === "dry_run_review") next.dry_run = true;
    }
    if (agentId === "pian-labs-alos-agent") {
        next.prompt = next.prompt || text;
        next.message = next.message || text;
        next.query = next.query || text;
        if (!next.entity) {
            if (/\bvehicles?\b/.test(lower)) next.entity = "vehicles";
            else if (/\bwarehouses?\b/.test(lower)) next.entity = "warehouses";
            else if (/\bshipments?\b/.test(lower)) next.entity = "shipments";
        }
    }
    if (agentId === "emergency-response-agent") {
        next.description = next.description || text;
    }
    if (agentId === "dia-helper-agent") {
        if (action === "update_diagram") next.editInstruction = next.editInstruction || text;
        else next.prompt = next.prompt || text;
    }
    if (agentId === "seo-agent" && action === "generate_brief") {
        next.topic = next.topic || text.replace(/\bseo\b/gi, "").trim() || text;
    }
    if (agentId === "maps-agent" && action === "search_places") {
        next.query = next.query || text;
    }
    if (agentId === "todo-agent" && action === "add_task") {
        next.title = next.title || text;
    }
    if (agentId === "github-agent" && action === "list_repositories") {
        next.limit = next.limit || 10;
        if (/\b(created)\b/.test(lower)) next.sort = "created";
        if (/\b(pushed)\b/.test(lower)) next.sort = "pushed";
    }
    return next;
}

function inferContextualGmailRoute(text: string, lower: string, context?: ConversationContext): RouteDecision | null {
    const recentEmails = context?.entity_index.gmail_emails || [];
    if (recentEmails.length === 0) return null;

    const hasFollowUpAction = /\b(summarize|summarise|summary|read|open|mark|reply|respond)\b/.test(lower);
    const hasReferenceHint =
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|latest|top|this|that|same|one|it|mail|email|sender|from|subject|above|previous|list)\b/.test(lower);

    if (!hasFollowUpAction || !hasReferenceHint) return null;
    return googleIntent(
        "gmail",
        inferGmailAction(lower),
        text,
        "Matched a Gmail follow-up from recent structured context."
    );
}

export function deterministicRoute(userInput: string, context?: ConversationContext): RouteDecision {
    const text = userInput.trim();
    const lower = normalizeForMatch(text);
    if (!text) return noRoute("Empty message.");

    const explicit = routeByExplicitAgentMention(text, lower);
    if (explicit) {
        const explicitRoutingText =
            typeof explicit.parameters.prompt === "string"
                ? explicit.parameters.prompt
                : typeof explicit.parameters.parameters === "string"
                    ? explicit.parameters.parameters
                    : text;
        explicit.parameters = enrichParameters(
            explicit.target_agent || "",
            explicit.target_action || "",
            explicitRoutingText,
            explicit.parameters
        );
        return explicit;
    }

    const correction = routeByRecentCorrection(text, lower, context);
    if (correction) {
        correction.parameters = enrichParameters(
            correction.target_agent || "",
            correction.target_action || "",
            text,
            correction.parameters
        );
        return correction;
    }

    if (/\b(heart attack|stroke|chest pain|breathing|can't breathe|cannot breathe|severe injury|emergency|sos|ambulance|bleeding|unconscious)\b/.test(lower)) {
        return routeEmergencyIntent(text, "Matched an emergency/medical safety request.");
    }

    if (/\b(fundraising|fundraise|funds?|investors?|seed investors?|vc|venture capital|pitch deck|term sheet|outreach email)\b/.test(lower)) {
        return routeFundraisingIntent(text, lower, "Matched a fundraising/investor workflow request.");
    }

    if (
        /\b(gtm|go to market|go-to-market|positioning|audience|channels?|market plan|company url)\b/.test(lower) &&
        /\b(company|url|startup|audience|positioning|channels?|strategy|plan|https?)\b/.test(lower)
    ) {
        return routeSmartGtmIntent(text, lower, "Matched a Smart GTM strategy request.");
    }

    const contextualGmailRoute = inferContextualGmailRoute(text, lower, context);
    if (contextualGmailRoute) return contextualGmailRoute;

    if (/\b(gmail|gamil|gmial|email|emails|mail|mails|inbox|message|messages)\b/.test(lower)) {
        return googleIntent("gmail", inferGmailAction(lower), text, "Matched a Gmail/email request.");
    }

    if (/\b(google drive|drive|docs?|documents?|files?|folder|folders|pdf|pdfs)\b/.test(lower) && includesAny(lower, [
        /\b(list|show|get|retrieve|fetch|find|search|read|summarize|summarise|open)\b/,
        /\b(last|latest|recent)\b/,
    ])) {
        return googleIntent("drive", inferDriveAction(lower), text, "Matched a Google Drive/file request.");
    }

    if (/\b(google calendar|calendar|agenda|events?)\b/.test(lower)) {
        return googleIntent("calendar", /\b(create|schedule|add|book)\b/.test(lower) ? "create_event" : "list_events", text, "Matched a Google Calendar request.");
    }

    if (/\b(google meet|meet link|meeting link|video call)\b/.test(lower)) {
        return googleIntent("meet", "create_meet", text, "Matched a Google Meet request.");
    }

    if (/\b(google tasks)\b/.test(lower)) {
        return googleIntent("tasks", /\b(add|create|remind)\b/.test(lower) ? "create_task" : "list_tasks", text, "Matched a Google Tasks request.");
    }

    if (/\b(remind me|to-do|todo|task|tasks|daily plan|weekly overview|plan my day)\b/.test(lower)) {
        const agentId = /\b(plan my day|daily plan|weekly overview)\b/.test(lower)
            ? "day-planner-agent"
            : "todo-agent";
        const action = chooseActionForAgent(agentId, lower);
        return simpleIntent(agentId, action, text, `Matched ${getAgentCatalogEntry(agentId)?.name || agentId}.`, enrichParameters(agentId, action, text, {}));
    }

    if (/\b(map|maps|directions|route|near me|nearby|distance|coffee shops?|restaurants?)\b/.test(lower)) {
        const action = chooseActionForAgent("maps-agent", lower);
        return simpleIntent("maps-agent", action, text, "Matched a Maps request.", enrichParameters("maps-agent", action, text, { query: text }));
    }

    if (/\b(seo|keyword|serp|content brief|optimi[sz]e article)\b/.test(lower)) {
        const action = chooseActionForAgent("seo-agent", lower);
        return simpleIntent("seo-agent", action, text, "Matched an SEO request.", enrichParameters("seo-agent", action, text, {}));
    }

    if (/\b(shopgenie|shop genie|buy|best .+ under|compare .+ (phones|laptops|headphones|products))\b/.test(lower)) {
        return simpleIntent("shopgenie-agent", "recommend_product", text, "Matched a shopping/product recommendation request.", { query: text });
    }

    if (
        /\b(grocery|shopping list|meal plan|pantry|weekly groceries|food list|supermarket)\b/.test(lower) &&
        /\b(plan|list|organize|prepare|optimi[sz]e|continue|remember|session)\b/.test(lower)
    ) {
        const action = chooseActionForAgent("shelfie-grocery-agent", lower);
        return simpleIntent(
            "shelfie-grocery-agent",
            action,
            text,
            "Matched a grocery planning or shopping-list request.",
            enrichParameters("shelfie-grocery-agent", action, text, {})
        );
    }

    if (
        /\b(restaurant|menu|food|dish|meal|pickup|delivery|biryani|butter chicken|paneer|dosa|chai|lassi|gulab jamun|rasmalai)\b/.test(lower) &&
        /\b(order|menu|recommend|pickup|delivery|food|dish|meal|add|remove|cancel|search|find|vegetarian|vegan)\b/.test(lower)
    ) {
        const action = chooseActionForAgent("restaurant-concierge-agent", lower);
        return simpleIntent(
            "restaurant-concierge-agent",
            action,
            text,
            "Matched a restaurant ordering or menu request.",
            enrichParameters("restaurant-concierge-agent", action, text, {})
        );
    }

    if (/\b(leadgen|lead gen|lead generation|sales leads?|prospects?|prospecting|decision makers?)\b/.test(lower)) {
        const action = chooseActionForAgent("leadgen-agent", lower);
        return simpleIntent(
            "leadgen-agent",
            action,
            text,
            "Matched a lead generation or prospecting request.",
            enrichParameters("leadgen-agent", action, text, {})
        );
    }

    if (/\b(marketing|campaign|ad copy|poster|creative|brand guidelines?|product launch|social post)\b/.test(lower)) {
        const action = chooseActionForAgent("marketing-agent", lower);
        return simpleIntent(
            "marketing-agent",
            action,
            text,
            "Matched a marketing campaign or creative request.",
            enrichParameters("marketing-agent", action, text, {})
        );
    }

    if (/\b(aria|podcast|episode|host conversation|creator mode|voiceover|tts)\b/.test(lower)) {
        const action = chooseActionForAgent("aria-podcast-agent", lower);
        return simpleIntent(
            "aria-podcast-agent",
            action,
            text,
            "Matched an ARIA podcast request.",
            enrichParameters("aria-podcast-agent", action, text, {})
        );
    }

    if (/\b(pr copilot|pull request review|pr review|review pr|code review)\b/.test(lower)) {
        const action = chooseActionForAgent("pr-copilot-review-agent", lower);
        return simpleIntent(
            "pr-copilot-review-agent",
            action,
            text,
            "Matched a pull request review request.",
            enrichParameters("pr-copilot-review-agent", action, text, {})
        );
    }

    if (/\b(alos|pian labs|shipment|shipments|logistics|warehouse|warehouses|vehicle|vehicles|route status)\b/.test(lower)) {
        const action = chooseActionForAgent("pian-labs-alos-agent", lower);
        return simpleIntent(
            "pian-labs-alos-agent",
            action,
            text,
            "Matched a Pian Labs ALOS logistics request.",
            enrichParameters("pian-labs-alos-agent", action, text, {})
        );
    }

    if (/\b(plan a trip|travel|flights?|hotels?|itinerary)\b/.test(lower)) {
        return simpleIntent("travel-halper-agent", "plan_trip", text, "Matched a travel planning request.", { prompt: text });
    }

    if (/\b(dashboard|kpi|analytics board|metrics board)\b/.test(lower)) {
        return simpleIntent("dashboard-designer-agent", "design_dashboard", text, "Matched a dashboard design request.", { prompt: text });
    }

    if (/\b(resume|candidate|interview|ats)\b/.test(lower)) {
        const action = chooseActionForAgent("ats-agent", lower);
        return simpleIntent("ats-agent", action, text, "Matched a recruiting/ATS request.", enrichParameters("ats-agent", action, text, {}));
    }

    if (/\b(course|learner|lms|training|assignment)\b/.test(lower)) {
        const action = chooseActionForAgent("lms-agent", lower);
        return simpleIntent("lms-agent", action, text, "Matched an LMS request.", enrichParameters("lms-agent", action, text, {}));
    }

    if (/\b(cyber|soc|security log|windows event|event log|threat|ioc|virustotal|mitre)\b/.test(lower)) {
        const action = chooseActionForAgent("cyber-soc-agent", lower);
        return simpleIntent("cyber-soc-agent", action, text, "Matched a Cyber SOC request.", enrichParameters("cyber-soc-agent", action, text, {}));
    }

    if (/\b(construction|house plan|plot|contractor|architect|floor plan)\b/.test(lower)) {
        return simpleIntent("building-construction-agent", "generate_plan", text, "Matched a construction planning request.", { prompt: text });
    }

    return noRoute();
}
