import { GoogleGenAI } from "@google/genai";
import { AGENT_CATALOG, getAgentCatalogEntry } from "@/lib/agents/catalog";
import type { ConversationContext } from "@/lib/orchestrator/langgraph/types";

type IntakeStatus = "ready" | "needs_clarification" | "out_of_scope";
type FieldType = "string" | "number" | "boolean" | "string[]" | "object" | "array";

export interface IntakeField {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    description: string;
    question: string;
}

interface ActionIntakeSchema {
    action: string;
    description: string;
    required: IntakeField[];
    optional?: IntakeField[];
    examples?: string[];
    promptTemplate?: (params: Record<string, unknown>, userInput: string) => string;
    useUserInputAsPrompt?: boolean;
}

interface AgentIntakeSchema {
    agentId: string;
    purpose: string;
    actions: ActionIntakeSchema[];
}

export interface LlmWorkspaceIntakeOutput {
    status: IntakeStatus;
    action: string;
    normalizedParams: Record<string, unknown>;
    missingFields: string[];
    clarificationMessage: string;
    reasoningSummary: string;
}

export interface WorkspaceIntakeResult {
    ok: boolean;
    status: IntakeStatus | "validation_error";
    action: string;
    values: Record<string, unknown>;
    missingFields: IntakeField[];
    content?: string;
    parameters?: Record<string, unknown>;
    rawLlmOutput?: unknown;
    validationError?: string;
    reasoningSummary?: string;
}

const DEFAULT_INTAKE_MODEL =
    process.env.WORKSPACE_INTAKE_MODEL ||
    process.env.GEMINI_MODEL_FLASH_LITE ||
    process.env.GEMINI_MODEL_FLASH ||
    "gemini-3-flash-preview";

function field(
    key: string,
    label: string,
    type: FieldType,
    question: string,
    description = label,
    required = true
): IntakeField {
    return { key, label, type, question, description, required };
}

function action(
    name: string,
    description: string,
    required: IntakeField[],
    options: Pick<ActionIntakeSchema, "optional" | "examples" | "promptTemplate" | "useUserInputAsPrompt"> = {}
): ActionIntakeSchema {
    return { action: name, description, required, ...options };
}

function promptFromParams(title: string, params: Record<string, unknown>, userInput: string): string {
    const lines = Object.entries(params)
        .filter(([, value]) => hasValue(value))
        .map(([key, value]) => {
            const rendered = Array.isArray(value) ? value.join(", ") : String(value);
            return `${key.replace(/_/g, " ")}: ${rendered}`;
        });
    return [title, ...lines, "", `User request: ${userInput}`].join("\n");
}

const FIELDS = {
    contact: field("contact", "contact or recipient", "string", "Who should this go to?"),
    message: field("message", "message", "string", "What should the message say?"),
    title: field("title", "title", "string", "What title or topic should I use?"),
    date: field("date", "date", "string", "What date should I use?"),
    time: field("time", "time", "string", "What time should I use?"),
    attendees: field("attendees", "attendees", "string[]", "Who should attend?"),
    recipientEmail: field("recipientEmail", "recipient email", "string", "Who should receive it?"),
    subject: field("subject", "subject", "string", "What subject should I use?"),
    body: field("body", "body", "string", "What should the body say?"),
    query: field("query", "query", "string", "What should I search for?"),
    prompt: field("prompt", "full prompt", "string", "What exactly should the agent do?"),
    planMarkdown: field("planMarkdown", "travel plan content", "string", "Which travel plan should I send?", "travel plan content", false),
    url: field("url", "URL", "string", "Which URL should I use?"),
    origin: field("origin", "origin", "string", "Where should this start?"),
    destination: field("destination", "destination", "string", "Where should this end?"),
    location: field("location", "location", "string", "What location should I use?"),
    description: field("description", "description", "string", "What are the details?"),
    content: field("content", "content", "string", "What content should I use?"),
};

