"use client";

import {
    CommandDialog,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";


interface Props {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;

}

export const DashboardCommand = ({ open, setOpen }: Props) => {
    const router = useRouter();
    const { state, isMobile } = useSidebar();
    const { chats, selectChat } = useChatContext();
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (!open) setQuery("");
    }, [open]);

    const normalizedQuery = query.trim().toLowerCase();

    const filteredChats = useMemo(() => {
        const list = normalizedQuery
            ? chats.filter((chat) => chat.title.toLowerCase().includes(normalizedQuery))
            : chats;

        return list.slice(0, 12);
    }, [chats, normalizedQuery]);

    const dialogLeftClass = isMobile
        ? "left-1/2"
        : state === "collapsed"
            ? "left-[calc(50%+1.5rem)]"
            : "left-[calc(50%+8rem)]";

    const handleSelectChat = async (chatId: string) => {
        try {
            await selectChat(chatId);
        } finally {
            setOpen(false);
            router.push("/");
        }
    };

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            className={cn(
                "border-white/10 bg-[#0C0D0D] p-0 text-white shadow-2xl",
                "w-[min(42rem,calc(100vw-2rem))] sm:max-w-[42rem]",
                dialogLeftClass,
                "[&_[data-slot=command]]:bg-[#0C0D0D] [&_[data-slot=command]]:text-white",
                "[&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:border-b-white/10 [&_[data-slot=command-input-wrapper]]:bg-[#101213] [&_[data-slot=command-input-wrapper]]:px-4",
                "[&_[data-slot=command-input-wrapper]_svg]:text-white/45 [&_[data-slot=command-input]]:h-12 [&_[data-slot=command-input]]:text-base [&_[data-slot=command-input]]:text-white [&_[data-slot=command-input]]:placeholder:text-white/35",
                "[&_[data-slot=command-list]]:max-h-[340px] [&_[data-slot=command-list]]:bg-[#0C0D0D] [&_[data-slot=command-list]]:p-2"
            )}
            showCloseButton={false}
        >
            <CommandInput
                placeholder="Find a chat"
                value={query}
                onValueChange={setQuery}
            />
            <CommandList className="sidebar-chat-scroll">
                {filteredChats.length === 0 ? (
                    <CommandEmpty>No matching chats found.</CommandEmpty>
                ) : (
                    filteredChats.map((chat) => (
                        <CommandItem
                            key={chat.id}
                            value={`${chat.title} ${chat.id}`}
                            onSelect={() => {
                                void handleSelectChat(chat.id);
                            }}
                            className="group mx-1 rounded-md px-3 py-2 text-sm text-[#E5E5E5] data-[selected=true]:bg-white/10 data-[selected=true]:text-white"
                        >
                            <MessageSquare className="h-4 w-4 flex-shrink-0 text-white/50" />
                            <span className="truncate text-sm font-medium">{chat.title}</span>
                        </CommandItem>
                    ))
                )}
            </CommandList>
        </CommandDialog>
    )
}
