"use client";

import React, { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { auth } from "@/lib/firebase";

interface DiaHelperDiagramCardProps {
    result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export const DiaHelperDiagramCard: React.FC<DiaHelperDiagramCardProps> = ({ result }) => {
    const payload = useMemo(() => {
        const nested = asObject(result.result);
        return Object.keys(nested).length > 0 ? nested : result;
    }, [result]);

    const initialMermaid = String(payload.mermaid || "");
    const initialSummary = String(payload.summary || result.message || "");
    const initialTitle = String(payload.title || "Project Diagram");
    const initialFigmaPrompt = String(payload.figmaPrompt || "");

    const [editInstruction, setEditInstruction] = useState<string>("");
    const [mermaid, setMermaid] = useState<string>(initialMermaid);
    const [figmaPrompt, setFigmaPrompt] = useState<string>(initialFigmaPrompt);
    const [title, setTitle] = useState<string>(initialTitle);
    const [summary, setSummary] = useState<string>(initialSummary);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileSnippet, setFileSnippet] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const diagramUrl = useMemo(() => {
        if (!mermaid.trim()) return null;
        try {
            let cleanMermaid = mermaid.trim();
            if (cleanMermaid.startsWith("```mermaid")) {
                cleanMermaid = cleanMermaid.replace(/^```mermaid\n?/, "").replace(/\n?```$/, "");
            } else if (cleanMermaid.startsWith("```")) {
                cleanMermaid = cleanMermaid.replace(/^```\n?/, "").replace(/\n?```$/, "");
            }

            const state = { code: cleanMermaid, mermaid: { theme: "default" } };
            const jsonStr = JSON.stringify(state);
            const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
            return `https://mermaid.ink/img/${base64Str}`;
        } catch {
            return `https://mermaid.ink/img/${encodeURIComponent(mermaid)}`;
        }
    }, [mermaid]);

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setFileSnippet(null);

        if (!file.type.startsWith("text/") && !file.name.endsWith(".md")) {
            setFileSnippet("Preview is only available for text-based files. The content will still be sent as context.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === "string" ? reader.result : "";
            const trimmed = text.replace(/\r/g, "").trim();
            setFileSnippet(trimmed.slice(0, 2000));
        };
        reader.readAsText(file);
    };

    const callDiaHelper = async (mode: "generate" | "update") => {
        if (!editInstruction.trim()) {
            setError("Please provide an instruction or prompt first.");
            return;
        }

        setIsUpdating(true);
        setError(null);

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                throw new Error("Authentication expired. Please sign in again.");
            }

            const response = await fetch("/api/agents/dia-helper", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: mode === "generate" ? "generate_diagram" : "update_diagram",
                    projectBrief: editInstruction,
                    editInstruction: mode === "update" ? editInstruction : undefined,
                    currentMermaid: mermaid || undefined,
                    fileSnippet: fileSnippet || undefined,
                    fileName: fileName || undefined,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
            if (!response.ok || data.status !== "success") {
                throw new Error(
                    (data.error as string) ||
                        (data.message as string) ||
                        "Dia Helper agent failed to generate a diagram."
                );
            }

            const next = asObject(data.result);
            setMermaid(String(next.mermaid || ""));
            setFigmaPrompt(String(next.figmaPrompt || ""));
            setTitle(String(next.title || "Project Diagram"));
            setSummary(String(next.summary || ""));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to talk to Dia Helper agent.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDownload = async () => {
        if (!diagramUrl) return;
        try {
            const res = await fetch(diagramUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${title || "diagram"}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to download diagram image.");
        }
    };

    return (
        <div className="mt-3 grid gap-4 rounded-xl border border-white/10 bg-[#050608] p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)]">
            {/* Left pane: controls */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                        <svg className="h-3 w-3 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                            Dia Helper
                        </p>
                        <p className="text-[10px] text-emerald-100/70">
                            Connected implicitly via EC2 agent runtime.
                        </p>
                    </div>
                </div>

                <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-white/70">
                        <span className="inline-flex items-center gap-1.5">
                            <Upload className="h-3.5 w-3.5" />
                            Upload context file
                        </span>
                        {fileName ? (
                            <span className="truncate text-[11px] text-white/60">{fileName}</span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-white/85 hover:border-white/25 hover:bg-black/60"
                    >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Choose file from computer
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                    {fileSnippet ? (
                        <div className="custom-scrollbar max-h-24 overflow-y-auto rounded-md border border-white/10 bg-black/60 p-2 text-[11px] text-white/70 whitespace-pre-wrap">
                            {fileSnippet}
                        </div>
                    ) : null}
                </div>

                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/70">
                        <span>Iterative instructions</span>
                        <span className="text-[11px] text-white/40">Prompt</span>
                    </div>

                    <textarea
                        value={editInstruction}
                        onChange={(event) => setEditInstruction(event.target.value)}
                        placeholder="Ask Dia Helper to create or tweak the diagram (e.g. 'I want a simple data flow of youtube', 'add a database layer')."
                        className="h-28 w-full resize-none rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => callDiaHelper("generate")}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/30 disabled:opacity-60"
                    >
                        {isUpdating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                        )}
                        Generate
                    </button>
                    <button
                        type="button"
                        onClick={() => callDiaHelper("update")}
                        disabled={isUpdating || !mermaid}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-50 hover:bg-sky-500/25 disabled:opacity-60"
                    >
                        {isUpdating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                        )}
                        Apply Update
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={!diagramUrl}
                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/15 disabled:opacity-60"
                    >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Download (PNG)
                    </button>
                </div>

                {error ? (
                    <p className="text-xs text-red-300">
                        {error}
                    </p>
                ) : null}
            </div>

            {/* Right pane: live diagram + prompts */}
            <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-white/15 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                                Diagram preview
                            </p>
                            <p className="text-sm font-semibold text-white/90 truncate">
                                {title}
                            </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200">
                            Mermaid
                        </span>
                    </div>

                    {diagramUrl ? (
                        <div className="flex min-h-[180px] items-center justify-center rounded-md border border-white/10 bg-black/40 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={diagramUrl}
                                alt="Mermaid diagram"
                                className="max-h-72 w-full rounded-md border border-white/10 bg-black/80 object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-white/15 bg-black/40 px-4 py-6 text-center text-xs text-white/50">
                            Start by writing a brief on the left and clicking{" "}
                            <span className="font-semibold text-white/80">Generate / Regenerate diagram</span>.
                        </div>
                    )}

                    {summary ? (
                        <p className="mt-2 text-xs text-white/70 whitespace-pre-wrap">
                            {summary}
                        </p>
                    ) : null}
                </div>

                {figmaPrompt ? (
                    <div className="rounded-lg border border-white/15 bg-black/40 p-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-white/70">
                            <span>Prompt to paste into Figma AI</span>
                            <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(figmaPrompt)}
                                className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white/85 hover:bg-white/15"
                            >
                                Copy
                            </button>
                        </div>
                        <div className="custom-scrollbar max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/60 p-2 text-[11px] text-white/80">
                            {figmaPrompt}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
