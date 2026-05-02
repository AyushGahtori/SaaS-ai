"use client";

import React from "react";

interface GenericAgentResultCardProps {
    summary?: string | null;
    details?: Array<{ label: string; value: string }>;
}

export const GenericAgentResultCard: React.FC<GenericAgentResultCardProps> = ({
    summary,
    details = [],
}) => {
    return (
        <div className="mt-3 space-y-2">
            {summary ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 whitespace-pre-wrap break-words">
                    {summary}
                </div>
            ) : null}
            {details.length > 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">
                    <div className="space-y-1.5">
                        {details.map((item) => (
                            <div
                                key={`${item.label}-${item.value}`}
                                className="flex items-start justify-between gap-3"
                            >
                                <span className="text-white/50">{item.label}</span>
                                <span className="text-right text-white/80 break-words">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