const AGENT_INTAKE_SCHEMAS: Record<string, AgentIntakeSchema> = {
    "teams-agent": {
        agentId: "teams-agent",
        purpose: "Microsoft Teams calls, messages, and meetings.",
        actions: [
            action("send_message", "Send a Teams message.", [FIELDS.contact, FIELDS.message]),
            action("make_call", "Start a Teams call.", [FIELDS.contact]),
            action("schedule_meeting", "Schedule a Teams meeting.", [FIELDS.title, FIELDS.attendees, FIELDS.date, FIELDS.time]),
        ],
    },
    "email-agent": {
        agentId: "email-agent",
        purpose: "Microsoft email inbox, search, read, send, and reply actions.",
        actions: [
            action("read_inbox", "Read recent inbox messages.", []),
            action("read_email", "Read a specific email.", [field("email_reference", "email reference", "string", "Which email should I read?")]),
            action("search_emails", "Search emails.", [FIELDS.query]),
            action("send_email", "Send an email.", [FIELDS.recipientEmail, FIELDS.subject, FIELDS.body]),
            action("reply_to_email", "Reply to an email.", [field("email_reference", "email reference", "string", "Which email should I reply to?"), FIELDS.body]),
        ],
    },
    "calendar-agent": {
        agentId: "calendar-agent",
        purpose: "Microsoft calendar event lookup, conflict checks, and event creation.",
        actions: [
            action("get_calendar_events", "List calendar events.", []),
            action("check_conflicts", "Check availability or conflicts.", [FIELDS.date]),
            action("create_calendar_event", "Create a calendar event.", [FIELDS.title, FIELDS.date, FIELDS.time]),
        ],
    },
    "google-agent": {
        agentId: "google-agent",
        purpose: "Google Workspace Gmail, Drive, Calendar, Meet, Tasks, and web search.",
        actions: [
            action("list_emails", "List recent Gmail emails.", []),
            action("search_emails", "Search Gmail.", [FIELDS.query]),
            action("read_email", "Read or summarize a contextual Gmail email.", [field("email_reference", "email reference", "string", "Which email should I use?")]),
            action("send_email", "Send Gmail email.", [FIELDS.recipientEmail, FIELDS.subject, FIELDS.body]),
            action("reply_email", "Reply to a Gmail email.", [field("email_reference", "email reference", "string", "Which email should I reply to?"), FIELDS.body]),
            action("mark_as_read", "Mark a Gmail email as read.", [field("email_reference", "email reference", "string", "Which email should I mark?")]),
            action("list_files", "List Drive files.", []),
            action("list_pdf_files", "List Drive PDF files.", [FIELDS.query]),
            action("search_files", "Search Drive files.", [FIELDS.query]),
            action("read_file", "Read a contextual Drive file.", [field("file_reference", "file reference", "string", "Which Drive file should I use?")]),
            action("list_events", "List Calendar events.", []),
            action("create_event", "Create a Google Calendar event.", [FIELDS.title, FIELDS.date, FIELDS.time]),
            action("create_meet", "Create a Google Meet meeting.", [FIELDS.title, FIELDS.date, FIELDS.time]),
            action("list_tasks", "List Google tasks.", []),
            action("create_task", "Create a Google task.", [FIELDS.title]),
            action("web_search", "Search the web.", [FIELDS.query]),
        ],
    },
    "maps-agent": {
        agentId: "maps-agent",
        purpose: "Google Maps directions, place search, geocoding, and travel-time estimates.",
        actions: [
            action("get_directions", "Get directions.", [FIELDS.origin, FIELDS.destination]),
            action("search_places", "Search places.", [FIELDS.query, FIELDS.location]),
            action("geocode", "Geocode an address.", [field("address", "address", "string", "What address should I geocode?")]),
            action("distance_matrix", "Calculate distance or travel time.", [field("origins", "origins", "string", "Where should the trip start?"), field("destinations", "destinations", "string", "Where should the trip end?")]),
        ],
    },
    "travel-halper-agent": {
        agentId: "travel-halper-agent",
        purpose: "Travel planning with flights, hotels, itinerary, and email delivery.",
        actions: [
            action("plan_trip", "Plan a trip.", [
                FIELDS.origin,
                FIELDS.destination,
                field("duration_or_dates", "dates or duration", "string", "What dates or how many days is the trip?"),
                field("budget", "budget", "number", "What budget should I plan around?"),
                field("travelers", "number of travelers", "number", "How many people are traveling?"),
            ], {
                examples: [
                    "70,000 rupees only one, me -> budget=70000, travelers=1",
                    "seventy thousand rupees solo -> budget=70000, travelers=1",
                ],
                promptTemplate: (params, userInput) => promptFromParams("Plan a trip using these confirmed details:", params, userInput),
            }),
            action("send_plan_email", "Email a travel plan.", [FIELDS.recipientEmail], {
                optional: [field("threadId", "travel plan thread ID", "string", "Which existing travel plan should I send?", "threadId", false), FIELDS.subject, FIELDS.planMarkdown],
                useUserInputAsPrompt: false,
            }),
        ],
    },
    "emergency-response-agent": {
        agentId: "emergency-response-agent",
        purpose: "Emergency assessment and emergency activation.",
        actions: [
            action("assess_emergency", "Assess an emergency.", [FIELDS.description]),
            action("activate_emergency", "Activate emergency response.", [FIELDS.description, FIELDS.location]),
        ],
    },
    "strata-agent": {
        agentId: "strata-agent",
        purpose: "Financial analytics, dashboards, stock symbols, trends, categories, and insights.",
        actions: [
            action("ask", "Answer a financial question.", [field("symbol", "company or ticker symbol", "string", "Which company or symbol should I analyze?"), field("question", "question", "string", "What do you want to know?")]),
            action("dashboard", "Show dashboard.", [field("symbol", "company or ticker symbol", "string", "Which company or symbol should I use?")]),
            action("trends", "Show trends.", [field("symbol", "company or ticker symbol", "string", "Which company or symbol should I use?")]),
            action("categories", "Show categories.", [field("symbol", "company or ticker symbol", "string", "Which company or symbol should I use?")]),
            action("ai_insights", "Show AI insights.", [field("symbol", "company or ticker symbol", "string", "Which company or symbol should I use?")]),
            action("open_workspace", "Open Stara workspace.", []),
            action("upload_report", "Upload a report.", []),
        ],
    },
    "dia-helper-agent": {
        agentId: "dia-helper-agent",
        purpose: "Diagram generation and updates.",
        actions: [
            action("generate_diagram", "Generate a diagram.", [
                field("diagram_subject", "diagram subject", "string", "What system, process, or flow should the diagram show?"),
                field("diagram_type", "diagram type", "string", "What kind of diagram should it be?"),
            ], {
                promptTemplate: (params, userInput) => promptFromParams("Create a diagram using these confirmed details:", params, userInput),
            }),
            action("update_diagram", "Update an existing diagram.", [field("editInstruction", "edit instruction", "string", "What should I change?")]),
        ],
    },
    "shopgenie-agent": {
        agentId: "shopgenie-agent",
        purpose: "Shopping search and product recommendations.",
        actions: [
            action("recommend_product", "Recommend products.", [FIELDS.query]),
            action("shop_search", "Search shopping options.", [FIELDS.query]),
            action("run_shopgenie", "Run ShopGenie.", [FIELDS.query]),
        ],
    },
    "notion-agent": {
        agentId: "notion-agent",
        purpose: "Notion page search, read, create, and append.",
        actions: [
            action("search_pages", "Search Notion pages.", [FIELDS.query]),
            action("get_page", "Get a Notion page.", [field("pageId", "page ID or page title", "string", "Which Notion page should I use?")]),
            action("create_page", "Create a Notion page.", [FIELDS.title, FIELDS.content]),
            action("append_to_page", "Append to a Notion page.", [field("pageId", "page ID or page title", "string", "Which page should I append to?"), FIELDS.content]),
        ],
    },
    "todo-agent": {
        agentId: "todo-agent",
        purpose: "To-do creation, listing, completion, and deletion.",
        actions: [
            action("list_tasks", "List tasks.", []),
            action("add_task", "Add a task.", [FIELDS.title]),
            action("delete_task", "Delete a task.", [field("title", "task title", "string", "Which task should I delete?")]),
            action("mark_done", "Mark a task done.", [field("title", "task title", "string", "Which task is done?")]),
            action("list_tasks_by_date", "List tasks by date.", [field("datetime", "date", "string", "Which date should I use?")]),
        ],
    },
    "canva-agent": {
        agentId: "canva-agent",
        purpose: "Canva design listing and design creation.",
        actions: [
            action("list_designs", "List Canva designs.", []),
            action("create_design", "Create a Canva design.", [FIELDS.title, FIELDS.description]),
        ],
    },
    "day-planner-agent": {
        agentId: "day-planner-agent",
        purpose: "Daily and weekly planning.",
        actions: [
            action("get_daily_plan", "Get daily plan.", []),
            action("get_weekly_overview", "Get weekly overview.", []),
            action("add_to_plan", "Add an item to the plan.", [FIELDS.title, FIELDS.date]),
        ],
    },
    "discord-agent": {
        agentId: "discord-agent",
        purpose: "Discord account and guild information.",
        actions: [
            action("get_user_info", "Get Discord user info.", []),
            action("list_guilds", "List Discord guilds.", []),
        ],
    },
    "dropbox-agent": {
        agentId: "dropbox-agent",
        purpose: "Dropbox file search, folder creation, and file movement.",
        actions: [
            action("search_files", "Search Dropbox files.", [FIELDS.query]),
            action("create_folder", "Create Dropbox folder.", [field("path", "folder path", "string", "What folder path should I create?")]),
            action("move_file", "Move Dropbox file.", [field("from_path", "source path", "string", "What file should I move?"), field("to_path", "destination path", "string", "Where should I move it?")]),
        ],
    },
    "freshdesk-agent": {
        agentId: "freshdesk-agent",
        purpose: "Freshdesk ticket creation, status lookup, solutions, and ticket lists.",
        actions: [
            action("create_ticket", "Create a support ticket.", [FIELDS.subject, FIELDS.description]),
            action("check_ticket_status", "Check ticket status.", [field("ticket_id", "ticket ID", "string", "Which ticket ID should I check?")]),
            action("search_solutions", "Search support solutions.", [field("keyword", "keyword", "string", "What issue or keyword should I search?")]),
            action("list_tickets", "List tickets.", []),
        ],
    },
    "github-agent": {
        agentId: "github-agent",
        purpose: "GitHub repositories and issues.",
        actions: [
            action("list_repositories", "List repositories.", []),
            action("search_repositories", "Search repositories.", [FIELDS.query]),
            action("get_issue", "Get GitHub issue.", [field("owner", "owner", "string", "Which repo owner?"), field("repo", "repo", "string", "Which repo?"), field("issueNumber", "issue number", "number", "Which issue number?")]),
            action("create_issue", "Create GitHub issue.", [field("owner", "owner", "string", "Which repo owner?"), field("repo", "repo", "string", "Which repo?"), FIELDS.title]),
        ],
    },
    "gitlab-agent": {
        agentId: "gitlab-agent",
        purpose: "GitLab projects and issues.",
        actions: [
            action("list_projects", "List GitLab projects.", []),
            action("get_issue", "Get GitLab issue.", [field("projectId", "project ID", "string", "Which project?"), field("issueNumber", "issue number", "number", "Which issue number?")]),
            action("create_issue", "Create GitLab issue.", [field("projectId", "project ID", "string", "Which project?"), FIELDS.title]),
        ],
    },
    "greenhouse-agent": {
        agentId: "greenhouse-agent",
        purpose: "Greenhouse candidate and interview workflows.",
        actions: [
            action("list_candidates", "List candidates.", []),
            action("get_candidate_resume", "Get candidate resume.", [field("candidate_id", "candidate ID or name", "string", "Which candidate?")]),
            action("schedule_interview", "Schedule interview.", [field("candidate_id", "candidate ID or name", "string", "Which candidate?"), field("interviewer_email", "interviewer email", "string", "Who is interviewing?"), field("start_time", "start time", "string", "When does it start?"), field("end_time", "end time", "string", "When does it end?")]),
        ],
    },
    "jira-agent": {
        agentId: "jira-agent",
        purpose: "Jira issue creation, status, search, and lists.",
        actions: [
            action("list_issues", "List Jira issues.", []),
            action("create_issue", "Create Jira issue.", [FIELDS.title, FIELDS.description]),
            action("get_issue_status", "Get Jira issue status.", [field("issue_key", "issue key", "string", "Which Jira issue key?")]),
            action("search_issues", "Search Jira issues.", [field("jql", "JQL or search query", "string", "What should I search?")]),
        ],
    },
    "linkedin-agent": {
        agentId: "linkedin-agent",
        purpose: "LinkedIn post scheduling and engagement analysis.",
        actions: [
            action("schedule_post", "Schedule LinkedIn post.", [FIELDS.content]),
            action("analyze_engagement", "Analyze engagement.", []),
        ],
    },
    "zoom-agent": {
        agentId: "zoom-agent",
        purpose: "Zoom meeting creation, upcoming meetings, and AI summaries.",
        actions: [
            action("create_meeting", "Create Zoom meeting.", [FIELDS.title, FIELDS.date, FIELDS.time]),
            action("list_upcoming_meetings", "List upcoming Zoom meetings.", []),
            action("get_meeting_summary", "Get meeting summary.", [field("meetingId", "meeting ID", "string", "Which meeting ID?")]),
        ],
    },
    "career-switch-agent": {
        agentId: "career-switch-agent",
        purpose: "Career transition plans with skill gaps, market insight, and roadmaps.",
        actions: [
            action("generate_plan", "Generate a career switch plan.", [
                field("current_role", "current role/background", "string", "What is your current role or background?"),
                field("target_role", "target role", "string", "What role are you targeting?"),
                field("skills", "current skills", "string[]", "Which skills do you already have?"),
                field("experience_years", "years of experience", "number", "How many years of relevant experience do you have?"),
                field("education", "education", "string", "What is your highest education or degree?"),
            ], {
                promptTemplate: (params) => promptFromParams("Generate a career transition plan using these confirmed details:", params, ""),
            }),
        ],
    },
    "startup-fundraising-agent": {
        agentId: "startup-fundraising-agent",
        purpose: "Fundraising planning, investor search, outreach, tracking, and term sheet guidance.",
        actions: [
            action("search_investors", "Find investors.", [field("startup_name", "startup/company", "string", "What is the startup or company?"), field("industry", "industry/market", "string", "What industry or market is it in?"), field("stage", "fundraising stage", "string", "What stage are you raising at?")]),
            action("plan_outreach", "Plan investor outreach.", [field("startup_name", "startup/company", "string", "What is the startup or company?"), field("industry", "industry/market", "string", "What industry or market is it in?"), field("stage", "fundraising stage", "string", "What stage are you raising at?")]),
            action("track_conversation", "Track investor conversation.", [field("startup_name", "startup/company", "string", "Which startup?"), field("investor_name", "investor", "string", "Which investor?"), field("update", "conversation update", "string", "What happened?")]),
            action("term_sheet_guidance", "Give term sheet guidance.", [field("startup_name", "startup/company", "string", "Which startup?"), FIELDS.description]),
            action("generate_fundraising_plan", "Generate fundraising plan.", [field("startup_name", "startup/company", "string", "What is the startup or company?"), field("industry", "industry/market", "string", "What industry or market is it in?"), field("stage", "fundraising stage", "string", "What stage are you raising at?")]),
        ],
    },
    "smart-gtm-agent": {
        agentId: "smart-gtm-agent",
        purpose: "Company research, GTM strategy, positioning, audience, and channels.",
        actions: [
            action("research_company", "Research a company.", [field("company_url", "company URL or name", "string", "Which company URL or name should I analyze?")]),
            action("go_to_market", "Build go-to-market plan.", [field("company_url", "company URL or name", "string", "Which company URL or name should I analyze?"), field("goal", "GTM goal", "string", "What GTM outcome do you want?")]),
            action("channel", "Analyze channels.", [field("company_url", "company URL or name", "string", "Which company URL or name should I analyze?"), field("goal", "channel goal", "string", "What channel question should I answer?")]),
        ],
    },
    "seo-agent": {
        agentId: "seo-agent",
        purpose: "SEO briefs, audits, and article optimization.",
        actions: [
            action("generate_brief", "Generate SEO brief.", [field("topic", "keyword/topic", "string", "What keyword or topic should I optimize for?")]),
            action("audit", "Audit a URL.", [FIELDS.url]),
            action("optimize_article", "Optimize article.", [field("topic", "keyword/topic", "string", "What keyword or topic should I optimize for?"), FIELDS.content]),
        ],
    },
    "dashboard-designer-agent": {
        agentId: "dashboard-designer-agent",
        purpose: "Dashboard design with KPIs, charts, tables, alerts, and audience context.",
        actions: [
            action("design_dashboard", "Design dashboard.", [field("audience", "dashboard audience", "string", "Who is this dashboard for?"), field("metrics", "metrics/KPIs", "string[]", "Which metrics or KPIs should it include?"), field("time_horizon", "time horizon", "string", "What time horizon should it use?")]),
            action("refine_dashboard", "Refine dashboard.", [FIELDS.description]),
            action("update_dashboard", "Update dashboard.", [FIELDS.description]),
        ],
    },
    "ats-agent": {
        agentId: "ats-agent",
        purpose: "Candidate analysis, interview questions, transcripts, and candidate comparison.",
        actions: [
            action("analyze_candidate", "Analyze candidate.", [field("resumeText", "resume/candidate details", "string", "Paste the resume or candidate summary."), field("role", "target role", "string", "What role should I evaluate them for?")]),
            action("generate_interview_questions", "Generate interview questions.", [field("role", "target role", "string", "What role are the questions for?")]),
            action("save_interview_transcript", "Save transcript.", [field("transcript", "interview transcript", "string", "Paste the interview transcript.")]),
            action("compare_candidates", "Compare candidates.", [field("candidates", "candidates", "array", "Which candidates should I compare?")]),
            action("list_candidates", "List candidates.", []),
        ],
    },
    "lms-agent": {
        agentId: "lms-agent",
        purpose: "Learning management dashboards, courses, learners, and assignments.",
        actions: [
            action("learner_progress_dashboard", "Show learner dashboard.", []),
            action("courses_catalog", "Show courses catalog.", []),
            action("learners_directory", "Show learners directory.", []),
            action("learner_detail", "Show learner detail.", [field("learnerName", "learner name", "string", "Which learner should I inspect?")]),
            action("assignments_integrations", "Show assignments and integrations.", []),
            action("list_snapshots", "List snapshots.", []),
        ],
    },
    "data-analyst-agent": {
        agentId: "data-analyst-agent",
        purpose: "Data anomaly monitoring, autonomous analysis, and capabilities.",
        actions: [
            action("list_capabilities", "List capabilities.", []),
            action("monitor", "Monitor/analyze data.", [field("data", "dataset or data description", "string", "What data should I analyze?"), field("goal", "analysis goal", "string", "What should I look for?")]),
            action("autonomous", "Run autonomous analysis.", [field("data", "dataset or data description", "string", "What data should I analyze?"), field("goal", "analysis goal", "string", "What should I answer?")]),
        ],
    },
    "building-construction-agent": {
        agentId: "building-construction-agent",
        purpose: "Construction plans, cost estimates, layouts, and vendor guidance.",
        actions: [
            action("generate_plan", "Generate construction plan.", [FIELDS.location, field("plot_size", "plot size", "string", "What is the plot size?"), field("budget", "budget", "number", "What budget should I estimate against?"), field("requirements", "requirements", "string", "What rooms/floors/style do you need?")]),
            action("list_plans", "List construction plans.", []),
        ],
    },
    "devika-engineer-agent": {
        agentId: "devika-engineer-agent",
        purpose: "Software engineering planning, debugging, implementation strategy, deployment, and reports.",
        actions: [
            action("run_devika_agent", "Run Devika.", [field("goal", "engineering goal", "string", "What exact engineering goal should Devika work on?")]),
            action("plan_project", "Plan project.", [field("goal", "project goal", "string", "What project should I plan?")]),
            action("research_plan", "Research technical plan.", [field("goal", "research goal", "string", "What should I research?")]),
            action("implement_feature", "Plan feature implementation.", [field("featureRequest", "feature request", "string", "What feature should I implement?")]),
            action("fix_bug", "Debug bug.", [field("errorLog", "error or bug details", "string", "Paste the error log or describe the bug.")]),
            action("run_project", "Run project.", [FIELDS.description]),
            action("deploy_project", "Plan deployment.", [FIELDS.description]),
            action("generate_report", "Generate engineering report.", [FIELDS.description]),
            action("answer_question", "Answer engineering question.", [field("question", "question", "string", "What question should I answer?")]),
            action("repo_intake", "Ingest repository.", [field("repositoryUrl", "repository URL", "string", "Which repository URL should I inspect?")]),
            action("browser_strategy", "Create browser automation strategy.", [FIELDS.prompt]),
            action("list_snapshots", "List snapshots.", []),
            action("agent_status", "Get agent status.", []),
            action("token_estimate", "Estimate tokens.", [FIELDS.prompt]),
        ],
    },
};

