import type { AgentRegistryEntry } from "@/modules/chat/types";

export type AgentProvider = "internal" | "google" | "microsoft" | "notion";

export interface AgentCatalogEntry extends AgentRegistryEntry {
    provider: AgentProvider;
    category: string;
    tags: string[];
    bundleId?: string;
    requiresConnection: boolean;
    oauthScopes?: string[];
}

export interface AgentBundle {
    id: string;
    name: string;
    provider: Exclude<AgentProvider, "internal">;
    description: string;
    category: string;
    tags: string[];
    childAgentIds: string[];
    scopes: string[];
}

export const AGENT_CATALOG: AgentCatalogEntry[] = [
    {
        id: "teams-agent",
        name: "Microsoft Teams Agent",
        description:
            "Search people in Microsoft 365, send Teams messages, and schedule meetings directly after authorization.",
        actions: ["make_call", "send_message", "schedule_meeting"],
        examplePrompts: [
            "Send Prashant a Teams message saying I will be 10 minutes late",
            "Schedule a Microsoft Teams meeting with Aaron tomorrow at 10 AM",
            "Call Riya on Teams",
        ],
        provider: "microsoft",
        category: "productivity",
        tags: ["microsoft", "teams", "communication"],
        bundleId: "microsoft-bundle",
        requiresConnection: true,
    },
    {
        id: "email-agent",
        name: "Microsoft Email Agent",
        description:
            "Read Outlook inbox, search emails, summarize emails, and send messages from Microsoft 365.",
        actions: [
            "read_inbox",
            "read_email",
            "summarize_email",
            "search_emails",
            "reply_to_email",
            "forward_email",
            "send_email",
            "mark_email",
            "move_email",
            "find_person_email",
        ],
        examplePrompts: [
            "Read my latest Outlook emails",
            "Summarize the email from Alice about the budget",
            "Send an Outlook email to John saying the report is ready",
        ],
        provider: "microsoft",
        category: "productivity",
        tags: ["microsoft", "outlook", "email"],
        bundleId: "microsoft-bundle",
        requiresConnection: true,
    },
    {
        id: "calendar-agent",
        name: "Microsoft Calendar Agent",
        description:
            "View Outlook calendar events, create meetings, check conflicts, and manage calendar entries.",
        actions: [
            "get_calendar_events",
            "create_calendar_event",
            "check_conflicts",
            "delete_event",
            "find_person_email",
        ],
        examplePrompts: [
            "What is on my Outlook calendar today?",
            "Schedule a calendar event with Ayush tomorrow at 3 PM",
            "Am I free next Monday at 10 AM?",
        ],
        provider: "microsoft",
        category: "productivity",
        tags: ["microsoft", "calendar", "schedule"],
        bundleId: "microsoft-bundle",
        requiresConnection: true,
    },
    {
        id: "google-agent",
        name: "Google Workspace Agent",
        description:
            "Use Gmail, Drive, Calendar, Meet, Tasks, and Google-powered document/email summarization from one agent.",
        actions: ["calendar", "gmail", "meet", "drive", "tasks", "web_search"],
        examplePrompts: [
            "Read my latest Gmail emails",
            "Summarize the Google Doc named Q3 report",
            "Search Google Drive for the contract and summarize it",
            "What is on my Google Calendar?",
        ],
        provider: "google",
        category: "productivity",
        tags: ["google", "gmail", "drive", "calendar"],
        bundleId: "google-bundle",
        requiresConnection: true,
    },
    {
        id: "maps-agent",
        name: "Google Maps Agent",
        description:
            "Get directions, search places, geocode addresses, and calculate travel times with Google Maps.",
        actions: ["get_directions", "search_places", "geocode", "distance_matrix"],
        examplePrompts: [
            "Find coffee shops near Connaught Place",
            "How do I get from the airport to Gurgaon by car?",
            "Estimate travel time from Delhi to Noida right now",
        ],
        provider: "google",
        category: "location",
        tags: ["maps", "directions", "places", "travel"],
        requiresConnection: false,
    },
    {
        id: "notion-agent",
        name: "Notion Agent",
        description:
            "Search, read, create, and append Notion pages after securely connecting your Notion workspace.",
        actions: ["search_pages", "get_page", "create_page", "append_to_page"],
        examplePrompts: [
            "Search my Notion pages for the hiring plan",
            "Read the Notion page about product roadmap",
            "Create a Notion page called Launch Notes with today's summary",
        ],
        provider: "notion",
        category: "productivity",
        tags: ["notion", "docs", "wiki", "workspace"],
        requiresConnection: true,
        oauthScopes: [],
    },
    {
        id: "todo-agent",
        name: "To-do Agent",
        description: "Manage tasks, reminders, and daily planning stored inside SnitchX.",
        actions: [
            "add_task",
            "add_to_plan",
            "list_tasks",
            "list_tasks_by_date",
            "get_daily_plan",
            "get_weekly_overview",
            "delete_task",
            "mark_done",
        ],
        examplePrompts: [
            "Remind me at 2:30 that I have a meeting",
            "Add buy milk tomorrow at 10 AM to my to-do list",
            "What is my plan for today?",
        ],
        provider: "internal",
        category: "productivity",
        tags: ["todo", "reminders", "planning"],
        requiresConnection: false,
    },
];

