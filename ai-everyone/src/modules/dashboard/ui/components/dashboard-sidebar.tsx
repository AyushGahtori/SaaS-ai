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

import { usePathname, useRouter } from "next/navigation";
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

const navItemClasses = (active: boolean) =>
  cn(
    "h-10 rounded-lg border border-transparent px-3 text-sm font-semibold tracking-tight text-white/84 transition-[background-color,border-color,box-shadow,color]",
    "hover:border-primary/25 hover:bg-sidebar-accent/60 hover:text-white hover:shadow-[0_10px_20px_rgb(92_53_229/18%)]",
    active && "border-primary/35 bg-sidebar-accent/75 text-white shadow-[0_0_0_1px_rgb(130_89_255/24%),0_12px_24px_rgb(93_58_216/22%)]"
  );

// --------------------
// Component
// --------------------
export const DashboardSidebar = () => {

  const pathname = usePathname();
  const router = useRouter();
  const { createNewChat } = useChatContext();
  const isNewChatActive = pathname === "/";

  if (pathname?.startsWith("/bloom")) {
    return null;
  }

  return (
    <Sidebar className="border-r border-r-sidebar-border/80 bg-[var(--surface-0)]/72 backdrop-blur-xl">
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link href="/" className="group flex items-center gap-2 rounded-lg px-2 pt-2 transition-colors hover:text-white">
          {/* logo can get mutated by browser extensions (e.g. Dark Reader) which inject inline styles
              and cause hydration mismatches; suppress the warning so it doesn't break the layout */}
          <Image
            src="/logo.png"
            height={36}
            width={36}
            alt="Pian"
            suppressHydrationWarning
          />
          <p className="text-2xl font-bold tracking-tight text-white">Pian</p>
        </Link>
      </SidebarHeader>

      <div className="px-4 py-2">
        <div className="ui-divider h-px w-full" />
      </div>

      <SidebarContent className="overflow-hidden">
        {/* New Chat button — wired to chat context */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={() => {
                      createNewChat();
                      router.push("/");
                    }}
                    className={cn("w-full text-left", navItemClasses(isNewChatActive))}
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
                      className={navItemClasses(pathname === item.href)}
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
          <div className="ui-divider h-px w-full" />
        </div>

        {/* Chat history list */}
        <SidebarGroup className="flex-1 min-h-0 overflow-hidden">
          <SidebarGroupContent className="flex flex-col h-full overflow-hidden">
            <div className="px-2 pb-1 flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/32">
                Recent Chats
              </span>
            </div>
            <div className="ui-surface flex h-full flex-col rounded-xl">
              <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto w-full relative">
                <ChatSidebarList />
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-4 py-2">
          <div className="ui-divider h-px w-full" />
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={navItemClasses(pathname === item.href)}
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
          <div className="ui-divider h-px w-full" />
        </div>

      </SidebarContent>

      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};

