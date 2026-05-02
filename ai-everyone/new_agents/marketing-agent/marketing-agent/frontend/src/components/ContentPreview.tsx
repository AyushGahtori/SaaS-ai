"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  Download,
  ExternalLink,
  Hash,
  FileText,
  Image as ImageIcon,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Loader2,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import type { GeneratedContent, ContentType, Platform } from "@/types";
import toast from "react-hot-toast";
import { useChatStore } from "@/store/chatStore";

interface Props {
  content: GeneratedContent;
}

// ── Platform labels & colors ──────────────────────────────────────────────────
const PLATFORM_STYLES: Record<string, { label: string; class: string }> = {
  instagram: { label: "Instagram", class: "badge-instagram" },
  linkedin:  { label: "LinkedIn",  class: "badge-linkedin" },
  twitter:   { label: "Twitter / X", class: "badge-twitter" },
  facebook:  { label: "Facebook", class: "badge-facebook" },
  pinterest: { label: "Pinterest", class: "badge-pinterest" },
  tiktok:    { label: "TikTok",   class: "badge-tiktok" },
};

const CONTENT_ICONS: Record<ContentType, React.ElementType> = {
  poster:        ImageIcon,
  social_post:   Megaphone,
  description:   FileText,
  hashtags:      Hash,
  campaign:      FileText,
  ad_copy:       FileText,
  clarification: HelpCircle,
};

const CONTENT_LABELS: Record<ContentType, string> = {
  poster:        "Poster",
  social_post:   "Social Post",
  description:   "Marketing Copy",
  hashtags:      "Hashtags",
  campaign:      "Campaign Brief",
  ad_copy:       "Ad Copy",
  clarification: "A Few Quick Picks",
};