function getSchema(agentId: string): AgentIntakeSchema {
    const explicit = AGENT_INTAKE_SCHEMAS[agentId];
    if (explicit) return explicit;

    const catalog = getAgentCatalogEntry(agentId);
    return {
        agentId,
        purpose: catalog?.description || "Scoped agent workspace.",
        actions: (catalog?.actions || ["ask"]).map((item) =>
            action(item, `Run ${item}.`, [FIELDS.prompt])
        ),
    };
}

function getActionSchema(agentId: string, actionName: string): ActionIntakeSchema | null {
    return getSchema(agentId).actions.find((item) => item.action === actionName) || null;
}

function allowedActions(agentId: string): string[] {
    return getSchema(agentId).actions.map((item) => item.action);
}

function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
}

function normalizeByType(value: unknown, type: FieldType): unknown {
    if (!hasValue(value)) return undefined;
    if (type === "number") {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const parsed = Number(value.replace(/,/g, ""));
            return Number.isFinite(parsed) ? parsed : value;
        }
        return value;
    }
    if (type === "string") return typeof value === "string" ? value.trim() : String(value);
    if (type === "string[]") {
        if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
        if (typeof value === "string") return [value.trim()].filter(Boolean);
        return value;
    }
    return value;
}

function validateType(value: unknown, type: FieldType): boolean {
    if (!hasValue(value)) return false;
    if (type === "string") return typeof value === "string" && value.trim().length > 0;
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "boolean") return typeof value === "boolean";
    if (type === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
    if (type === "array") return Array.isArray(value) && value.length > 0;
    if (type === "object") return Boolean(value && typeof value === "object" && !Array.isArray(value));
    return true;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const source = fenced || trimmed;
    try {
        return JSON.parse(source) as Record<string, unknown>;
    } catch {
        const start = source.indexOf("{");
        const end = source.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
            } catch {
                return null;
            }
        }
        return null;
    }
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item)).filter(Boolean);
}

