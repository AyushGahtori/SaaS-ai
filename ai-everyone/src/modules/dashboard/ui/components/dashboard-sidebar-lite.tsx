"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bot, MessageSquare, Settings } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { DashboardUserButton } from "./dashboard-user-button";

const quickLinks = [
  { label: "Chat", href: "/", icon: MessageSquare },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function DashboardSidebarLite() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r-[2px] border-r-white/10">
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link href="/" className="flex items-center gap-2 px-2 pt-2">
          <Image src="/logo.png" height={36} width={36} alt="Pian" suppressHydrationWarning />
          <p className="text-2xl font-bold text-white">Pian</p>
        </Link>
      </SidebarHeader>

      <div className="px-4 py-2">
        <div className="h-[3px] w-full rounded-full bg-[#5D6B68]/30" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {quickLinks.map((item) => (
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
                      <item.icon className="h-5 w-5 shrink-0" stroke="white" strokeWidth={2} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
}
