"use client";

import { Bot, DatabaseZap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { BLOOM_MODELS } from "@/modules/bloom-ai/constants/models";
import { BLOOM_PERMISSION_LABELS } from "@/modules/bloom-ai/constants/defaults";
import type { BloomSettings } from "@/modules/bloom-ai/types";

interface BloomSettingsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: BloomSettings;
    onUpdateSettings: (input: {
        modelId?: BloomSettings["modelId"];
        dataAccess?: Partial<BloomSettings["dataAccess"]>;
    }) => Promise<void>;
}

export function BloomSettingsSheet({
    open,
    onOpenChange,
    settings,
    onUpdateSettings,
}: BloomSettingsSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[440px] max-w-[95vw] border-white/10 bg-[#141414] p-0 text-white sm:max-w-[440px]">
                <SheetHeader className="border-b border-white/10 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-200">
                            <Bot className="size-4" />
                        </div>
                        <div>
                            <SheetTitle className="text-white">AI Agent Settings</SheetTitle>
                            <SheetDescription className="text-white/45">
                                Configure how Bloom AI behaves and what it can access.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="space-y-6 p-6">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-white">
                            <Bot className="size-4 text-[#8FE7B5]" />
                            <h3 className="font-medium">Model Selection</h3>
                        </div>
                        <p className="mt-2 text-sm text-white/45">
                            Choose which Gemini model powers your Bloom workspace.
                        </p>
                        <div className="mt-4 space-y-2">
                            {BLOOM_MODELS.map((model) => {
                                const active = settings.modelId === model.id;
                                return (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => void onUpdateSettings({ modelId: model.id })}
                                        className={`w-full rounded-2xl border p-3 text-left transition ${
                                            active
                                                ? "border-[#8FE7B5]/40 bg-[#212b24]"
                                                : "border-white/8 bg-black/30 hover:border-white/15"
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white">{model.label}</p>
                                        <p className="mt-1 text-xs text-white/45">{model.helper}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-white">
                            <DatabaseZap className="size-4 text-[#8FE7B5]" />
                            <h3 className="font-medium">Data Access Permissions</h3>
                        </div>
                        <p className="mt-2 text-sm text-white/45">
                            Control which personal workspace sources can enrich Bloom AI responses.
                        </p>
                        <div className="mt-4 space-y-3">
                            {Object.entries(BLOOM_PERMISSION_LABELS).map(([key, label]) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-white">{label}</p>
                                        <p className="text-xs text-white/45">
                                            Bloom AI can use this data for richer answers.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.dataAccess[key as keyof BloomSettings["dataAccess"]]}
                                        onCheckedChange={(checked) =>
                                            void onUpdateSettings({
                                                dataAccess: {
                                                    [key]: checked,
                                                },
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