function normalizeLlmOutput(value: Record<string, unknown>): LlmWorkspaceIntakeOutput | null {
    const status = value.status;
    if (status !== "ready" && status !== "needs_clarification" && status !== "out_of_scope") return null;
    const normalizedParams = value.normalizedParams;
    if (!normalizedParams || typeof normalizedParams !== "object" || Array.isArray(normalizedParams)) return null;

    return {
        status,
        action: typeof value.action === "string" ? value.action : "",
        normalizedParams: normalizedParams as Record<string, unknown>,
        missingFields: asStringArray(value.missingFields),
        clarificationMessage: typeof value.clarificationMessage === "string" ? value.clarificationMessage.trim() : "",
        reasoningSummary: typeof value.reasoningSummary === "string" ? value.reasoningSummary.trim() : "",
    };
}

function validateOutput(agentId: string, output: LlmWorkspaceIntakeOutput): {
    valid: true;
    output: LlmWorkspaceIntakeOutput;
    actionSchema: ActionIntakeSchema;
} | {
    valid: false;
    error: string;
    missingFields: IntakeField[];
    actionSchema?: ActionIntakeSchema;
} {
    const actions = allowedActions(agentId);
    if (!actions.includes(output.action)) {
        return {
            valid: false,
            error: `Action "${output.action}" is not allowed for locked agent ${agentId}. Allowed actions: ${actions.join(", ")}.`,
            missingFields: [],
        };
    }

    const actionSchema = getActionSchema(agentId, output.action);
    if (!actionSchema) {
        return {
            valid: false,
            error: `No intake schema exists for action "${output.action}".`,
            missingFields: [],
        };
    }

    const normalizedParams = { ...output.normalizedParams };
    for (const field of [...actionSchema.required, ...(actionSchema.optional || [])]) {
        if (Object.prototype.hasOwnProperty.call(normalizedParams, field.key)) {
            normalizedParams[field.key] = normalizeByType(normalizedParams[field.key], field.type);
        }
    }
    const normalizedOutput = { ...output, normalizedParams };

    if (output.status === "out_of_scope") {
        if (!output.clarificationMessage) {
            return {
                valid: false,
                error: "out_of_scope output must include clarificationMessage.",
                missingFields: [],
                actionSchema,
            };
        }
        return { valid: true, output: normalizedOutput, actionSchema };
    }

    const missingFields = actionSchema.required.filter((field) => {
        const value = normalizedParams[field.key];
        return !validateType(value, field.type);
    });

    if (output.status === "ready" && missingFields.length > 0) {
        return {
            valid: false,
            error: `ready output is missing or mistyped required fields: ${missingFields.map((field) => `${field.key}:${field.type}`).join(", ")}.`,
            missingFields,
            actionSchema,
        };
    }

    if (output.status === "needs_clarification" && !output.clarificationMessage) {
        return {
            valid: false,
            error: "needs_clarification output must include clarificationMessage.",
            missingFields,
            actionSchema,
        };
    }

    return { valid: true, output: normalizedOutput, actionSchema };
}

