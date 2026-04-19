/**
 * ChatSidebarList - renders the chat history list in the sidebar.
 *
 * Shows each chat as a clickable item with:
 *  - Chat title (truncated)
 *  - Active chat highlighted
 *  - Delete button on hover
 *  - Confirmation popup before delete
 */

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChatContext } from "@/modules/chat/context/chat-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const ChatSidebarList: React.FC = () => {
  const router = useRouter();
  const { chats, activeChatId, selectChat, removeChatById, isLoadingChats } = useChatContext();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await removeChatById(deleteTarget.id);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (isLoadingChats) {
    return <div className="px-3 py-2 text-xs text-white/40">Loading chats...</div>;
  }

  if (chats.length === 0) {
    return <div className="px-3 py-2 text-xs text-white/40">No chats yet</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        {chats.map((chat) => {
          const isActive = chat.id === activeChatId;

          return (
            <div
              key={chat.id}
              data-chat-sidebar-item="true"
              data-active={isActive ? "true" : "false"}
              className={cn(
                "group mx-1 flex cursor-pointer items-center gap-2 rounded-md border bg-none px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-[#2A2F33] bg-[#101214] text-white"
                  : "border-transparent text-[#E5E5E5] hover:border-[#23282D] hover:bg-[#0F1213]"
              )}
              onClick={async () => {
                await selectChat(chat.id);
                router.push("/");
              }}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-50" stroke="white" strokeWidth={2} />

              <span className="flex-1 truncate text-xs font-medium">{chat.title}</span>

              {hoveredId === chat.id ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: chat.id, title: chat.title });
                  }}
                  className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/10"
                  aria-label={`Delete chat: ${chat.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-white/50 hover:text-red-400" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[470px] rounded-2xl border-white/12 bg-[#1b1c21] p-5 text-white">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="text-2xl leading-tight font-semibold tracking-tight">
              Delete chat?
            </AlertDialogTitle>

            <AlertDialogDescription className="break-words text-lg leading-snug font-semibold text-white">
              This will delete{" "}
              <span className="font-bold">
                &quot;{deleteTarget?.title || "this chat"}&quot;
              </span>
              .
            </AlertDialogDescription>

            <p className="pt-1 text-base text-white/68">
              Visit <span className="text-white/75 underline underline-offset-2">settings</span> to delete any
              memories saved during this chat.
            </p>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2 flex-row justify-end gap-3">
            <AlertDialogCancel
              disabled={isDeleting}
              className="h-11 rounded-full border-white/18 bg-white/5 px-6 text-base text-white hover:bg-white/10"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="h-11 rounded-full !border-[#4c1d95] !bg-[#4c1d95] px-6 text-base font-semibold !text-white !shadow-none hover:!bg-[#5b21b6]"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
