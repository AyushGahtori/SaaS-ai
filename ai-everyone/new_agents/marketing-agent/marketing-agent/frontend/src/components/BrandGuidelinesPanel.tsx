"use client";

import { useState, useEffect } from "react";
import { Shield, Save, Loader2, X } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import axios from "axios";
import { API_BASE, getApiErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

const BRAND_EXAMPLES = [
  "Brand voice: bold, direct, no fluff. Target: 18-28 streetwear enthusiasts.",
  "Luxury positioning. Avoid price mentions. Use aspirational, editorial language.",
  "Sustainable & eco-first. Highlight materials and ethical sourcing. Tone: warm, conscious.",
  "Fun and approachable kids brand. Bright colors. Speak to parents, delight kids.",
];

export default function BrandGuidelinesPanel({ open, onClose }: Props) {
  const { activeSessionId } = useChatStore();
  const [guidelines, setGuidelines] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && activeSessionId && !loaded) {
      axios
        .get(`${API_BASE}/api/sessions/${activeSessionId}`)
        .then((response) => {
          setGuidelines(response.data.brand_guidelines || "");
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [open, activeSessionId, loaded]);

  const handleSave = async () => {
    if (!activeSessionId) return;

    setSaving(true);
    try {
      await axios.patch(`${API_BASE}/api/sessions/${activeSessionId}`, {
        brand_guidelines: guidelines,
      });
      toast.success("Brand guidelines saved!");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-[#111115] border border-[#222228] rounded-2xl shadow-2xl overflow-hidden fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e24]">
          <div className="flex items-center gap-2.5">
            <Shield size={15} className="text-violet-400" />
            <span className="font-semibold text-white text-sm">Brand Guidelines</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#1e1e26] text-neutral-500 hover:text-neutral-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Tell the agent about your brand voice, target audience, tone, and any restrictions.
            The agent will apply these guidelines to every piece of content it creates.
          </p>

          <textarea
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="e.g. Bold, no-nonsense streetwear brand. Target: 18-28 Gen Z. Avoid corporate language. Use short punchy sentences. Always include a strong CTA."
            rows={6}
            className="w-full bg-[#0d0d12] border border-[#1e1e26] rounded-xl px-3.5 py-3
                       text-sm text-neutral-200 placeholder-neutral-700 focus:outline-none
                       focus:border-violet-600/50 resize-none leading-relaxed"
          />

          <div>
            <div className="text-[11px] text-neutral-600 mb-2 uppercase tracking-wider font-medium">
              Quick examples
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {BRAND_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setGuidelines(example)}
                  className="text-left text-[11px] text-neutral-500 hover:text-neutral-300
                             bg-[#0d0d12] hover:bg-[#141420] border border-[#1e1e26]
                             rounded-lg px-3 py-2 transition-all truncate"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#2a2a30] text-neutral-400
                         hover:text-neutral-200 hover:bg-[#1a1a22] text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500
                         text-white text-sm font-medium transition-all flex items-center justify-center gap-2
                         disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Guidelines
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
