"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Loader2, Lock } from "lucide-react";
import { listProviders, switchProvider } from "@/lib/api";
import type { ProviderInfo, ProvidersResponse } from "@/types";
import toast from "react-hot-toast";

interface Props {
  /** Called after a successful switch so the header label can refresh. */
  onSwitched?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama",
  groq: "Groq",
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export default function ProviderSwitcher({ onSwitched }: Props) {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const res = await listProviders();
      setData(res);
    } catch {
      // Fail silently — the header already shows a backend-offline indicator.
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handlePick = async (p: ProviderInfo) => {
    if (!p.configured) {
      toast.error(`${PROVIDER_LABELS[p.name] ?? p.name}: no API key configured.`);
      return;
    }
    if (data?.active === p.name) {
      setOpen(false);
      return;
    }

    setSwitching(p.name);
    try {
      const res = await switchProvider(p.name);
      setData(res);
      toast.success(`Switched to ${PROVIDER_LABELS[p.name] ?? p.name}`);
      onSwitched?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Switch failed");
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  };

  if (!data) return null;

  const active = data.providers.find((p) => p.name === data.active);
  const activeLabel = active
    ? `${(PROVIDER_LABELS[active.name] ?? active.name).toUpperCase()} · ${active.model}`
    : "LLM PROVIDER";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors max-w-[320px] truncate"
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 right-0 min-w-[260px] bg-[#0f0f15] border border-[#2a2a36] rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-[#1e1e26]">
            Switch LLM provider
          </div>
          {data.providers.map((p) => {
            const isActive = p.name === data.active;
            const isLoading = switching === p.name;
            const label = PROVIDER_LABELS[p.name] ?? p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handlePick(p)}
                disabled={!p.configured || !!switching}
                className={`
                  w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-left transition-colors
                  ${isActive ? "bg-violet-600/10 text-violet-100" : "text-neutral-200 hover:bg-[#1a1a22]"}
                  ${!p.configured ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium">{label}</span>
                  <span className="text-[10px] text-neutral-500 truncate">
                    {p.configured ? p.model : "no API key configured"}
                  </span>
                </div>
                <div className="flex-shrink-0">
                  {isLoading ? (
                    <Loader2 size={12} className="animate-spin text-neutral-400" />
                  ) : isActive ? (
                    <Check size={12} className="text-violet-400" />
                  ) : !p.configured ? (
                    <Lock size={12} className="text-neutral-600" />
                  ) : null}
                </div>
              </button>
            );
          })}
          <div className="px-3 py-2 text-[10px] text-neutral-600 border-t border-[#1e1e26]">
            Locked options need an API key in the backend <code>.env</code>.
          </div>
        </div>
      )}
    </div>
  );
}
