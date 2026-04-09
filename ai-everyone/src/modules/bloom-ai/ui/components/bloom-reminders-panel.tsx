"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { REMINDER_PRIORITY_STYLES } from "@/modules/bloom-ai/constants/defaults";
import { bloomSlideTransition } from "@/modules/bloom-ai/animations/transitions";
import { cn } from "@/lib/utils";
import { formatBloomDate } from "@/modules/bloom-ai/lib/shared";
import type { BloomReminder } from "@/modules/bloom-ai/types";

interface BloomRemindersPanelProps {
    open: boolean;
    reminders: BloomReminder[];
    onOpenChange: (open: boolean) => void;
    onCreateReminder: (input: Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority">) => Promise<void>;
    onUpdateReminder: (
        input: Partial<Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority" | "status">> & {
            reminderId: string;
        }
    ) => Promise<void>;
    onDeleteReminder: (reminderId: string) => Promise<void>;
}

export function BloomRemindersPanel(props: BloomRemindersPanelProps) {
    const [title, setTitle] = useState("");
    const [details, setDetails] = useState("");
    const [scheduledFor, setScheduledFor] = useState("");
    const [priority, setPriority] = useState<BloomReminder["priority"]>("normal");

    const upcoming = useMemo(
        () => props.reminders.filter((item) => item.status === "pending"),
        [props.reminders]
    );
    const completed = useMemo(
        () => props.reminders.filter((item) => item.status === "done"),
        [props.reminders]
    );

    const submit = async () => {
        if (!title.trim()) return;
        await props.onCreateReminder({
            title: title.trim(),
            details: details.trim(),
            scheduledFor,
            priority,
        });
        setTitle("");
        setDetails("");
        setScheduledFor("");
        setPriority("normal");
    };

    return (
        <div
            className={cn(
                bloomSlideTransition,
                "absolute inset-y-0 right-0 z-20 w-full max-w-[380px] border-l border-white/10 bg-[#141414]/96 backdrop-blur xl:rounded-r-[32px]",
                props.open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
            )}
        >
            <RemindersContent
                upcoming={upcoming}
                completed={completed}
                title={title}
                details={details}
                scheduledFor={scheduledFor}
                priority={priority}
                setTitle={setTitle}
                setDetails={setDetails}
                setScheduledFor={setScheduledFor}
                setPriority={setPriority}
                onSubmit={submit}
                onUpdateReminder={props.onUpdateReminder}
                onDeleteReminder={props.onDeleteReminder}
            />
        </div>
    );
}

export function BloomRemindersSheet(props: BloomRemindersPanelProps) {
    const upcoming = useMemo(
        () => props.reminders.filter((item) => item.status === "pending"),
        [props.reminders]
    );
    const completed = useMemo(
        () => props.reminders.filter((item) => item.status === "done"),
        [props.reminders]
    );
    const [title, setTitle] = useState("");
    const [details, setDetails] = useState("");
    const [scheduledFor, setScheduledFor] = useState("");
    const [priority, setPriority] = useState<BloomReminder["priority"]>("normal");

    const submit = async () => {
        if (!title.trim()) return;
        await props.onCreateReminder({
            title: title.trim(),
            details: details.trim(),
            scheduledFor,
            priority,
        });
        setTitle("");
        setDetails("");
        setScheduledFor("");
        setPriority("normal");
    };

    return (
        <Sheet open={props.open} onOpenChange={props.onOpenChange}>
            <SheetContent className="w-[420px] max-w-[95vw] border-white/10 bg-[#141414] p-0 text-white sm:max-w-[420px]">
                <SheetHeader className="sr-only">
                    <SheetTitle>Daily Reminders</SheetTitle>
                    <SheetDescription>Bloom AI reminders panel</SheetDescription>
                </SheetHeader>
                <RemindersContent
                    upcoming={upcoming}
                    completed={completed}
                    title={title}
                    details={details}
                    scheduledFor={scheduledFor}
                    priority={priority}
                    setTitle={setTitle}
                    setDetails={setDetails}
                    setScheduledFor={setScheduledFor}
                    setPriority={setPriority}
                    onSubmit={submit}
                    onUpdateReminder={props.onUpdateReminder}
                    onDeleteReminder={props.onDeleteReminder}
                />
            </SheetContent>
        </Sheet>
    );
}

