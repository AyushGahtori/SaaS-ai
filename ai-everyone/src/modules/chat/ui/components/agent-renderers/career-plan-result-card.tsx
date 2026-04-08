/**
 * Career Plan Result Card Component
 * Renders the AI-generated career transition plan in a structured card format.
 * Displays skill gap analysis, roadmap phases, project recommendations, and job market insights.
 */

import React from "react";
import {
    ChevronDown,
    ChevronUp,
    Target,
    TrendingUp,
    Briefcase,
    Code,
    Users,
    Zap,
} from "lucide-react";

interface CareerPlan {
    career_summary: string;
    skill_gap_breakdown: {
        core_skills: string[];
        supporting_skills: string[];
        optional_skills: string[];
    };
    market_insights: {
        top_companies_hiring: string[];
        common_patterns: string[];
        key_tools_and_technologies: string[];
        demand_level: string;
    };
    roadmap: Array<{
        phase: string;
        duration: string;
        goals: string[];
        resources: string[];
    }>;
    project_recommendations: Array<{
        title: string;
        problem_solved: string;
        tech_stack: string[];
        deliverable: string;
        resume_impact: string;
    }>;
    job_application_strategy: {
        start_applying_at: string;
        target_role_types: string[];
        tips: string[];
    };
    final_advice: string;
}

interface CareerPlanResultCardProps {
    result: Record<string, unknown>;
}

