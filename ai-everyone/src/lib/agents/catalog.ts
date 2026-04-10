import type { AgentRegistryEntry } from "@/modules/chat/types";

export type AgentProvider =
    | "internal"
    | "google"
    | "microsoft"
    | "notion"
    | "github"
    | "gitlab"
    | "discord"
    | "dropbox"
    | "linkedin"
    | "zoom"
    | "atlassian"
    | "canva"
    | "freshdesk"
    | "greenhouse";

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
        id: "emergency-response-agent",
        name: "Emergency Response Agent",
        description:
            "Assess medical emergency severity, then activate live emergency response with nearby hospitals and sharing actions.",
        actions: ["assess_emergency", "activate_emergency"],
        examplePrompts: [
            "I am having severe chest pain on my left side",
            "Start emergency response now",
            "Find nearby hospitals around my live location",
        ],
        provider: "internal",
        category: "health",
        tags: ["emergency", "medical", "hospital", "safety"],
        requiresConnection: false,
    },
    {
        id: "strata-agent",
        name: "Stara Agent",
        description:
            "Analyze company financials with dashboard snapshots, trend forecasting, category breakdowns, and AI decision insights.",
        actions: ["open_workspace", "dashboard", "trends", "categories", "ai_insights", "ask", "upload_report"],
        examplePrompts: [
            "Open Stara workspace for AAPL",
            "Show trend analysis for Microsoft",
            "Ask Stara: why did margin decline this period?",
        ],
        provider: "internal",
        category: "finance",
        tags: ["finance", "stocks", "analytics", "insights"],
        requiresConnection: false,
    },
    {
        id: "dia-helper-agent",
        name: "Dia Helper",
        description:
            "Turn product ideas and project briefs into Mermaid data-flow diagrams, plus a ready-to-paste Figma AI prompt.",
        actions: ["generate_diagram", "update_diagram"],
        examplePrompts: [
            "Design a signup and onboarding flow for a SaaS app",
            "Create a data flow from web form to database and analytics pipeline",
            "Update the diagram to add a caching layer between API and database",
        ],
        provider: "internal",
        category: "design",
        tags: ["diagrams", "mermaid", "figma", "architecture"],
        requiresConnection: false,
    },
    {
        id: "shopgenie-agent",
        name: "ShopGenie Agent",
        description:
            "Research products, compare top options, fetch a YouTube review link, and optionally send recommendation email via connected Google account.",
        actions: ["recommend_product", "shop_search", "run_shopgenie"],
        examplePrompts: [
            "Find the best wireless headphones under 150 dollars",
            "Compare top laptops for coding and pick one winner",
            "Recommend a phone under 30000 and email me the result",
        ],
        provider: "internal",
        category: "shopping",
        tags: ["shopping", "comparison", "recommendations", "youtube"],
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
        description: "Manage tasks, reminders, and daily planning stored inside Pian.",
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
    // ── New Integration Agents ─────────────────────────────────────────────
    {
        id: "canva-agent",
        name: "Canva Agent",
        description: "List and create Canva designs directly from chat. Requires Canva OAuth connection.",
        actions: ["list_designs", "create_design"],
        examplePrompts: [
            "List my recent Canva designs",
            "Create a new Canva presentation called Q3 Review",
        ],
        provider: "canva",
        category: "design",
        tags: ["canva", "design", "presentations"],
        requiresConnection: true,
        oauthScopes: ["design:content:read", "design:meta:read", "asset:read"],
    },
    {
        id: "day-planner-agent",
        name: "Day Planner Agent",
        description: "Plan your day and week with a built-in planner backed by your personal Firestore data.",
        actions: ["get_daily_plan", "add_to_plan", "get_weekly_overview"],
        examplePrompts: [
            "What is my plan for today?",
            "Add a meeting with the design team at 3 PM to my plan",
            "Give me an overview of my week",
        ],
        provider: "internal",
        category: "productivity",
        tags: ["planning", "schedule", "daily"],
        requiresConnection: false,
    },
    {
        id: "discord-agent",
        name: "Discord Agent",
        description: "View your Discord profile and list servers you belong to.",
        actions: ["get_user_info", "list_guilds"],
        examplePrompts: [
            "Show me my Discord profile",
            "List my Discord servers",
        ],
        provider: "discord",
        category: "communication",
        tags: ["discord", "gaming", "community"],
        requiresConnection: true,
        oauthScopes: ["identify", "guilds"],
    },
    {
        id: "dropbox-agent",
        name: "Dropbox Agent",
        description: "Search files, create folders, and move files in your Dropbox storage.",
        actions: ["search_files", "create_folder", "move_file"],
        examplePrompts: [
            "Search Dropbox for the contract file",
            "Create a folder called Project Alpha in Dropbox",
            "Move the report to the Archives folder in Dropbox",
        ],
        provider: "dropbox",
        category: "files",
        tags: ["dropbox", "files", "storage", "cloud"],
        requiresConnection: true,
        oauthScopes: [],
    },
    {
        id: "freshdesk-agent",
        name: "Freshdesk Agent",
        description: "Create support tickets, check ticket status, search solutions, and list recent tickets in Freshdesk.",
        actions: ["create_ticket", "check_ticket_status", "search_solutions", "list_tickets"],
        examplePrompts: [
            "Create a Freshdesk ticket: billing issue for user John",
            "What is the status of Freshdesk ticket 1234?",
            "Search Freshdesk solutions for password reset",
        ],
        provider: "freshdesk",
        category: "support",
        tags: ["freshdesk", "helpdesk", "tickets", "support"],
        requiresConnection: false,
    },
    {
        id: "github-agent",
        name: "GitHub Agent",
        description: "List repositories, search repos, get issue details, and create new issues on GitHub.",
        actions: ["list_repositories", "search_repositories", "get_issue", "create_issue"],
        examplePrompts: [
            "List my GitHub repositories",
            "Search GitHub for repos about machine learning",
            "Create a GitHub issue in my-org/my-repo: Login page broken",
        ],
        provider: "github",
        category: "development",
        tags: ["github", "code", "git", "repositories"],
        requiresConnection: true,
        oauthScopes: ["repo", "read:user", "user:email"],
    },
    {
        id: "gitlab-agent",
        name: "GitLab Agent",
        description: "List projects, get issue details, and create new issues in GitLab.",
        actions: ["list_projects", "get_issue", "create_issue"],
        examplePrompts: [
            "List my GitLab projects",
            "Get GitLab issue #42 from my-group/my-project",
            "Create a GitLab issue in my-project: API is returning 500",
        ],
        provider: "gitlab",
        category: "development",
        tags: ["gitlab", "code", "git", "devops"],
        requiresConnection: true,
        oauthScopes: ["api", "read_user", "read_api"],
    },
    {
        id: "greenhouse-agent",
        name: "Greenhouse Agent",
        description: "List candidates, fetch resumes, and schedule interviews via Greenhouse ATS.",
        actions: ["list_candidates", "get_candidate_resume", "schedule_interview"],
        examplePrompts: [
            "List active candidates in Greenhouse",
            "Get the resume for candidate 9876 in Greenhouse",
            "Schedule an interview with candidate 1234 with hr@company.com",
        ],
        provider: "greenhouse",
        category: "hr",
        tags: ["greenhouse", "ats", "recruiting", "hr"],
        requiresConnection: false,
    },
    {
        id: "jira-agent",
        name: "Jira Agent",
        description: "Create issues, check issue status, search with JQL, and list your assigned issues in Jira.",
        actions: ["create_issue", "get_issue_status", "search_issues", "list_issues"],
        examplePrompts: [
            "Create a Jira bug in project PROJ: Checkout page is broken",
            "What is the status of Jira issue PROJ-123?",
            "Search Jira for issues assigned to me in the last sprint",
        ],
        provider: "atlassian",
        category: "project-management",
        tags: ["jira", "atlassian", "bugs", "agile"],
        requiresConnection: true,
        oauthScopes: ["read:jira-work", "write:jira-work", "read:jira-user"],
    },
    {
        id: "linkedin-agent",
        name: "LinkedIn Agent",
        description: "Post to LinkedIn immediately or schedule posts for later. Analyze basic engagement.",
        actions: ["schedule_post", "analyze_engagement"],
        examplePrompts: [
            "Post on LinkedIn: Excited to announce our new product launch!",
            "Schedule a LinkedIn post for tomorrow at 9 AM: Join us at the DevConf 2024",
        ],
        provider: "linkedin",
        category: "social",
        tags: ["linkedin", "social media", "marketing"],
        requiresConnection: true,
        oauthScopes: ["w_member_social", "openid", "profile", "email"],
    },
    {
        id: "zoom-agent",
        name: "Zoom Agent",
        description: "Create Zoom meetings, list upcoming meetings, and fetch AI meeting summaries.",
        actions: ["create_meeting", "list_upcoming_meetings", "get_meeting_summary"],
        examplePrompts: [
            "Create a Zoom meeting called Weekly Sync for tomorrow at 10 AM",
            "List my upcoming Zoom meetings",
            "Get the AI summary for Zoom meeting 12345678",
        ],
        provider: "zoom",
        category: "productivity",
        tags: ["zoom", "meetings", "video"],
        requiresConnection: true,
        oauthScopes: [],
    },
    {
        id: "career-switch-agent",
        name: "Career Switch Agent",
        description:
            "Navigate your career transition with AI-powered skill gap analysis, personalized roadmaps, and job market insights powered by O*NET and live job data.",
        actions: ["generate_plan"],
        examplePrompts: [
            "Create a career plan from Data Analyst to Machine Learning Engineer",
            "Show me the skill gaps and roadmap for becoming a Product Manager",
            "Generate a career transition plan with my current skills and target role",
        ],
        provider: "internal",
        category: "career",
        tags: ["career", "planning", "skills", "roadmap", "transition"],
        requiresConnection: false,
    },
    {
        id: "startup-fundraising-agent",
        name: "Fund Agent",
        description:
            "Help founders prepare fundraising materials, research investors, plan outreach, and keep investor follow-ups organized.",
        actions: [
            "search_investors",
            "plan_outreach",
            "track_conversation",
            "term_sheet_guidance",
            "generate_fundraising_plan",
        ],
        examplePrompts: [
            "Find seed investors for my AI developer tools startup",
            "Draft investor outreach for our B2B SaaS fundraising round",
            "Help me respond to a term sheet question from an investor",
        ],
        provider: "internal",
        category: "finance",
        tags: ["fundraising", "investors", "pitch deck", "outreach", "startup"],
        requiresConnection: false,
    },
    {
        id: "smart-gtm-agent",
        name: "Smart GTM Agent",
        description:
            "Research a company, generate a go-to-market plan, and recommend channel strategy from a company URL or business context.",
        actions: ["research_company", "go_to_market", "channel"],
        examplePrompts: [
            "Analyze Stripe and give me a GTM breakdown",
            "Build a go-to-market strategy for this company URL",
            "Suggest channel strategy for a B2B AI startup",
        ],
        provider: "internal",
        category: "marketing",
        tags: ["gtm", "research", "channels", "positioning", "growth"],
        requiresConnection: false,
    },
    {
        id: "seo-agent",
        name: "SEO Agent",
        description:
            "Create SEO briefs, audit existing articles, and produce optimization guidance based on keywords, SERP patterns, and content structure.",
        actions: ["generate_brief", "audit", "optimize_article"],
        examplePrompts: [
            "Create an SEO brief for AI sales automation",
            "Audit this blog post URL for SEO",
            "Optimize my article draft for the keyword cloud cost optimization",
        ],
        provider: "internal",
        category: "marketing",
        tags: ["seo", "content", "keywords", "audit", "optimization"],
        requiresConnection: false,
    },
    {
        id: "dashboard-designer-agent",
        name: "Dashboard Designer",
        description:
            "Turn analytics questions or pasted datasets into dashboard-ready KPI cards, charts, tables, summaries, and threshold ideas.",
        actions: ["design_dashboard", "refine_dashboard", "update_dashboard"],
        examplePrompts: [
            "Design a regional sales performance dashboard",
            "Create an operations dashboard from this KPI table",
            "Suggest alert thresholds for my revenue dashboard",
        ],
        provider: "internal",
        category: "analytics",
        tags: ["dashboard", "analytics", "kpi", "charts", "thresholds"],
        requiresConnection: false,
    },
    {
        id: "ats-agent",
        name: "ATS Agent",
        description:
            "Analyze candidate fit, generate interview questions, capture interview transcript feedback, and compare shortlisted candidates.",
        actions: [
            "analyze_candidate",
            "generate_interview_questions",
            "save_interview_transcript",
            "compare_candidates",
            "list_candidates",
        ],
        examplePrompts: [
            "Analyze this resume for a backend engineer role",
            "Generate first-round interview questions for this candidate",
            "Save this interview transcript and generate feedback",
        ],
        provider: "internal",
        category: "recruiting",
        tags: ["ats", "hiring", "interview", "candidate", "recruiting"],
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