function buildParameters(schema: ActionIntakeSchema, output: LlmWorkspaceIntakeOutput, userInput: string): Record<string, unknown> {
    const params = { ...output.normalizedParams };
    if (!params.prompt && schema.promptTemplate) {
        params.prompt = schema.promptTemplate(params, userInput);
    }
    if (schema.useUserInputAsPrompt !== false && !params.prompt) params.prompt = userInput;
    if (!params.parameters) params.parameters = userInput;
    if (!params.query && typeof params.prompt === "string") params.query = params.prompt;
    return params;
}

function fallbackClarification(agentId: string, suggestedAction: string): WorkspaceIntakeResult {
    const agent = getAgentCatalogEntry(agentId);
    const actionSchema =
        getActionSchema(agentId, suggestedAction) ||
        getSchema(agentId).actions[0];
    const missingFields = actionSchema.required;
    if (missingFields.length === 0) {
        return {
            ok: true,
            status: "ready",
            action: actionSchema.action,
            values: {},
            missingFields: [],
            reasoningSummary: "Gemini intake unavailable; schema fallback determined no required input.",
        };
    }
    const questions = missingFields.map((item, index) => `${index + 1}. ${item.question}`);
    const content = [
        `I can use ${agent?.name || agentId}, but I need a few details before I run the agent.`,
        "",
        ...questions,
    ].join("\n");

    return {
        ok: false,
        status: "needs_clarification",
        action: actionSchema.action,
        values: {},
        missingFields,
        content,
        validationError: "Gemini intake is unavailable; falling back to schema clarification.",
    };
}