export const CareerPlanResultCard: React.FC<CareerPlanResultCardProps> = ({ result }) => {
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        roadmap: false,
        skillGap: false,
        projects: false,
        marketInsights: false,
        jobStrategy: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const plan = (result?.career_plan || {}) as Partial<CareerPlan>;
    const skillGap = (result?.skill_gap || {}) as any;
    const requestSummary = (result?.request_summary || {}) as any;

    const demandColor = {
        "very high": "bg-green-500/20 text-green-300 border-green-500/30",
        high: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        moderate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        low: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        unknown: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    };

    const demandBadgeClass =
        demandColor[plan.market_insights?.demand_level as keyof typeof demandColor] ||
        demandColor.unknown;

    return (
        <div className="mt-4 space-y-3 text-white/90">
            {/* Career Summary */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm leading-relaxed">{plan.career_summary}</p>
            </div>

            {/* Skill Coverage Progress */}
            {requestSummary?.skill_coverage_percent !== undefined && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase text-white/60">Skill Coverage</span>
                        <span className="text-sm font-bold text-cyan-300">
                            {Math.round(requestSummary.skill_coverage_percent)}%
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/30 overflow-hidden">
                        <div
                            className={`h-full bg-linear-to-r from-cyan-500 to-blue-500 rounded-full transition-all`}
                            style={{
                                width: `${Math.min(requestSummary.skill_coverage_percent || 0, 100)}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Skill Gap Breakdown */}
            <CollapsibleSection
                title="Skill Gap Breakdown"
                isOpen={expandedSections.skillGap}
                onToggle={() => toggleSection("skillGap")}
                icon={<Code className="w-4 h-4" />}
            >
                <div className="space-y-2">
                    {plan.skill_gap_breakdown?.core_skills && plan.skill_gap_breakdown.core_skills.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-green-400 mb-1">Core Skills</p>
                            <div className="flex flex-wrap gap-1">
                                {plan.skill_gap_breakdown.core_skills.slice(0, 5).map((skill, idx) => (
                                    <span
                                        key={`${skill}-${idx}`}
                                        className="inline-block rounded bg-green-500/20 px-2 py-1 text-xs text-green-300"
                                    >
                                        {skill}
                                    </span>
                                ))}
                                {plan.skill_gap_breakdown.core_skills.length > 5 && (
                                    <span className="text-xs text-white/50">
                                        +{plan.skill_gap_breakdown.core_skills.length - 5} more
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {plan.skill_gap_breakdown?.supporting_skills &&
                        plan.skill_gap_breakdown.supporting_skills.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-blue-400 mb-1">Supporting Skills</p>
                                <div className="flex flex-wrap gap-1">
                                    {plan.skill_gap_breakdown.supporting_skills.slice(0, 4).map((skill, idx) => (
                                        <span
                                            key={`${skill}-${idx}`}
                                            className="inline-block rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-300"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                    {plan.skill_gap_breakdown.supporting_skills.length > 4 && (
                                        <span className="text-xs text-white/50">
                                            +{plan.skill_gap_breakdown.supporting_skills.length - 4} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                </div>
            </CollapsibleSection>

            {/* Market Insights */}
            <CollapsibleSection
                title="Market Insights"
                isOpen={expandedSections.marketInsights}
                onToggle={() => toggleSection("marketInsights")}
                icon={<TrendingUp className="w-4 h-4" />}
            >
                <div className="space-y-2">
                    {/* Demand Level Badge */}
                    {plan.market_insights?.demand_level && (
                        <div>
                            <span
                                className={`inline-flex items-center rounded border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${demandBadgeClass}`}
                            >
                                {plan.market_insights.demand_level} demand
                            </span>
                        </div>
                    )}

                    {/* Top Companies */}
                    {plan.market_insights?.top_companies_hiring &&
                        plan.market_insights.top_companies_hiring.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-white/70 mb-1">Top Companies Hiring</p>
                                <p className="text-xs text-white/60">
                                    {plan.market_insights.top_companies_hiring.slice(0, 3).join(", ")}
                                    {plan.market_insights.top_companies_hiring.length > 3 &&
                                        `, +${plan.market_insights.top_companies_hiring.length - 3} more`}
                                </p>
                            </div>
                        )}

                    {/* Key Technologies */}
                    {plan.market_insights?.key_tools_and_technologies &&
                        plan.market_insights.key_tools_and_technologies.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-white/70 mb-1">Common Tech Stack</p>
                                <div className="flex flex-wrap gap-1">
                                    {plan.market_insights.key_tools_and_technologies.slice(0, 6).map((tech, idx) => (
                                        <span
                                            key={`${tech}-${idx}`}
                                            className="inline-block rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300"
                                        >
                                            {tech}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                </div>
            </CollapsibleSection>

            {/* Roadmap Phases */}
            <CollapsibleSection
                title="Personalized Roadmap"
                isOpen={expandedSections.roadmap}
                onToggle={() => toggleSection("roadmap")}
                icon={<Target className="w-4 h-4" />}
            >
                <div className="space-y-2">
                    {plan.roadmap && plan.roadmap.length > 0 ? (
                        plan.roadmap.map((phase, idx) => (
                            <div key={idx} className="rounded border border-white/5 bg-black/20 p-2">
                                <div className="flex items-start gap-2 mb-1">
                                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/30 flex-shrink-0">
                                        <span className="text-xs font-bold text-cyan-300">{idx + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white">{phase.phase}</p>
                                        <p className="text-xs text-white/50">{phase.duration}</p>
                                    </div>
                                </div>
                                {phase.goals && phase.goals.length > 0 && (
                                    <ul className="ml-8 space-y-1 text-xs text-white/70">
                                        {phase.goals.slice(0, 3).map((goal, gidx) => (
                                            <li key={gidx}>• {goal}</li>
                                        ))}
                                        {phase.goals.length > 3 && (
                                            <li className="text-white/50">+{phase.goals.length - 3} more goals</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-white/50">No roadmap phases available.</p>
                    )}
                </div>
            </CollapsibleSection>

            {/* Project Recommendations */}
            <CollapsibleSection
                title="Project Recommendations"
                isOpen={expandedSections.projects}
                onToggle={() => toggleSection("projects")}
                icon={<Briefcase className="w-4 h-4" />}
            >
                <div className="space-y-2">
                    {plan.project_recommendations && plan.project_recommendations.length > 0 ? (
                        plan.project_recommendations.slice(0, 3).map((proj, idx) => (
                            <div key={idx} className="rounded border border-white/5 bg-black/20 p-2">
                                <div className="mb-1">
                                    <p className="text-xs font-semibold text-white">{proj.title}</p>
                                    <p className="text-xs text-white/60">{proj.problem_solved}</p>
                                </div>
                                <div className="space-y-1">
                                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {proj.tech_stack.map((tech, tidx) => (
                                                <span
                                                    key={tidx}
                                                    className="text-xs bg-orange-500/20 text-orange-300 rounded px-1.5 py-0.5"
                                                >
                                                    {tech}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-white/60">
                                        <strong className="text-white/80">Deliverable:</strong> {proj.deliverable}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-white/50">No project recommendations available.</p>
                    )}
                </div>
            </CollapsibleSection>

            {/* Job Application Strategy */}
            <CollapsibleSection
                title="Job Application Strategy"
                isOpen={expandedSections.jobStrategy}
                onToggle={() => toggleSection("jobStrategy")}
                icon={<Users className="w-4 h-4" />}
            >
                <div className="space-y-2">
                    {plan.job_application_strategy && (
                        <>
                            <div>
                                <p className="text-xs font-semibold text-white/70 mb-1">Start Applying At</p>
                                <p className="text-xs text-white/60 bg-white/5 rounded px-2 py-1">
                                    {plan.job_application_strategy.start_applying_at}
                                </p>
                            </div>

                            {plan.job_application_strategy.target_role_types &&
                                plan.job_application_strategy.target_role_types.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-white/70 mb-1">Target Roles</p>
                                        <div className="flex flex-wrap gap-1">
                                            {plan.job_application_strategy.target_role_types.map((role, ridx) => (
                                                <span
                                                    key={ridx}
                                                    className="text-xs bg-blue-500/20 text-blue-300 rounded px-2 py-0.5"
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {plan.job_application_strategy.tips &&
                                plan.job_application_strategy.tips.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-white/70 mb-1">Application Tips</p>
                                        <ul className="space-y-1 text-xs text-white/60">
                                            {plan.job_application_strategy.tips.map((tip, tidx) => (
                                                <li key={tidx}>• {tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                        </>
                    )}
                </div>
            </CollapsibleSection>

            {/* Final Advice */}
            {plan.final_advice && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-semibold text-white/70 mb-2">Final Advice</p>
                    <p className="text-xs leading-relaxed text-white/80">{plan.final_advice}</p>
                </div>
            )}
        </div>
    );
};

interface CollapsibleSectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
    children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    isOpen,
    onToggle,
    icon,
    children,
}) => (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-3 hover:bg-white/10 transition-colors"
        >
            <div className="flex items-center gap-2">
                <span className="text-white/60">{icon}</span>
                <span className="text-sm font-semibold text-white">{title}</span>
            </div>
            {isOpen ? (
                <ChevronUp className="w-4 h-4 text-white/60" />
            ) : (
                <ChevronDown className="w-4 h-4 text-white/60" />
            )}
        </button>
        {isOpen && <div className="border-t border-white/10 p-3 space-y-2">{children}</div>}
    </div>
);