export default function ContentPreview({ content }: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const Icon = CONTENT_ICONS[content.type] || FileText;
  const label = CONTENT_LABELS[content.type] || content.type;
  const platform = content.platform
    ? PLATFORM_STYLES[content.platform]
    : null;

  const handleCopy = async () => {
    // For hashtags, try to extract the ready_to_use block
    let textToCopy = content.content;
    if (content.type === "hashtags") {
      try {
        const parsed = JSON.parse(stripCodeFence(content.content));
        const rtu = parsed.ready_to_use;
        if (Array.isArray(rtu)) textToCopy = rtu.join(" ");
        else if (typeof rtu === "string" && rtu.length) textToCopy = rtu;
      } catch {
        // use raw
      }
    }
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPoster = useCallback(() => {
    const blob = new Blob([content.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "poster.html";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Poster downloaded as HTML!");
  }, [content.content]);

  const handleOpenPoster = useCallback(() => {
    const blob = new Blob([content.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [content.content]);

  return (
    <div className="w-full bg-[#111115] border border-[#222228] rounded-2xl overflow-hidden fade-in">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e24] cursor-pointer hover:bg-[#141418] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-600/20 flex items-center justify-center">
            <Icon size={13} className="text-violet-400" />
          </div>
          <span className="text-sm font-medium text-neutral-200">{label}</span>
          {platform && (
            <span
              className={`text-[11px] font-medium text-white px-2 py-0.5 rounded-full ${platform.class}`}
            >
              {platform.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Copy */}
          {content.type !== "poster" && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-[#1e1e26] text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Copy content"
            >
              {copied ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}

          {/* Poster actions */}
          {content.type === "poster" && (
            <>
              <button
                onClick={handleOpenPoster}
                className="p-1.5 rounded-lg hover:bg-[#1e1e26] text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink size={14} />
              </button>
              <button
                onClick={handleDownloadPoster}
                className="p-1.5 rounded-lg hover:bg-[#1e1e26] text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Download HTML"
              >
                <Download size={14} />
              </button>
            </>
          )}

          <button className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Content Body */}
      {expanded && (
        <div className="p-4">
          {content.type === "poster" ? (
            <PosterPreview html={content.content} iframeRef={iframeRef} />
          ) : content.type === "hashtags" ? (
            <HashtagPreview raw={content.content} />
          ) : content.type === "campaign" ? (
            <CampaignPreview markdown={content.content} />
          ) : content.type === "clarification" ? (
            <ClarificationCard raw={content.content} />
          ) : (
            <TextPreview text={content.content} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-renderers ─────────────────────────────────────────────────────────────

// Fetch an image URL and convert it to a base64 data URL so the iframe's
// <img> becomes self-contained — no cross-origin canvas taint when html2canvas
// runs, and the image travels with the HTML on download.
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Replace http(s) <img src="..."> URLs with inlined data URLs.
async function inlineImages(html: string): Promise<string> {
  const urlRegex = /<img\b[^>]*?\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  const urls = new Set<string>();
  let m;
  while ((m = urlRegex.exec(html)) !== null) urls.add(m[1]);
  if (urls.size === 0) return html;

  const replacements = await Promise.all(
    Array.from(urls).map(async (u) => [u, await fetchAsDataUrl(u)] as const)
  );

  let out = html;
  for (const [u, dataUrl] of replacements) {
    if (!dataUrl) continue;
    // Escape regex special chars in the URL before substituting everywhere.
    const escaped = u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), dataUrl);
  }
  return out;
}

function PosterPreview({
  html,
  iframeRef,
}: {
  html: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
  const [capturing, setCapturing] = useState(false);
  const [resolvedHtml, setResolvedHtml] = useState<string>(html);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const processed = await inlineImages(html);
      if (!cancelled) setResolvedHtml(processed);
    })();
    return () => {
      cancelled = true;
    };
  }, [html]);

  const downloadAsPng = async () => {
    if (!iframeRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc?.body) throw new Error("iframe not ready");

      // Wait for images inside the iframe to finish decoding, or html2canvas
      // may snapshot a blank <img>.
      const imgs = Array.from(iframeDoc.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
        )
      );

      const target = (iframeDoc.querySelector(".poster") as HTMLElement) || iframeDoc.body;
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#fff",
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "marketing-poster.png";
      link.click();
      toast.success("Poster saved as PNG!");
    } catch (err) {
      console.error("PNG export failed:", err);
      toast.error("PNG export failed — try HTML download instead.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative w-full rounded-xl overflow-hidden border border-[#2a2a36] bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={resolvedHtml}
          className="poster-frame"
          style={{ height: "500px" }}
          sandbox="allow-same-origin"
          title="Marketing Poster"
        />
      </div>
      <button
        onClick={downloadAsPng}
        disabled={capturing}
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        {capturing ? (
          <><Loader2 size={11} className="animate-spin" /> Capturing...</>
        ) : (
          <><Download size={11} /> Save as PNG</>
        )}
      </button>
    </div>
  );
}

function TextPreview({ text }: { text: string }) {
  return (
    <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap bg-[#0d0d12] border border-[#1e1e26] rounded-xl p-4 max-h-64 overflow-y-auto">
      {text}
    </div>
  );
}

function stripCodeFence(text: string): string {
  let s = text.trim();
  // Leading fence: ```json\n or ```\n
  const fenceStart = s.match(/^```[a-zA-Z]*\s*\n?/);
  if (fenceStart) s = s.slice(fenceStart[0].length);
  // Trailing fence
  s = s.replace(/\n?```[\s]*$/, "");
  return s.trim();
}

function HashtagPreview({ raw }: { raw: string }) {
  const [copiedAll, setCopiedAll] = useState(false);

  let parsed: any = null;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    // not JSON
  }

  const handleCopyAll = async () => {
    const rtu = parsed?.ready_to_use;
    const text = Array.isArray(rtu)
      ? rtu.join(" ")
      : typeof rtu === "string" && rtu.length
      ? rtu
      : raw;
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success("All hashtags copied!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (!parsed) {
    return <TextPreview text={raw} />;
  }

  const groups = [
    { label: "Mega (10M+)",   items: parsed.mega || [],   color: "text-red-400 bg-red-400/10 border-red-400/20" },
    { label: "Large (1M+)",   items: parsed.large || [],  color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
    { label: "Medium (100K+)",items: parsed.medium || [], color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    { label: "Small (10K+)",  items: parsed.small || [],  color: "text-green-400 bg-green-400/10 border-green-400/20" },
    { label: "Niche",         items: parsed.niche || [],  color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  ];

  return (
    <div className="space-y-3">
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.label}>
              <div className="text-[11px] font-medium text-neutral-600 mb-1.5 uppercase tracking-wider">
                {g.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((tag: string) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full border font-mono ${g.color}`}
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>
          )
      )}
      {parsed.branded_suggestion && (
        <div>
          <div className="text-[11px] font-medium text-neutral-600 mb-1.5 uppercase tracking-wider">
            Branded
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(parsed.branded_suggestion)
              ? parsed.branded_suggestion
              : [parsed.branded_suggestion]
            ).map((tag: string) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full border text-violet-400 bg-violet-400/10 border-violet-400/20 font-mono"
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Copy All */}
      <button
        onClick={handleCopyAll}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-1"
      >
        {copiedAll ? (
          <><Check size={11} className="text-green-400" /> Copied all!</>
        ) : (
          <><Copy size={11} /> Copy all hashtags</>
        )}
      </button>
    </div>
  );
}

function CampaignPreview({ markdown }: { markdown: string }) {
  return (
    <div className="prose-chat max-h-80 overflow-y-auto bg-[#0d0d12] border border-[#1e1e26] rounded-xl p-4 text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

// ── Clarifying questions card ─────────────────────────────────────────────────

interface ClarifyQuestion {
  id: string;
  label: string;
  type: "single" | "multi";
  options: string[];
}

interface ClarifyPayload {
  intro?: string;
  content_type_target?: string;
  questions: ClarifyQuestion[];
}

function ClarificationCard({ raw }: { raw: string }) {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);

  let parsed: ClarifyPayload | null = null;
  try {
    parsed = JSON.parse(raw) as ClarifyPayload;
  } catch {
    parsed = null;
  }

  // selections[questionId] = array of chosen option strings
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!parsed || !parsed.questions?.length) {
    return <TextPreview text={raw} />;
  }

  const toggleOption = (q: ClarifyQuestion, opt: string) => {
    if (submitted) return;
    setSelections((prev) => {
      const current = prev[q.id] || [];
      if (q.type === "single") {
        return { ...prev, [q.id]: [opt] };
      }
      const next = current.includes(opt)
        ? current.filter((o) => o !== opt)
        : [...current, opt];
      return { ...prev, [q.id]: next };
    });
  };

  const handleSubmit = async () => {
    if (submitted || isStreaming) return;
    const lines = parsed!.questions
      .map((q) => {
        const picks = selections[q.id] || [];
        if (!picks.length) return null;
        return `${q.id}: ${picks.join(", ")}`;
      })
      .filter(Boolean) as string[];

    const target = parsed!.content_type_target || "poster";
    const message =
      lines.length > 0
        ? `Here are my picks for the ${target}:\n${lines.join("\n")}`
        : `Skip the questions and just create the ${target} using your best judgement.`;

    setSubmitted(true);
    await sendMessage(message);
  };

  const handleSkip = async () => {
    if (submitted || isStreaming) return;
    const target = parsed!.content_type_target || "poster";
    setSubmitted(true);
    await sendMessage(
      `Skip the questions and just create the ${target} using your best judgement.`
    );
  };

  return (
    <div className="space-y-4">
      {parsed.intro && (
        <p className="text-sm text-neutral-400 leading-relaxed">{parsed.intro}</p>
      )}

      {parsed.questions.map((q) => {
        const picked = selections[q.id] || [];
        return (
          <div key={q.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-neutral-200">
                {q.label}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-600">
                {q.type === "single" ? "Pick one" : "Pick any"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const active = picked.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleOption(q, opt)}
                    disabled={submitted}
                    className={`
                      text-xs px-3 py-1.5 rounded-full border transition-colors
                      ${
                        active
                          ? "bg-violet-600/25 border-violet-500/60 text-violet-100"
                          : "bg-[#0d0d12] border-[#2a2a36] text-neutral-400 hover:border-[#3a3a48] hover:text-neutral-200"
                      }
                      ${submitted ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 border-t border-[#1e1e26]">
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitted || isStreaming}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
        >
          Skip — use your best judgement
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted || isStreaming}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitted ? (
            <>Sent <Check size={12} /></>
          ) : (
            <>Continue <ArrowRight size={12} /></>
          )}
        </button>
      </div>
    </div>
  );
}
