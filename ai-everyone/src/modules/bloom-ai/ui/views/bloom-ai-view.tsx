"use client";

import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BloomLoadingScreen } from "@/modules/bloom-ai/ui/components/bloom-loading-screen";
import { BloomTopNav } from "@/modules/bloom-ai/ui/components/bloom-top-nav";
import { BloomSidebar } from "@/modules/bloom-ai/ui/components/bloom-sidebar";
import { BloomChatPanel } from "@/modules/bloom-ai/ui/components/bloom-chat-panel";
import { BloomSettingsSheet } from "@/modules/bloom-ai/ui/components/bloom-settings-sheet";
import { BloomRemindersSheet } from "@/modules/bloom-ai/ui/components/bloom-reminders-panel";
import { BloomNotesView } from "@/modules/bloom-ai/ui/components/bloom-notes-view";
import { BloomHabitTrackerView } from "@/modules/bloom-ai/ui/components/bloom-habit-tracker-view";
import { BloomJournalView } from "@/modules/bloom-ai/ui/components/bloom-journal-view";
import { BloomLabelsView } from "@/modules/bloom-ai/ui/components/bloom-labels-view";
import { useBloomWorkspace } from "@/modules/bloom-ai/hooks/use-bloom-workspace";

export function BloomAiView() {
    const workspace = useBloomWorkspace();

    if (workspace.isLoading && !workspace.snapshot) {
        return <BloomLoadingScreen />;
    }

    if (!workspace.snapshot) {
        return (
            <div className="flex h-full items-center justify-center bg-[#181716] px-6 py-10 text-white">
                <div className="max-w-lg rounded-[32px] border border-white/10 bg-[#141414] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                    <p className="text-2xl font-semibold">Bloom AI could not load.</p>
                    <p className="mt-3 text-sm text-white/55">
                        {workspace.error || "Something went wrong while loading your workspace."}
                    </p>
                    <Button
                        className="mt-6 rounded-2xl bg-white text-black hover:bg-white/90"
                        onClick={() => void workspace.reload()}
                    >
                        <RefreshCcw className="size-4" />
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-hidden bg-[#181716] px-4 py-4 text-white lg:px-5 lg:py-5">
            <BloomSettingsSheet
                open={workspace.isSettingsOpen}
                onOpenChange={workspace.setIsSettingsOpen}
                settings={workspace.snapshot.settings}
                onUpdateSettings={workspace.updateSettings}
            />

            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <BloomTopNav
                    activeSection={workspace.activeSection}
                    onChange={(section) => workspace.setActiveSection(section)}
                />

                {workspace.error ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                        {workspace.error}
                    </div>
                ) : null}

                <div className="relative mt-5 flex-1 min-h-0 overflow-hidden">
                    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[292px_minmax(0,1fr)]">
                        <BloomSidebar
                            conversations={workspace.conversations}
                            activeConversationId={workspace.activeConversationId}
                            onSelectConversation={(conversationId) => {
                                workspace.setActiveConversationId(conversationId);
                                workspace.setActiveSection("agent");
                            }}
                            onCreateConversation={workspace.createConversation}
                            onDeleteConversation={workspace.removeConversation}
                            onOpenReminders={() => workspace.setIsRemindersOpen(true)}
                        />

                        <div className="relative min-h-0 min-w-0 overflow-hidden">
                            {workspace.activeSection === "agent" ? (
                                <BloomChatPanel
                                    conversation={workspace.activeConversation}
                                    settings={workspace.snapshot.settings}
                                    isSending={workspace.isSending}
                                    onSend={workspace.sendMessage}
                                    onOpenSettings={() => workspace.setIsSettingsOpen(true)}
                                />
                            ) : null}

                            {workspace.activeSection === "notes" ||
                            workspace.activeSection === "archive" ||
                            workspace.activeSection === "deleted" ? (
                                <div className="h-full min-h-0">
                                    <BloomNotesView
                                        notes={workspace.snapshot.notes}
                                        section={workspace.activeSection}
                                        onAddNote={workspace.addNote}
                                        onPatchNote={workspace.patchNote}
                                        onDeleteNote={workspace.removeNote}
                                    />
                                </div>
                            ) : null}

                            {workspace.activeSection === "habits" ? (
                                <div className="h-full min-h-0">
                                    <BloomHabitTrackerView
                                        habits={workspace.snapshot.habits}
                                        onAddHabit={workspace.addHabit}
                                        onPatchHabit={workspace.patchHabit}
                                        onDeleteHabit={workspace.removeHabit}
                                    />
                                </div>
                            ) : null}

                            {workspace.activeSection === "journal" ? (
                                <div className="h-full min-h-0">
                                    <BloomJournalView
                                        journalEntries={workspace.snapshot.journalEntries}
                                        onAddEntry={workspace.addJournalEntry}
                                        onPatchEntry={workspace.patchJournalEntry}
                                        onDeleteEntry={workspace.removeJournalEntry}
                                    />
                                </div>
                            ) : null}

                            {workspace.activeSection === "labels" ? (
                                <div className="h-full min-h-0">
                                    <BloomLabelsView notes={workspace.snapshot.notes} />
                                </div>
                            ) : null}

                            <BloomRemindersSheet
                                open={workspace.isRemindersOpen}
                                reminders={workspace.snapshot.reminders}
                                onOpenChange={workspace.setIsRemindersOpen}
                                onCreateReminder={workspace.addReminder}
                                onUpdateReminder={workspace.patchReminder}
                                onDeleteReminder={workspace.removeReminder}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
