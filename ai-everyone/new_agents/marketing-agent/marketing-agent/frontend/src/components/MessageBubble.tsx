"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, User, Copy, Check, Download } from "lucide-react";
import type { Message, GeneratedContent } from "@/types";
import ContentPreview from "@/components/ContentPreview";
import toast from "react-hot-toast";

interface Props {
  message: Message;
}

// Strip raw HTML/CSS blocks that the LLM sometimes includes in the chat reply
// even when it shouldn't — those are already rendered in the poster preview.
function sanitizeAssistantText(raw: string): string {
  if (!raw) return raw;
  let out = raw;
  // Remove ```html ... ``` (and ```css, ```js) fenced blocks
  out = out.replace(/```(?:html|css|js|javascript)?\s*[\s\S]*?```/gi, "");
  // Remove any stray <!DOCTYPE html> ... </html> blob
  out = out.replace(/<!DOCTYPE html>[\s\S]*?<\/html>/gi, "");
  // Collapse excess blank lines left behind
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const displayedContent = isUser ? message.content : sanitizeAssistantText(message.content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 py-3 group fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-600/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={14} className="text-violet-400" />
        </div>
      )}

      <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"} max-w-[85%]`}>

        {/* Image attachment (user messages) */}
        {message.imageUrl && (
          <div className="rounded-2xl overflow-hidden border border-[#2a2a36] max-w-[240px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="Product"
              className="w-full object-cover"
            />
          </div>
        )}

        {/* Message bubble */}
        {displayedContent && (
          <div
            className={`
              relative rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${
                isUser
                  ? "bg-violet-600/20 border border-violet-600/25 text-neutral-100 rounded-tr-sm"
                  : "bg-[#141418] border border-[#222226] text-neutral-200 rounded-tl-sm"
              }
            `}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{displayedContent}</p>
            ) : (
              <>
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayedContent}
                  </ReactMarkdown>
                </div>
                {/* Streaming cursor */}
                {message.isStreaming && displayedContent && (
                  <span className="cursor-blink" />
                )}
              </>
            )}

            {/* Copy button — assistant messages */}
            {!isUser && !message.isStreaming && displayedContent && (
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                           p-1.5 rounded-lg bg-[#1a1a22] border border-[#2a2a30]
                           text-neutral-500 hover:text-neutral-300 transition-all"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            )}
          </div>
        )}

        {/* Generated content previews */}
        {!isUser &&
          message.generatedContent &&
          message.generatedContent.length > 0 && (
            <div className="w-full space-y-3 mt-1">
              {message.generatedContent.map((gc, i) => (
                <ContentPreview key={i} content={gc} />
              ))}
            </div>
          )}

        {/* Timestamp */}
        <div className="text-[10px] text-neutral-700 px-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Avatar — user only */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-[#1e1e26] border border-[#2a2a30] flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={14} className="text-neutral-400" />
        </div>
      )}
    </div>
  );
}
