"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useChatStore } from "@/store/chatStore";
import type { Message } from "@/types";
import MessageBubble from "@/components/MessageBubble";
import AgentActivityPanel from "@/components/AgentActivityPanel";
import HealthBanner from "@/components/HealthBanner";
import SettingsPanel from "@/components/SettingsPanel";
import ImageUpload from "@/components/ImageUpload";
import BrandGuidelinesPanel from "@/components/BrandGuidelinesPanel";
import {
  Send,
  Paperclip,
  PanelLeft,
  Sparkles,
  X,
  Zap,
  Settings,
  Shield,
} from "lucide-react";

const SUGGESTIONS = [
  "Create an Instagram post for this product",
  "Generate a promotional poster",
  "Write a product description",
  "Create a full marketing campaign",
  "Generate hashtags for Instagram & LinkedIn",
  "Write a LinkedIn post",
];

const EMPTY_MESSAGES: Message[] = [];

export default function ChatInterface() {
  const {
    activeSessionId,
    messages,
    isStreaming,
    agentActivity,
    pendingImagePreview,
    sendMessage,
    uploadProductImage,
    clearPendingImage,
    toggleSidebar,
    sidebarOpen,
    createNewSession,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMessages = messages[activeSessionId ?? ""] ?? EMPTY_MESSAGES;
  const isEmpty = activeMessages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, agentActivity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    try {
      if (!activeSessionId) {
        await createNewSession("New Chat");
      }

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await sendMessage(trimmed);

      const { sessions, activeSessionId: sessionId } = useChatStore.getState();
      const session = sessions.find((item) => item.session_id === sessionId);

      if (session && (session.name === "New Chat" || session.name.startsWith("Session "))) {
        const shortName = trimmed.slice(0, 36) + (trimmed.length > 36 ? "..." : "");

        useChatStore.setState((state) => ({
          sessions: state.sessions.map((item) =>
            item.session_id === sessionId ? { ...item, name: shortName } : item
          ),
        }));

        import("@/lib/api").then(({ updateSession }) => {
          if (!sessionId) return;
          updateSession(sessionId, { name: shortName }).catch(() => {});
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  }, [input, isStreaming, activeSessionId, sendMessage, createNewSession]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    try {
      if (!activeSessionId) {
        await createNewSession("New Chat");
      }

      await uploadProductImage(file);
      toast.success("Image ready to send!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <BrandGuidelinesPanel open={showBrand} onClose={() => setShowBrand(false)} />

      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1a1a1e] flex-shrink-0">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-[#1e1e24] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <PanelLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
            <Sparkles size={13} className="text-violet-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-none">MAIA</div>
            <div className="text-[11px] text-neutral-600 leading-none mt-0.5">
              Marketing AI Agent
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <HealthBanner compact />
          <button
            onClick={() => setShowBrand(true)}
            className="p-1.5 rounded-lg hover:bg-[#1e1e24] text-neutral-600 hover:text-neutral-300 transition-colors"
            title="Brand Guidelines"
          >
            <Shield size={15} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-[#1e1e24] text-neutral-600 hover:text-neutral-300 transition-colors"
            title="Settings"
          >
            <Settings size={15} />
          </button>
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
              <Zap size={11} className="animate-pulse" />
              Agent Active
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 pt-2">
        <HealthBanner />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onSuggestion={handleSuggestion} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
            {activeMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {agentActivity && isStreaming && (
              <div className="fade-in pl-11 pb-2">
                <AgentActivityPanel activity={agentActivity} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4 py-4 border-t border-[#1a1a1e]">
        <div className="max-w-3xl mx-auto">
          {pendingImagePreview && (
            <div className="mb-2 flex items-center gap-2">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-violet-600/30 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImagePreview}
                  alt="Product"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={clearPendingImage}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center"
                >
                  <X size={9} className="text-white" />
                </button>
              </div>
              <span className="text-xs text-neutral-500">
                Image attached · Ask me anything about your product
              </span>
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-[#141418] border border-[#2a2a30] rounded-2xl px-4 py-3 input-glow transition-all">
            {activeSessionId && pendingImagePreview ? (
              <ImageUpload
                sessionId={activeSessionId}
                onUploaded={() => {}}
                onClear={clearPendingImage}
                previewUrl={pendingImagePreview}
                className="w-10 h-10 mb-0.5"
              />
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-xl hover:bg-[#1e1e26] text-neutral-500 hover:text-neutral-300 transition-colors flex-shrink-0 mb-0.5"
                title="Attach product image"
              >
                <Paperclip size={18} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to create a poster, social post, campaign brief..."
              rows={1}
              className="flex-1 bg-transparent text-[15px] text-neutral-100 placeholder-neutral-600
                         resize-none focus:outline-none leading-relaxed min-h-[28px] max-h-[160px]"
            />

            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming}
              className={`
                flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mb-0.5
                transition-all duration-150
                ${
                  input.trim() && !isStreaming
                    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20"
                    : "bg-[#1e1e26] text-neutral-600 cursor-not-allowed"
                }
              `}
            >
              <Send size={15} />
            </button>
          </div>

          <div className="text-center mt-2 text-[11px] text-neutral-700">
            Press Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (_text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 pb-8">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-600/20 flex items-center justify-center mb-5">
        <Sparkles size={28} className="text-violet-400" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-1 gradient-text">
        MAIA
      </h1>
      <p className="text-neutral-500 text-sm mb-2 text-center">
        Marketing AI Agent
      </p>
      <p className="text-neutral-600 text-xs mb-8 text-center max-w-xs">
        Upload a product photo and ask me to create posters, social posts,
        descriptions, hashtags, and full campaigns.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestion(suggestion)}
            className="text-left text-xs text-neutral-400 hover:text-neutral-200
                       bg-[#141418] hover:bg-[#1a1a22] border border-[#222228]
                       hover:border-[#2a2a36] rounded-xl px-3.5 py-2.5
                       transition-all duration-150"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
