"use client";

import React from "react";

interface InterpretedAgentGuidanceProps {
    summary: string;
    suggestedAction?: string;
    suggestedInputs?: string[];
}

export const InterpretedAgentGuidance: React.FC<InterpretedAgentGuidanceProps> = ({
    summary,
    suggestedAction,
    suggestedInputs,
}) => {
    return (
        <div className="flex gap-3 px-4 py-4 justify-start">
            <div className="max-w-[72%] rounded-2xl rounded-bl-sm bg-white/5 px-4 py-3 text-sm text-[#E5E5E5] leading-relaxed">
                <p className="whitespace-pre-wrap break-words">{summary}</p>
                {suggestedAction ? (
                    <p className="mt-2 text-white/80 whitespace-pre-wrap break-words">
                        <span className="font-medium text-white/90">Next step: </span>
                        {suggestedAction}
                    </p>
                ) : null}
                {Array.isArray(suggestedInputs) && suggestedInputs.length > 0 ? (
                    <p className="mt-1 text-white/70 whitespace-pre-wrap break-words">
                        <span className="font-medium text-white/85">Needed: </span>
                        {suggestedInputs.join(", ")}
                    </p>
                ) : null}
            </div>
        </div>
    );
};