interface RemindersContentProps {
    upcoming: BloomReminder[];
    completed: BloomReminder[];
    title: string;
    details: string;
    scheduledFor: string;
    priority: BloomReminder["priority"];
    setTitle: (value: string) => void;
    setDetails: (value: string) => void;
    setScheduledFor: (value: string) => void;
    setPriority: (value: BloomReminder["priority"]) => void;
    onSubmit: () => Promise<void>;
    onUpdateReminder: (
        input: Partial<Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority" | "status">> & {
            reminderId: string;
        }
    ) => Promise<void>;
    onDeleteReminder: (reminderId: string) => Promise<void>;
}

function RemindersContent({
    upcoming,
    completed,
    title,
    details,
    scheduledFor,
    priority,
    setTitle,
    setDetails,
    setScheduledFor,
    setPriority,
    onSubmit,
    onUpdateReminder,
    onDeleteReminder,
}: RemindersContentProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-white/8 px-6 py-5">
                <p className="text-xs uppercase tracking-[0.18em] text-white/35">Bloom Workspace</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">Daily Reminders</h3>
                <p className="mt-2 text-sm text-white/45">
                    Track upcoming commitments, mark them done, and keep the day moving.
                </p>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Add Reminder</p>
                        <div className="mt-4 space-y-3">
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Reminder title"
                                className="w-full rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none"
                            />
                            <textarea
                                value={details}
                                onChange={(event) => setDetails(event.target.value)}
                                rows={3}
                                placeholder="Details"
                                className="w-full rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none"
                            />
                            <input
                                type="datetime-local"
                                value={scheduledFor}
                                onChange={(event) => setScheduledFor(event.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPriority("normal")}
                                    className={`rounded-full px-3 py-2 text-sm ${
                                        priority === "normal" ? "bg-white text-black" : "bg-white/10 text-white/65"
                                    }`}
                                >
                                    Normal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriority("high")}
                                    className={`rounded-full px-3 py-2 text-sm ${
                                        priority === "high" ? "bg-white text-black" : "bg-white/10 text-white/65"
                                    }`}
                                >
                                    High
                                </button>
                                <Button onClick={() => void onSubmit()} className="ml-auto rounded-2xl bg-white text-black hover:bg-white/90">
                                    Save
                                </Button>
                            </div>
                        </div>
                    </div>

                    <ReminderList
                        title="Upcoming Reminders"
                        items={upcoming}
                        emptyCopy="No upcoming reminders yet."
                        onToggle={(item) =>
                            onUpdateReminder({
                                reminderId: item.id,
                                status: "done",
                            })
                        }
                        onDeleteReminder={onDeleteReminder}
                    />

                    <ReminderList
                        title="Completed"
                        items={completed}
                        emptyCopy="Nothing completed yet."
                        onToggle={(item) =>
                            onUpdateReminder({
                                reminderId: item.id,
                                status: "pending",
                            })
                        }
                        onDeleteReminder={onDeleteReminder}
                    />
                </div>
            </div>
        </div>
    );
}

function ReminderList({
    title,
    items,
    emptyCopy,
    onToggle,
    onDeleteReminder,
}: {
    title: string;
    items: BloomReminder[];
    emptyCopy: string;
    onToggle: (item: BloomReminder) => Promise<void>;
    onDeleteReminder: (reminderId: string) => Promise<void>;
}) {
    return (
        <section>
            <h4 className="text-sm font-medium uppercase tracking-[0.16em] text-white/38">{title}</h4>
            <div className="mt-3 space-y-3">
                {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/40">
                        {emptyCopy}
                    </div>
                ) : null}
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="mt-1 text-sm text-white/45">{item.details || "No extra details"}</p>
                                <p className="mt-3 text-xs uppercase tracking-[0.15em] text-white/35">
                                    {formatBloomDate(item.scheduledFor)}
                                </p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs ${REMINDER_PRIORITY_STYLES[item.priority]}`}>
                                {item.priority}
                            </span>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Button
                                variant="ghost"
                                className="rounded-2xl border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                                onClick={() => void onToggle(item)}
                            >
                                <CheckCircle2 className="size-4" />
                                {item.status === "done" ? "Restore" : "Done"}
                            </Button>
                            <Button
                                variant="ghost"
                                className="ml-auto rounded-2xl border border-rose-400/18 bg-rose-400/10 text-rose-200 hover:bg-rose-400/18"
                                onClick={() => void onDeleteReminder(item.id)}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