function stringifyForPrompt(value: unknown): string {
    return JSON.stringify(value, null, 2).slice(0, 18000);
}

function buildLlmPrompt(params: {
    agentId: string;
    agentName: string;
    userInput: string;
    context: ConversationContext;
    suggestedAction: string;
    repair?: {
        validationError: string;
        invalidOutput: unknown;
    };
}): string {
    const schema = getSchema(params.agentId);
    const recentMessages = params.context.recent_messages.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
        agentId: message.agentId,
    }));

    return [
        "You are the structured intake controller for a locked Pian agent workspace.",
        `Locked agent: ${params.agentName} (${params.agentId}).`,
        "You may choose ONLY one action from this locked agent. Never choose another agent.",
        "Understand natural language flexibly. Convert values like 'seventy thousand rupees', '70k INR', 'only one, me', and '$70,000' into the schema's expected JSON types.",
        "Merge current user input with prior user/assistant messages. If the user is answering a previous clarification, keep known fields from earlier turns.",
        "Return ONLY valid JSON with exactly this shape:",
        '{"status":"ready|needs_clarification|out_of_scope","action":"...","normalizedParams":{},"missingFields":[],"clarificationMessage":"...","reasoningSummary":"..."}',
        "Use status=ready only when all required fields for the selected action are present and normalized.",
        "Use status=needs_clarification when required fields are missing; ask only for missing fields.",
        "Use status=out_of_scope only when the request cannot be handled by the locked agent.",
        "If this is a repair attempt for wrong keys, wrong JSON shape, or wrong value types, fix the JSON internally. Do not ask the user again unless the actual information is missing or ambiguous.",
        `Suggested action from deterministic UI context: ${params.suggestedAction}. You may change it only to another action in the locked agent schema.`,
        `Agent action schema:\n${stringifyForPrompt(schema)}`,
        `Recent conversation:\n${stringifyForPrompt(recentMessages)}`,
        `Current user message:\n${params.userInput}`,
        params.repair
            ? `Your previous output failed backend validation. Fix it or ask a clarification.\nValidation error: ${params.repair.validationError}\nInvalid output:\n${stringifyForPrompt(params.repair.invalidOutput)}`
            : "",
    ].filter(Boolean).join("\n\n");
}

