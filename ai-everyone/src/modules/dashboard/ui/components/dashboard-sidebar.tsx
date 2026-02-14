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
import { FiCalendar, FiUsers, FiSettings } from "react-icons/fi";
import { Star } from "lucide-react";
import { DashboardUserButton } from "./dashboard-user-button";

// --------------------
// Sidebar data
// --------------------
const firstSection = [
  {
    label: "Meetings",
    href: "/dashboard",
    icon: FiCalendar,
  },
  {
    label: "Agents",
    href: "/agents",
    icon: FiUsers,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: FiSettings,
  },
];

const secondSection = [
  {
    label: "Upgrade to Pro",
    href: "/upgrade",
    icon: Star,
  },
];

// --------------------
// Component
// --------------------
export const DashboardSidebar = () => {

  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link href="/" className="flex items-center gap-2 px-2 pt-2">
          <Image
            src="/logo.svg"
            height={36}
            width={36}
            alt="Meet.AI"
          />
          <p className="text-2xl font-semibold">Meet.AI</p>
        </Link>
      </SidebarHeader>

      <div className="px-4 py-2">
        <Separator className="opacity-10 text-[#5D6B68]" />
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
                        "h-10 flex items-center gap-2 px-3 rounded-md text-sm font-medium tracking-tight",
                        "hover:bg-sidebar-accent/5",
                        pathname === item.href && "bg-sidebar-accent/10"
                      )}
                    >
                      {/** render icon if present */}
                      {item.icon && (() => {
                        const Icon = item.icon as any;
                        return (
                          <Icon className="w-5 h-5 text-sidebar-accent-foreground/80" aria-hidden="true" />
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
        <Separator className="opacity-10 text-[#5D6B68]" />
      </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "h-10 flex items-center gap-2 px-3 rounded-md text-sm font-medium tracking-tight",
                        "hover:bg-sidebar-accent/5",
                        pathname === item.href && "bg-sidebar-accent/10"
                      )}
                    >
                      {/** render icon if present */}
                      {item.icon && (() => {
                        const Icon = item.icon as any;
                        return (
                          <Icon className="w-5 h-5 text-sidebar-accent-foreground/80" aria-hidden="true" />
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

      </SidebarContent>

      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};
