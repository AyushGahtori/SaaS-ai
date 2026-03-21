/**
 * Onboarding Survey Types
 */

export type SurveyRole =
    | "developer"
    | "product_manager"
    | "startup_founder"
    | "business_owner"
    | "data_scientist"
    | "designer"
    | "marketing_sales"
    | "business_operations"
    | "student"
    | "educator"
    | "other";

export interface SurveyStep {
    id: string;
    question: string;
    subtext?: string;
    memoryKey: string;
    options: { label: string; value: string }[];
}

export interface SurveyAnswer {
    key: string;
    value: string | undefined;
}

/** Step 2 options vary by role */
export const ROLE_FOCUS_OPTIONS: Record<SurveyRole | "default", { label: string; value: string }[]> = {
    developer: [
        { label: "Building a product", value: "building a product" },
        { label: "Learning new tech", value: "learning new technologies" },
        { label: "Interview prep", value: "preparing for interviews" },
        { label: "Open source", value: "contributing to open source" },
        { label: "Professional growth", value: "professional development" },
        { label: "Side project", value: "working on a side project" },
    ],
    student: [
        { label: "Get a job", value: "getting a job" },
        { label: "Get into grad school", value: "getting into graduate school" },
        { label: "Build projects", value: "building projects" },
        { label: "Learn AI/ML", value: "learning AI and machine learning" },
        { label: "Academic research", value: "academic research" },
        { label: "Freelancing", value: "freelancing" },
    ],
    designer: [
        { label: "Product design", value: "product design" },
        { label: "UI/UX work", value: "UI/UX design" },
        { label: "Brand identity", value: "brand identity" },
        { label: "Freelance work", value: "freelance client work" },
        { label: "Learning design", value: "learning design" },
        { label: "Side project", value: "working on a side project" },
    ],
    product_manager: [
        { label: "Launching a product", value: "launching a product" },
        { label: "Growing a product", value: "growing an existing product" },
        { label: "Learning PM strategy", value: "learning product strategy" },
        { label: "Switching roles", value: "transitioning roles" },
        { label: "Building team", value: "building my team" },
        { label: "Side project", value: "working on a side project" },
    ],
    startup_founder: [
        { label: "Idea stage", value: "validating an idea" },
        { label: "Building MVP", value: "building an MVP" },
        { label: "Early customers", value: "acquiring early customers" },
        { label: "Scaling", value: "scaling the business" },
        { label: "Fundraising", value: "fundraising" },
        { label: "Hiring", value: "hiring and building team" },
    ],
    default: [
        { label: "Learn new skills", value: "learning new skills" },
        { label: "Build something", value: "building a project" },
        { label: "Find a job", value: "finding a job" },
        { label: "Grow my career", value: "growing my career" },
        { label: "Explore AI", value: "exploring AI tools" },
        { label: "Automate my work", value: "automating my work" },
    ],
    business_owner: [],
    data_scientist: [],
    marketing_sales: [],
    business_operations: [],
    educator: [],
    other: [],
};

// Fill in missing roles with default
(["business_owner", "data_scientist", "marketing_sales", "business_operations", "educator", "other"] as SurveyRole[])
    .forEach((role) => {
        if (ROLE_FOCUS_OPTIONS[role].length === 0) {
            ROLE_FOCUS_OPTIONS[role] = ROLE_FOCUS_OPTIONS.default;
        }
    });

export const SURVEY_STEP_1: SurveyStep = {
    id: "role",
    question: "What describes you best?",
    subtext: "If you wear many hats, pick what you do most often.",
    memoryKey: "role",
    options: [
        { label: "Developer", value: "developer" },
        { label: "Product Manager", value: "product_manager" },
        { label: "Startup Founder", value: "startup_founder" },
        { label: "Business Owner", value: "business_owner" },
        { label: "Data Scientist / Analyst", value: "data_scientist" },
        { label: "Designer", value: "designer" },
        { label: "Marketing & Sales", value: "marketing_sales" },
        { label: "Business Operations", value: "business_operations" },
        { label: "Student", value: "student" },
        { label: "Educator / Teacher", value: "educator" },
        { label: "Other", value: "other" },
    ],
};

export const SURVEY_STEP_3: SurveyStep = {
    id: "goal",
    question: "What's your primary goal right now?",
    memoryKey: "current_goal",
    options: [
        { label: "Build a product / startup", value: "build a product or startup" },
        { label: "Learn AI & agentic workflows", value: "learn AI and agentic workflows" },
        { label: "Prepare for job / interviews", value: "prepare for job interviews" },
        { label: "Get better at my current role", value: "improve in my current role" },
        { label: "Automate my work", value: "automate my work" },
        { label: "Explore AI tools", value: "explore AI tools" },
        { label: "Academic / research goals", value: "achieve academic or research goals" },
        { label: "Other", value: "other goals" },
    ],
};

export const SURVEY_STEP_4: SurveyStep = {
    id: "answer_style",
    question: "How do you prefer responses?",
    memoryKey: "answer_style",
    options: [
        { label: "Concise & direct", value: "concise" },
        { label: "Detailed explanations", value: "detailed" },
        { label: "Step-by-step breakdowns", value: "step-by-step" },
        { label: "Code-heavy", value: "code-heavy" },
        { label: "No preference", value: "no preference" },
    ],
};
