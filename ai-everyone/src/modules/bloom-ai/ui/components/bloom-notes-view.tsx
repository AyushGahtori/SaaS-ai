"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Archive, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noteMatchesSearch } from "@/modules/bloom-ai/lib/shared";
import type { BloomNote, BloomSection } from "@/modules/bloom-ai/types";

interface BloomNotesViewProps {
    notes: BloomNote[];
    section: BloomSection;
    onAddNote: (input: Pick<BloomNote, "title" | "content" | "labels">) => Promise<BloomNote>;
    onPatchNote: (
        input: Partial<Pick<BloomNote, "title" | "content" | "labels" | "status">> & { noteId: string }
    ) => Promise<BloomNote>;
    onDeleteNote: (noteId: string) => Promise<void>;
}

export function BloomNotesView({
    notes,
    section,
    onAddNote,
    onPatchNote,
    onDeleteNote,
}: BloomNotesViewProps) {
    const [search, setSearch] = useState("");
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [draft, setDraft] = useState({
        title: "",
        content: "",
        labels: "",
    });

    const deferredSearch = useDeferredValue(search);
    const filteredNotes = useMemo(() => {
        const targetStatus =
            section === "archive" ? "archived" : section === "deleted" ? "deleted" : "active";
        return notes.filter(
            (note) => note.status === targetStatus && noteMatchesSearch(note, deferredSearch)
        );
    }, [deferredSearch, notes, section]);

    const selectedNote = filteredNotes.find((note) => note.id === selectedNoteId) ?? filteredNotes[0] ?? null;

    useEffect(() => {
        if (!selectedNote) {
            setDraft({ title: "", content: "", labels: "" });
            setSelectedNoteId(null);
            return;
        }

        setSelectedNoteId(selectedNote.id);
        setDraft({
            title: selectedNote.title,
            content: selectedNote.content,
            labels: selectedNote.labels.join(", "),
        });
    }, [selectedNote?.id]);

    const addNote = async () => {
        const note = await onAddNote({
            title: "Untitled note",
            content: "",
            labels: [],
        });
        setSelectedNoteId(note.id);
    };

    const saveNote = async () => {
        if (!selectedNote) return;
        const updated = await onPatchNote({
            noteId: selectedNote.id,
            title: draft.title.trim() || "Untitled note",
            content: draft.content,
            labels: draft.labels
                .split(",")
                .map((label) => label.trim())
                .filter(Boolean),
        });
        setSelectedNoteId(updated.id);
    };

    const archiveLabel = section === "archive" ? "Restore" : "Archive";
    const deleteLabel = section === "deleted" ? "Delete Permanently" : "Delete";

    return (
        <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col rounded-[30px] border border-white/10 bg-[#1d1a19] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.28)]">
                <div className="flex items-center justify-between gap-3">
                    <Button
                        onClick={() => void addNote()}
                        className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
                    >
                        <Plus className="size-4" />
                        Add a Note
                    </Button>
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search notes..."
                            className="w-full rounded-2xl border border-white/10 bg-black/40 py-2 pl-10 pr-3 text-sm text-white outline-none"
                        />
                    </div>
                </div>

                <div className="custom-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="grid gap-3">
                        {filteredNotes.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-5 text-sm text-white/42">
                                No notes in this section yet.
                            </div>
                        ) : null}
                        {filteredNotes.map((note) => {
                            const active = note.id === selectedNote?.id;
                            return (
                                <button
                                    key={note.id}
                                    type="button"
                                    onClick={() => setSelectedNoteId(note.id)}
                                    className={`rounded-[24px] border p-4 text-left transition ${
                                        active
                                            ? "border-[#8FE7B5]/30 bg-black text-white"
                                            : "border-white/8 bg-black/45 text-white/80 hover:border-white/15"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="line-clamp-1 text-lg font-medium">{note.title}</p>
                                            <p className="mt-2 line-clamp-3 text-sm text-white/52">
                                                {note.content || "No content yet"}
                                            </p>
                                        </div>
                                        <X className="size-4 text-white/45" />
                                    </div>
                                    <p className="mt-5 text-xs uppercase tracking-[0.14em] text-white/30">
                                        {note.updatedAt.slice(0, 10)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-col rounded-[30px] border border-white/10 bg-[#171514] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.28)]">
                {selectedNote ? (
                    <>
                        <div className="flex items-start justify-between gap-4">
                            <div className="w-full">
                                <input
                                    value={draft.title}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, title: event.target.value }))
                                    }
                                    placeholder="Enter your Heading here"
                                    className="w-full border-b border-white/10 bg-transparent pb-3 text-4xl font-semibold text-white outline-none"
                                />
                                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/45">
                                    <span>Choose a label or create new</span>
                                    <input
                                        value={draft.labels}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, labels: event.target.value }))
                                        }
                                        placeholder="wellness, focus"
                                        className="min-w-[240px] rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedNoteId(null)}
                                className="rounded-xl border border-white/10 p-2 text-white/65 hover:text-white"
                                aria-label="Close note editor"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <textarea
                            value={draft.content}
                            onChange={(event) =>
                                setDraft((current) => ({ ...current, content: event.target.value }))
                            }
                            placeholder="Here is a new note to capture your best thoughts and ideas."
                            className="custom-scrollbar mt-6 min-h-0 flex-1 resize-none overflow-y-auto rounded-[28px] border border-white/8 bg-black/25 p-5 text-base text-white outline-none"
                        />

                        <div className="mt-5 flex flex-wrap gap-2">
                            <Button className="rounded-2xl bg-white text-black hover:bg-white/90" onClick={() => void saveNote()}>
                                Done
                            </Button>
                            <Button
                                variant="ghost"
                                className="rounded-2xl border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                                onClick={() =>
                                    void onPatchNote({
                                        noteId: selectedNote.id,
                                        status: section === "archive" ? "active" : "archived",
                                    })
                                }
                            >
                                <Archive className="size-4" />
                                {archiveLabel}
                            </Button>
                            <Button
                                variant="ghost"
                                className="rounded-2xl border border-rose-400/18 bg-rose-400/10 text-rose-200 hover:bg-rose-400/18"
                                onClick={() =>
                                    section === "deleted"
                                        ? void onDeleteNote(selectedNote.id)
                                        : void onPatchNote({
                                              noteId: selectedNote.id,
                                              status: "deleted",
                                          })
                                }
                            >
                                <Trash2 className="size-4" />
                                {deleteLabel}
                            </Button>
                            {section === "deleted" ? (
                                <Button
                                    variant="ghost"
                                    className="rounded-2xl border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                                    onClick={() =>
                                        void onPatchNote({
                                            noteId: selectedNote.id,
                                            status: "active",
                                        })
                                    }
                                >
                                    <Undo2 className="size-4" />
                                    Restore
                                </Button>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 text-center text-white/45">
                        <p className="text-lg font-medium text-white">Select a note to start editing</p>
                        <p className="mt-2 max-w-md text-sm">
                            Keep ideas, references, and Bloom prompts in one place. Archived and deleted notes
                            stay available in their own sections.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