async function callGeminiJson(prompt: string, model?: string): Promise<Record<string, unknown> | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    const selectedModel = model && model.toLowerCase().includes("gemini") ? model : DEFAULT_INTAKE_MODEL;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: selectedModel,
        config: {
            temperature: 0,
            responseMimeType: "application/json",
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return parseJsonObject(response.text || "");
}

async function runLlmIntake(params: {
    agentId: string;
    agentName: string;
    action: string;
    userInput: string;
    context: ConversationContext;
    model?: string;
    repair?: {
        validationError: string;
        invalidOutput: unknown;
    };
}): Promise<Record<string, unknown> | null> {
    const prompt = buildLlmPrompt({
        agentId: params.agentId,
        agentName: params.agentName,
        userInput: params.userInput,
        context: params.context,
        suggestedAction: params.action,
        repair: params.repair,
    });
    return callGeminiJson(prompt, params.model);
}

export async function resolveWorkspaceIntakeWithLlm(params: {
    agentId: string;
    agentName: string;
    action: string;
    userInput: string;
    context: ConversationContext;
    model?: string;
}): Promise<WorkspaceIntakeResult> {
    const firstRaw = await runLlmIntake(params);
    if (!firstRaw) return fallbackClarification(params.agentId, params.action);

    const parsed = normalizeLlmOutput(firstRaw);
    if (!parsed) {
        const repairedRaw = await runLlmIntake({
            ...params,
            repair: {
                validationError: "The model did not return the required JSON shape.",
                invalidOutput: firstRaw,
            },
        });
        const repaired = repairedRaw ? normalizeLlmOutput(repairedRaw) : null;
        if (!repaired) {
            return fallbackClarification(params.agentId, params.action);
        }
        return finalizeIntake(params, repaired, repairedRaw);
    }

    const validation = validateOutput(params.agentId, parsed);
    if (!validation.valid) {
        const repairedRaw = await runLlmIntake({
            ...params,
            repair: {
                validationError: validation.error,
                invalidOutput: firstRaw,
            },
        });
        const repaired = repairedRaw ? normalizeLlmOutput(repairedRaw) : null;
        if (!repaired) {
            return {
                ok: false,
                status: "needs_clarification",
                action: validation.actionSchema?.action || params.action,
                values: parsed.normalizedParams,
                missingFields: validation.missingFields,
                content: validation.missingFields.length > 0
                    ? validation.missingFields.map((field) => field.question).join("\n")
                    : "I need one more detail before I can run this agent. Please restate the missing information.",
                rawLlmOutput: firstRaw,
                validationError: validation.error,
            };
        }
        return finalizeIntake(params, repaired, repairedRaw);
    }

    return finalizeValidatedIntake(params, validation.output, validation.actionSchema, firstRaw);
}

