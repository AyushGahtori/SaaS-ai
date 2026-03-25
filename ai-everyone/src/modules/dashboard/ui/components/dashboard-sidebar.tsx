"use client";

import Link from "next/link";
import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { Separator } from "@/components/ui/separator";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare, Bot, Settings } from "lucide-react";
import { DashboardUserButton } from "./dashboard-user-button";
import { ChatSidebarList } from "@/modules/chat/ui/components/chat-sidebar-list";
import { useChatContext } from "@/modules/chat/context/chat-context";

// --------------------
// Sidebar data
// --------------------
const secondSection = [
  {
    label: "Agents",
    href: "/agents",
    icon: Bot,
  },
];

const settingsSection = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

// --------------------
// Component
// --------------------
export const DashboardSidebar = () => {

  const pathname = usePathname();
  const { createNewChat } = useChatContext();

  return (
    <Sidebar className="border-r-[2px] border-r-white/10">
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link href="/" className="flex items-center gap-2 px-2 pt-2">
          {/* logo can get mutated by browser extensions (e.g. Dark Reader) which inject inline styles
              and cause hydration mismatches; suppress the warning so it doesn't break the layout */}
          <Image
            src="/logo.svg"
            height={36}
            width={36}
            alt="SnitchX"
            suppressHydrationWarning
          />
          <p className="text-2xl font-bold text-white">SnitchX</p>
        </Link>
      </SidebarHeader>

      <div className="px-4 py-2">
        <div className="h-[3px] bg-[#5D6B68]/30 rounded-full w-full" />
      </div>

      <SidebarContent className="overflow-hidden">
        {/* New Chat button — wired to chat context */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={createNewChat}
                    className="h-10 flex items-center gap-2 px-3 rounded-md text-sm font-bold tracking-tight text-[#E5E5E5] hover:bg-sidebar-accent/5 hover:text-white w-full"
                  >
                    <MessageSquare className="w-5 h-5" stroke="white" strokeWidth={2} aria-hidden="true" />
                    <span>New Chat</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {secondSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "h-10 flex items-center gap-2 px-3 rounded-md text-sm font-bold tracking-tight text-[#E5E5E5]",
                        "hover:bg-sidebar-accent/5 hover:text-white",
                        pathname === item.href && "bg-sidebar-accent/10"
                      )}
                    >
                      {/** render icon if present */}
                      {item.icon && (
                        <item.icon
                          className="w-5 h-5 shrink-0"
                          stroke="white"
                          strokeWidth={2}
                          aria-hidden="true"
                          suppressHydrationWarning
                        />
                      )}

                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-4 py-2">
          <div className="h-[3px] bg-[#5D6B68]/30 rounded-full w-full" />
        </div>

        {/* Chat history list */}
        <SidebarGroup className="flex-1 min-h-0 overflow-hidden">
          <SidebarGroupContent className="flex flex-col h-full overflow-hidden">
            <div className="px-2 pb-1 flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Recent Chats
              </span>
            </div>
            <div className="sidebar-chat-scroll flex-1 min-h-0 overflow-y-auto w-full relative">
              <ChatSidebarList />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-4 py-2">
          <div className="h-[3px] bg-[#5D6B68]/30 rounded-full w-full" />
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "h-10 flex items-center gap-2 px-3 rounded-md text-sm font-bold tracking-tight text-[#E5E5E5]",
                        "hover:bg-sidebar-accent/5 hover:text-white",
                        pathname === item.href && "bg-sidebar-accent/10"
                      )}
                    >
                      {/** render icon if present */}
                      {item.icon && (
                        <item.icon
                          className="w-5 h-5 shrink-0"
                          stroke="white"
                          strokeWidth={2}
                          aria-hidden="true"
                          suppressHydrationWarning
                        />
                      )}

                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-4 py-2">
          <div className="h-[3px] bg-[#5D6B68]/30 rounded-full w-full" />
        </div>

      </SidebarContent>

      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};

