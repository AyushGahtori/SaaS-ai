"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Map,
  Zap,
  Eye,
  RefreshCw,
  CheckCircle2,
  Wrench,
  Loader2,
} from "lucide-react";
import type { AgentActivity, AgentPhase } from "@/types";

interface Props {
  activity: AgentActivity;
}

const PHASE_CONFIG: Record<
  AgentPhase,
  { label: string; Icon: React.ElementType; color: string }
> = {
  thinking:   { label: "Thinking",   Icon: Brain,       color: "text-violet-400" },
  planning:   { label: "Planning",   Icon: Map,         color: "text-blue-400" },
  acting:     { label: "Acting",     Icon: Zap,         color: "text-amber-400" },
  observing:  { label: "Observing",  Icon: Eye,         color: "text-green-400" },
  reflecting: { label: "Reflecting", Icon: RefreshCw,   color: "text-pink-400" },
  responding: { label: "Responding", Icon: CheckCircle2,color: "text-emerald-400" },
};

const TOOL_LABELS: Record<string, string> = {
  analyze_product_image:    "Analysing product image",
  research_poster_inspiration: "Researching poster inspiration",
  generate_marketing_copy:  "Writing marketing copy",
  generate_social_media_post: "Crafting social post",
  generate_html_poster:     "Designing poster",
  generate_hashtags:        "Generating hashtags",
  get_product_context:      "Loading product context",
  save_generated_content:   "Saving content",
  generate_campaign_brief:  "Building campaign",
};

export default function AgentActivityPanel({ activity }: Props) {
  const phase = PHASE_CONFIG[activity.phase] || PHASE_CONFIG.thinking;
  const { Icon } = phase;

  return (
    <div className="agent-activity max-w-sm">
      {/* Current phase */}
      <div className="flex items-center gap-2 mb-2">
        <Loader2 size={12} className={`animate-spin ${phase.color}`} />
        <span className={`text-xs font-medium ${phase.color}`}>
          {phase.label}
        </span>
        <span className="text-xs text-neutral-600">·</span>
        <span className="text-xs text-neutral-500 truncate">
          {activity.description}
        </span>
      </div>

      {/* Tool calls */}
      {activity.toolCalls.length > 0 && (
        <div className="space-y-1.5">
          {activity.toolCalls.map((tc, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0">
                {tc.success === undefined ? (
                  <Loader2 size={10} className="animate-spin text-amber-400" />
                ) : tc.success ? (
                  <CheckCircle2 size={10} className="text-green-400" />
                ) : (
                  <span className="text-red-400 text-[10px]">✗</span>
                )}
              </div>
              <span className="tool-chip">
                <Wrench size={9} />
                {TOOL_LABELS[tc.tool] || tc.tool}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
