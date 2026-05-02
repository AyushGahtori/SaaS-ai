"use client";

import { useState, useEffect } from "react";
import { X, Settings, Check, Loader2 } from "lucide-react";
import { API_BASE, DEFAULT_API_PORT, checkHealth } from "@/lib/api";
import type { HealthResponse } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  {
    id: "ollama",
    label: "Ollama",
    description: "Local/cloud self-hosted models",
    badge: "Default",
    badgeClass: "bg-violet-600/20 text-violet-400 border-violet-600/30",
    models: ["gemma4:27b", "gemma3:27b", "gemma3:12b", "llama3.3:70b", "mistral:7b"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude 3.5 Sonnet - best quality",
    badge: "Recommended",
    badgeClass: "bg-emerald-600/15 text-emerald-400 border-emerald-600/25",
    models: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT-4o with vision support",
    badge: "Popular",
    badgeClass: "bg-sky-600/15 text-sky-400 border-sky-600/25",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  {
    id: "groq",
    label: "Groq",
    description: "Ultra-fast Llama 4 inference",
    badge: "Fast",
    badgeClass: "bg-amber-600/15 text-amber-400 border-amber-600/25",
    models: ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.3-70b-versatile"],
  },
];

export default function SettingsPanel({ open, onClose }: Props) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      checkHealth()
        .then(setHealth)
        .catch(() => setHealth(null))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const activeProvider = health?.provider || "ollama";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-4 bg-[#111115] border border-[#222228] rounded-2xl shadow-2xl overflow-hidden fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e24]">
          <div className="flex items-center gap-2.5">
            <Settings size={16} className="text-violet-400" />
            <span className="font-semibold text-white text-sm">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1e1e26] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Current Status
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 size={14} className="animate-spin" />
                Connecting to backend...
              </div>
            ) : health ? (
              <div className="bg-[#0d0d12] border border-[#1e1e26] rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Provider</span>
                  <span className="text-white font-medium capitalize">{health.provider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Model</span>
                  <span className="text-violet-400 font-mono">{health.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Redis</span>
                  <span className={health.redis ? "text-emerald-400" : "text-red-400"}>
                    {health.redis ? "Connected" : "Offline"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">MongoDB</span>
                  <span className={health.mongodb ? "text-emerald-400" : "text-red-400"}>
                    {health.mongodb ? "Connected" : "Offline"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                Cannot connect to backend on {API_BASE}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              LLM Provider
              <span className="normal-case ml-1 font-normal text-neutral-600">
                {" "}change via <code className="font-mono bg-[#1a1a20] px-1 py-0.5 rounded">backend/.env</code>
              </span>
            </div>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => {
                const isActive = provider.id === activeProvider;
                return (
                  <div
                    key={provider.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border transition-all
                      ${isActive
                        ? "border-violet-600/40 bg-violet-600/8"
                        : "border-[#1e1e24] bg-[#0d0d12] opacity-60"}
                    `}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${provider.badgeClass}`}
                    >
                      {provider.label[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{provider.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${provider.badgeClass}`}>
                          {provider.badge}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-600 truncate">{provider.description}</div>
                    </div>
                    {isActive && <Check size={14} className="text-violet-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0d0d12] border border-[#1e1e26] rounded-xl p-3.5 text-xs">
            <div className="text-neutral-500 mb-2 font-medium">How to switch providers:</div>
            <code className="text-violet-300 font-mono leading-relaxed">
              {`# backend/.env\nLLM_PROVIDER=anthropic\nANTHROPIC_API_KEY=sk-ant-...`}
            </code>
            <div className="mt-2 text-neutral-600">
              Then restart the backend: <code className="font-mono">{`uvicorn main:app --reload --port ${DEFAULT_API_PORT}`}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
