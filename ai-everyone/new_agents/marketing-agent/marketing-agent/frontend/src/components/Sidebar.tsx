"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { updateSession } from "@/lib/api";
import {
  Plus,
  MessageSquare,
  Trash2,
  Sparkles,
  ChevronLeft,
  Pencil,
  Check,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Sidebar() {
  const {
    sessions,
    activeSessionId,
    selectSession,
    createNewSession,
    removeSession,
    toggleSidebar,
  } = useChatStore();

  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // Focus rename input when it opens
  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  const handleNew = async () => {
    try {
      await createNewSession("New Chat");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create session");
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await removeSession(sessionId);
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    } finally {
      setDeletingId(null);
    }
  };

  const startRename = (e: React.MouseEvent, sessionId: string, currentName: string) => {
    e.stopPropagation();
    setRenamingId(sessionId);
    setRenameValue(currentName);
  };

  const commitRename = async (sessionId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { cancelRename(); return; }
    try {
      await updateSession(sessionId, { name: trimmed });
      // Update local state
      useChatStore.setState((s) => ({
        sessions: s.sessions.map((sv) =>
          sv.session_id === sessionId ? { ...sv, name: trimmed } : sv
        ),
      }));
    } catch {
      toast.error("Rename failed");
    } finally {
      setRenamingId(null);
    }
  };

  const cancelRename = () => setRenamingId(null);

  return (
    <div className="h-full flex flex-col bg-[#111113] border-r border-[#1e1e22]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1e1e22]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">MAIA</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-[#1e1e24] text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pt-3">
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                     bg-violet-600/10 hover:bg-violet-600/20 border border-violet-600/20
                     text-violet-300 hover:text-violet-200 text-sm font-medium
                     transition-all duration-150 group"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform duration-150" />
          New Campaign
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-neutral-600 text-xs">
            No sessions yet
          </div>
        ) : (
          sessions.map((session) => {
            const isActive   = activeSessionId === session.session_id;
            const isRenaming = renamingId === session.session_id;

            return (
              <div
                key={session.session_id}
                onClick={() => !isRenaming && selectSession(session.session_id)}
                className={`
                  w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl
                  text-left transition-all duration-150 group relative cursor-pointer
                  ${isActive
                    ? "bg-[#1e1e2e] border border-violet-900/30 text-white"
                    : "hover:bg-[#181820] text-neutral-400 hover:text-neutral-200 border border-transparent"
                  }
                `}
              >
                <MessageSquare
                  size={13}
                  className={`mt-0.5 flex-shrink-0 ${
                    isActive ? "text-violet-400" : "text-neutral-600 group-hover:text-neutral-400"
                  }`}
                />

                <div className="flex-1 min-w-0">
                  {/* Rename input */}
                  {isRenaming ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={renameRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(session.session_id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="flex-1 bg-[#0d0d14] border border-violet-600/40 rounded-lg
                                   px-2 py-0.5 text-xs text-white focus:outline-none min-w-0"
                      />
                      <button
                        onClick={() => commitRename(session.session_id)}
                        className="p-0.5 text-emerald-400 hover:text-emerald-300"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={cancelRename}
                        className="p-0.5 text-neutral-500 hover:text-neutral-300"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-medium truncate">{session.name}</div>
                  )}

                  {session.product_name && !isRenaming && (
                    <div className="text-[11px] text-neutral-600 truncate mt-0.5">
                      {session.product_name}
                    </div>
                  )}
                  {!isRenaming && (
                    <div className="text-[11px] text-neutral-700 mt-0.5">
                      {session.message_count} msgs
                    </div>
                  )}
                </div>

                {/* Action buttons — only show when not renaming */}
                {!isRenaming && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => startRename(e, session.session_id, session.name)}
                      className="p-1 rounded-md hover:bg-[#252530] text-neutral-600 hover:text-neutral-400 transition-colors"
                      title="Rename"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, session.session_id)}
                      className="p-1 rounded-md hover:bg-red-500/15 hover:text-red-400 text-neutral-600 transition-colors"
                      title="Delete"
                      disabled={deletingId === session.session_id}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#1e1e22]">
        <div className="text-[11px] text-neutral-700 text-center">
          Powered by LangGraph ReAct
        </div>
      </div>
    </div>
  );
}
