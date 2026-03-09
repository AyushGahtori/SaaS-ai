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
import { MessageSquare, Search, Settings } from "lucide-react";
import { DashboardUserButton } from "./dashboard-user-button";

// --------------------
// Sidebar data
// --------------------
const firstSection = [
  {
    label: "New Chat",
    href: "/",
    icon: MessageSquare,
  },
  {
    label: "Agents",
    href: "/agents",
    icon: Search,
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

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {firstSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "h-10 flex items-center gap-2 px-3 rounded-md text-sm font-bold tracking-tight text-[#E5E5E5]",
                        "hover:bg-sidebar-accent/5",
                        pathname === item.href && "bg-sidebar-accent/10"
                      )}
                    >
                      {/** render icon if present */}
                      {item.icon && (() => {
                        const Icon = item.icon as any;
                        return (
                          <Icon className="w-5 h-5" stroke="white" strokeWidth={2} aria-hidden="true" />
                        );
                      })()}

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
                        "hover:bg-sidebar-accent/5",
                        pathname === item.href && "bg-sidebar-accent/10"
                      )}
                    >
                      {/** render icon if present */}
                      {item.icon && (() => {
                        const Icon = item.icon as any;
                        return (
                          <Icon className="w-5 h-5" stroke="white" strokeWidth={2} aria-hidden="true" />
                        );
                      })()}

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