function finalizeIntake(
    params: {
        agentId: string;
        action: string;
        userInput: string;
    },
    output: LlmWorkspaceIntakeOutput,
    raw: unknown
): WorkspaceIntakeResult {
    const validation = validateOutput(params.agentId, output);
    if (!validation.valid) {
        return {
            ok: false,
            status: "needs_clarification",
            action: validation.actionSchema?.action || output.action || params.action,
            values: output.normalizedParams || {},
            missingFields: validation.missingFields,
            content: output.clarificationMessage || validation.missingFields.map((field) => field.question).join("\n") || validation.error,
            rawLlmOutput: raw,
            validationError: validation.error,
            reasoningSummary: output.reasoningSummary,
        };
    }
    return finalizeValidatedIntake(params, validation.output, validation.actionSchema, raw);
}

function finalizeValidatedIntake(
    params: {
        userInput: string;
    },
    output: LlmWorkspaceIntakeOutput,
    actionSchema: ActionIntakeSchema,
    raw: unknown
): WorkspaceIntakeResult {
    if (output.status !== "ready") {
        const missingFields = actionSchema.required.filter((field) => output.missingFields.includes(field.key));
        return {
            ok: false,
            status: output.status,
            action: output.action,
            values: output.normalizedParams,
            missingFields,
            content: output.clarificationMessage,
            rawLlmOutput: raw,
            reasoningSummary: output.reasoningSummary,
        };
    }

    return {
        ok: true,
        status: "ready",
        action: output.action,
        values: output.normalizedParams,
        missingFields: [],
        parameters: buildParameters(actionSchema, output, params.userInput),
        rawLlmOutput: raw,
        reasoningSummary: output.reasoningSummary,
    };
}

export function getWorkspaceIntakePromptRules(agentId: string): string[] {
    const schema = getSchema(agentId);
    const rules = schema.actions.map((item) => {
        const required = item.required.map((field) => `${field.key}:${field.type}`).join(", ") || "no required fields";
        return `For ${item.action}, required JSON fields are: ${required}.`;
    });

    return [
        "Use LLM structured intake for this workspace: choose an action only from this locked agent, extract normalizedParams, and ask for missing fields before tool execution.",
        ...rules,
        "Return JSON in the workspace intake shape; backend validation will reject malformed or incomplete values and send the validation error back for repair.",
    ];
}

export function getWorkspaceIntakeSchemaForAgent(agentId: string): AgentIntakeSchema {
    return getSchema(agentId);
}

export function verifyAllCatalogAgentsHaveIntakeSchemas(): string[] {
    return AGENT_CATALOG
        .filter((agent) => !agent.id.endsWith("-bundle"))
        .map((agent) => agent.id)
        .filter((agentId) => !AGENT_INTAKE_SCHEMAS[agentId]);
}
