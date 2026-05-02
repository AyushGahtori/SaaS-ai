"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useChatStore } from "@/store/chatStore";
import Sidebar from "@/components/Sidebar";
import ChatInterface from "@/components/ChatInterface";

export default function HomePage() {
  const { loadSessions, sessions, createNewSession, activeSessionId, sidebarOpen } =
    useChatStore();

  useEffect(() => {
    const init = async () => {
      await loadSessions();
    };

    init();
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      createNewSession("New Chat").catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Failed to create session");
      });
    }
  }, [sessions, activeSessionId, createNewSession]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f0f]">
      <div
        className={`
          flex-shrink-0 transition-all duration-200 ease-in-out overflow-hidden
          ${sidebarOpen ? "w-[260px]" : "w-0"}
        `}
      >
        <Sidebar />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