export const AGENT_BUNDLES: AgentBundle[] = [
    {
        id: "google-bundle",
        name: "Google Bundle",
        provider: "google",
        description:
            "Connect Gmail, Drive, Calendar, and the Google Workspace agent in one authorization flow.",
        category: "productivity",
        tags: ["google", "workspace", "bundle"],
        childAgentIds: ["google-agent"],
        scopes: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/tasks",
            "https://www.googleapis.com/auth/contacts.readonly",
        ],
    },
    {
        id: "microsoft-bundle",
        name: "Microsoft Bundle",
        provider: "microsoft",
        description:
            "Connect Teams, Outlook Mail, and Outlook Calendar together so Microsoft actions run directly after authorization.",
        category: "productivity",
        tags: ["microsoft", "365", "bundle"],
        childAgentIds: ["teams-agent", "email-agent", "calendar-agent"],
        scopes: [
            "User.Read",
            "People.Read",
            "User.ReadBasic.All",
            "Calendars.ReadWrite",
            "Mail.ReadWrite",
            "Mail.Send",
            "Chat.ReadWrite",
            "ChatMessage.Send",
            "offline_access",
        ],
    },
];

export function getAgentCatalogEntry(agentId: string): AgentCatalogEntry | undefined {
    return AGENT_CATALOG.find((agent) => agent.id === agentId);
}

export function getAgentBundle(bundleId: string): AgentBundle | undefined {
    return AGENT_BUNDLES.find((bundle) => bundle.id === bundleId);
}

export function getBundleForAgent(agentId: string): AgentBundle | undefined {
    const entry = getAgentCatalogEntry(agentId);
    return entry?.bundleId ? getAgentBundle(entry.bundleId) : undefined;
}

export function getInstalledAgentRegistry(installedAgentIds: string[]): AgentRegistryEntry[] {
    const installed = new Set(installedAgentIds);
    return AGENT_CATALOG.filter((agent) => installed.has(agent.id));
}

export function getInstallHintForAgent(agentId: string): string {
    const entry = getAgentCatalogEntry(agentId);
    if (!entry) {
        return "This agent is not installed for your account yet.";
    }

    const bundle = entry.bundleId ? getAgentBundle(entry.bundleId) : undefined;
    if (bundle) {
        return `Install and connect the ${bundle.name} first to enable ${entry.name}.`;
    }

    if (entry.requiresConnection) {
        return `Install and connect ${entry.name} first before using it.`;
    }

    return `Install ${entry.name} first before using it.`;
}
