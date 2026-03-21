"use client";

/**
 * OnboardingSurvey — Full-screen modal survey for new users.
 *
 * Design inspired by Replit's onboarding:
 * - No text input fields — all answers are option chips
 * - Back / Next navigation
 * - Skip option on every step
 * - 4 steps max
 */

import { useState, useCallback } from "react";
import {
    SURVEY_STEP_1,
    SURVEY_STEP_3,
    SURVEY_STEP_4,
    ROLE_FOCUS_OPTIONS,
    type SurveyAnswer,
    type SurveyRole,
    type SurveyStep,
} from "@/modules/onboarding/types";

// ---------------------------------------------------------------------------
// Step 2 is role-adaptive
// ---------------------------------------------------------------------------

function buildStep2(role: SurveyRole | undefined): SurveyStep {
    const roleKey = (role as SurveyRole) ?? "default";
    const options =
        ROLE_FOCUS_OPTIONS[roleKey] && ROLE_FOCUS_OPTIONS[roleKey].length > 0
            ? ROLE_FOCUS_OPTIONS[roleKey]
            : ROLE_FOCUS_OPTIONS.default;
    return {
        id: "current_focus",
        question:
            role === "student"
                ? "What's your primary study goal?"
                : "What's your current focus?",
        memoryKey: "current_focus",
        options,
    };
}

// ---------------------------------------------------------------------------
// Chip component
// ---------------------------------------------------------------------------

function OptionChip({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                px-4 py-2 rounded-md text-sm font-medium border transition-all duration-150
                cursor-pointer select-none
                ${selected
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-neutral-300 border-neutral-600 hover:border-neutral-400 hover:text-white"
                }
            `}
        >
            {label}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface OnboardingSurveyProps {
    userId: string;
    onComplete: () => void;
}

export function OnboardingSurvey({ userId, onComplete }: OnboardingSurveyProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | undefined>>({});
    const [submitting, setSubmitting] = useState(false);

    // Build dynamic steps each render
    const selectedRole = answers["role"] as SurveyRole | undefined;
    const steps: SurveyStep[] = [
        SURVEY_STEP_1,
        buildStep2(selectedRole),
        SURVEY_STEP_3,
        SURVEY_STEP_4,
    ];

    const currentStep = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;
    const selectedValue = answers[currentStep.memoryKey];

    const selectOption = useCallback((key: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [key]: value }));
    }, []);

    const skipStep = useCallback(() => {
        // Mark as explicitly skipped (undefined = not answered)
        setAnswers((prev) => ({ ...prev, [currentStep.memoryKey]: undefined }));
        if (isLastStep) {
            submit({ ...answers, [currentStep.memoryKey]: undefined });
        } else {
            setStepIndex((i) => i + 1);
        }
    }, [currentStep.memoryKey, isLastStep, answers]);

    const next = useCallback(() => {
        if (isLastStep) {
            submit(answers);
        } else {
            setStepIndex((i) => i + 1);
        }
    }, [isLastStep, answers]);

    const back = useCallback(() => {
        setStepIndex((i) => Math.max(0, i - 1));
    }, []);

    const submit = async (finalAnswers: Record<string, string | undefined>) => {
        setSubmitting(true);
        try {
            // Convert to array format for the API
            const answerArray: SurveyAnswer[] = Object.entries(finalAnswers).map(([key, value]) => ({
                key,
                value,
            }));

            await fetch("/api/survey", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, answers: answerArray }),
            });
        } catch (err) {
            console.error("[OnboardingSurvey] submit error:", err);
        } finally {
            setSubmitting(false);
            onComplete();
        }
    };

    const progress = ((stepIndex + 1) / steps.length) * 100;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-[#1a1a1a] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Progress bar */}
                <div className="h-1 bg-neutral-800">
                    <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="p-8">
                    {/* Step indicator */}
                    <p className="text-xs text-neutral-500 mb-6 font-mono">
                        {stepIndex + 1} / {steps.length}
                    </p>

                    {/* Question */}
                    <h2 className="text-2xl font-semibold text-white mb-1">
                        {currentStep.question}
                    </h2>
                    {currentStep.subtext && (
                        <p className="text-sm text-neutral-400 mb-6">{currentStep.subtext}</p>
                    )}
                    {!currentStep.subtext && <div className="mb-6" />}

                    {/* Option chips */}
                    <div className="flex flex-wrap gap-2 mb-8">
                        {currentStep.options.map((opt) => (
                            <OptionChip
                                key={opt.value}
                                label={opt.label}
                                selected={selectedValue === opt.value}
                                onClick={() => selectOption(currentStep.memoryKey, opt.value)}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <div className="flex gap-3">
                            {stepIndex > 0 && (
                                <button
                                    onClick={back}
                                    disabled={submitting}
                                    className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                onClick={skipStep}
                                disabled={submitting}
                                className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
                            >
                                Skip
                            </button>
                        </div>

                        <button
                            onClick={next}
                            disabled={submitting}
                            className={`
                                flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
                                transition-all duration-150
                                ${selectedValue
                                    ? "bg-white text-black hover:bg-neutral-200"
                                    : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                                }
                            `}
                        >
                            {submitting ? "Saving..." : isLastStep ? "Finish" : "Next →"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
